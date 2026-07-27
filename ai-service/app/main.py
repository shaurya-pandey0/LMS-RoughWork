"""LifeTrack AI microservice (FastAPI).

Standalone, provider-agnostic service exposing:
  GET    /health           – service + provider info
  GET    /models           – list models available on the configured provider
  POST   /insights         – LLM insights, Pydantic-validated, rule fallback
  POST   /chat             – grounded assistant chat (full or local_vector mode)
  POST   /vectors/upsert   – embed + index a user's journal entries (local)
  POST   /vectors/search   – semantic search over a user's local index
  DELETE /vectors/{user_key} – drop a user's local store

Swap provider/key/model via environment variables (see app/config.py).
"""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .embeddings import EmbeddingClient, EmbeddingError
from .llm_client import LlmClient, LlmError
from .prompts import build_chat_messages, build_insights_messages
from .rules import rule_based_insights
from .schemas import (
    AiChatReply,
    AiInsightList,
    ChatRequest,
    ChatResponse,
    ContextMode,
    HealthResponse,
    InsightsRequest,
    InsightsResponse,
    ModelsResponse,
    VectorDeleteResponse,
    VectorSearchRequest,
    VectorSearchResponse,
    VectorUpsertRequest,
    VectorUpsertResponse,
)
from .vector import index as vindex
from .vector.retrieval import retrieve_context
from .vector.store import UserStoreManager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("lifetrack.ai")

settings = get_settings()
app = FastAPI(title="LifeTrack AI Service", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Shared singletons.
store_manager = UserStoreManager(settings)


def _client() -> LlmClient:
    return LlmClient(settings)


def _embeddings() -> EmbeddingClient:
    return EmbeddingClient(settings)


def _resolve_model(override: str | None) -> str:
    return override or settings.ai_model or ""


# ---------------------------------------------------------------------------
# Meta
# ---------------------------------------------------------------------------
@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status="UP",
        provider=settings.provider,
        base_url=settings.base_url,
        default_model=settings.ai_model,
    )


@app.get("/models", response_model=ModelsResponse)
async def models() -> ModelsResponse:
    try:
        available = await _client().list_models()
    except LlmError as exc:
        logger.warning("Could not fetch models: %s", exc)
        available = []
    return ModelsResponse(
        provider=settings.provider,
        base_url=settings.base_url,
        default_model=settings.ai_model,
        models=available,
    )


# ---------------------------------------------------------------------------
# Insights
# ---------------------------------------------------------------------------
@app.post("/insights", response_model=InsightsResponse)
async def insights(req: InsightsRequest) -> InsightsResponse:
    model = _resolve_model(req.model)

    if req.use_ai and model:
        try:
            messages = build_insights_messages(req.context, req.user_name)
            ai = await _client().structured(messages, AiInsightList, model=model)
            if ai.insights:
                return InsightsResponse(source="ai", model=model, insights=ai.insights)
            logger.info("AI returned no insights; using rule-based fallback")
        except LlmError as exc:
            logger.warning("Insights AI call failed, falling back to rules: %s", exc)

    return InsightsResponse(source="rules", model=None, insights=rule_based_insights(req.context))


# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------
@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest) -> ChatResponse:
    model = _resolve_model(req.model)

    mode = req.context_mode or ContextMode(settings.ai_retrieval_mode)
    context = req.context

    # local_vector: build a compact, relevant context from the user's index.
    if mode == ContextMode.LOCAL_VECTOR and req.user_key:
        try:
            context, _hits = await retrieve_context(
                store_manager=store_manager,
                embeddings=_embeddings(),
                user_key=req.user_key,
                query=req.query,
                k=settings.vector_top_k,
                base_context=req.context,
                model=req.model,
            )
        except EmbeddingError as exc:
            logger.warning("Local retrieval failed (%s); using supplied context", exc)
            context = req.context
    elif mode == ContextMode.LOCAL_VECTOR and not req.user_key:
        logger.info("context_mode=local_vector but no user_key provided; using full context")

    if model:
        try:
            messages = build_chat_messages(req.query, req.history, context, req.user_name)
            ai = await _client().structured(messages, AiChatReply, model=model)
            return ChatResponse(source="ai", model=model, reply=ai.reply, suggestions=ai.suggestions)
        except LlmError as exc:
            logger.warning("Chat AI call failed, returning fallback: %s", exc)

    if context is not None:
        tips = rule_based_insights(context)
        summary = " ".join(f"{t.title}: {t.message}" for t in tips[:3])
        reply = (
            "The AI assistant is unavailable right now, but here's what your "
            f"recent data shows — {summary}"
        )
    else:
        reply = (
            "The AI assistant is unavailable right now, and no lifestyle context "
            "was provided. Please try again shortly."
        )
    return ChatResponse(source="fallback", model=None, reply=reply, suggestions=[])


# ---------------------------------------------------------------------------
# Vector store (local embeddings + TurboVec)
# ---------------------------------------------------------------------------
@app.post("/vectors/upsert", response_model=VectorUpsertResponse)
async def vectors_upsert(req: VectorUpsertRequest) -> VectorUpsertResponse:
    key_hash, store = await store_manager.get_or_create(req.user_key)
    model = req.model or settings.embedding_model
    async with store.lock:
        vectors = await _embeddings().embed([r.text for r in req.records], model=model)
        upserted = store.upsert(req.records, vectors, model=model)
        return VectorUpsertResponse(
            user_key_hash=key_hash,
            upserted=upserted,
            total=store.count,
            dim=store.dim,
            backend=store.backend,
        )


@app.post("/vectors/search", response_model=VectorSearchResponse)
async def vectors_search(req: VectorSearchRequest) -> VectorSearchResponse:
    key_hash, store = await store_manager.get_or_create(req.user_key)
    query_vec = await _embeddings().embed_one(req.query, model=req.model)
    hits = store.search(query_vec, req.k)
    return VectorSearchResponse(
        user_key_hash=key_hash,
        backend=store.backend or vindex.resolve_backend(settings.vector_backend),
        hits=hits,
    )


@app.delete("/vectors/{user_key}", response_model=VectorDeleteResponse)
async def vectors_delete(user_key: str) -> VectorDeleteResponse:
    key_hash, deleted = await store_manager.delete(user_key)
    return VectorDeleteResponse(user_key_hash=key_hash, deleted=deleted)
