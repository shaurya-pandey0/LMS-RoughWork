"""Prompt construction.

The model is always asked to return a JSON object whose shape matches a
Pydantic schema. The context block is the structured 'retrieval' that grounds
both insights and chat (context-injection RAG; an optional vector DB could be
slotted in later without changing the contract).
"""

from __future__ import annotations

import json
from typing import List

from .schemas import ChatMessage, LifestyleContext, Role


def _context_block(ctx: LifestyleContext) -> str:
    payload = ctx.model_dump(exclude_none=True)
    return json.dumps(payload, ensure_ascii=False, indent=2)


INSIGHTS_SYSTEM = (
    "You are LifeTrack's lifestyle analyst. Given a user's aggregated lifestyle "
    "data, produce concise, actionable, encouraging insights.\n"
    "Return ONLY a JSON object with this exact shape:\n"
    '{ "insights": [ { "category": <one of SLEEP|SPENDING|HABITS|HYDRATION|MOOD|GENERAL>, '
    '"severity": <one of positive|warning|info>, "title": <short string>, '
    '"message": <one or two sentences> } ] }\n'
    "Rules: base every insight strictly on the provided data; do not invent "
    "numbers; emit 2-6 insights; no text outside the JSON object."
)


def build_insights_messages(ctx: LifestyleContext, user_name: str | None) -> List[ChatMessage]:
    who = f" for {user_name}" if user_name else ""
    user = (
        f"Generate lifestyle insights{who} from the last {ctx.period_days} days.\n"
        f"DATA:\n{_context_block(ctx)}"
    )
    return [
        ChatMessage(role=Role.SYSTEM, content=INSIGHTS_SYSTEM),
        ChatMessage(role=Role.USER, content=user),
    ]


CHAT_SYSTEM = (
    "You are LifeTrack's friendly lifestyle assistant. Answer the user's "
    "question using ONLY the lifestyle context provided; if the context is "
    "insufficient, say so honestly and suggest what to log. Be supportive and "
    "concise.\n"
    "Return ONLY a JSON object with this exact shape:\n"
    '{ "reply": <your answer as a string>, "suggestions": [ <up to 3 short '
    "follow-up questions the user might ask> ] }\n"
    "No text outside the JSON object."
)


def build_chat_messages(
    query: str,
    history: List[ChatMessage],
    ctx: LifestyleContext | None,
    user_name: str | None = None,
) -> List[ChatMessage]:
    messages: List[ChatMessage] = [ChatMessage(role=Role.SYSTEM, content=CHAT_SYSTEM)]
    if user_name:
        messages.append(ChatMessage(
            role=Role.SYSTEM,
            content=f"The user's name is {user_name}. Address them by name when natural.",
        ))
    if ctx is not None:
        messages.append(ChatMessage(
            role=Role.SYSTEM,
            content=f"LIFESTYLE CONTEXT (JSON):\n{_context_block(ctx)}",
        ))
    # Replay prior turns (already validated ChatMessage objects).
    messages.extend(history)
    messages.append(ChatMessage(role=Role.USER, content=query))
    return messages
