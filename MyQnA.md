### Q1.) how many servers are there right now, how many servers start in this project, and their names

**4 servers are started by the project launcher, and a 5th (LM Studio) must already be running for AI features.**

| # | Server | Port | Started at |
| --- | --- | --- | --- |
| 1 | MongoDB (`mongod`) | 27017 | `start-lifetrack.bat:37` (only if nothing is already listening on 27017 — otherwise it reuses the existing instance) |
| 2 | Spring Boot backend (`lifetrack-backend`) | 8080 | `start-lifetrack.bat:49` |
| 3 | FastAPI AI service (uvicorn, `app.main:app`) | 8100 | `start-lifetrack.bat:56` (skipped if `ai-service\.venv` is missing) |
| 4 | Vite dev server (React frontend) | 5173 | `start-lifetrack.bat:65` |
| 5 | LM Studio (OpenAI-compatible LLM host) | 1234 | Not started by the project — external app. Target configured in `ai-service/.env:7` (`AI_BASE_URL=http://localhost:1234/v1`) |

Of these, only 2 and 3 are servers written in this repo. 1 and 5 are third-party processes, 4 is a dev-only tooling server (in production the frontend is static files from `npm run build`).

Currently running: none that I started or detected — I only compiled and built.


### Q2.) is it microservice architecture yet ?

**No. It's a monolith plus one standalone auxiliary service.** More accurately: a modular monolith (Spring Boot) alongside a separately deployable stateless helper (FastAPI).

What makes it not microservices:

- **One service owns all the business domain.** A single Spring Boot artifact (`backend/pom.xml:14`, `lifetrack-backend`) contains every controller — auth, daily logs, expenses, journal, analytics, insights, admin — and all four MongoDB collections live in one database. In microservices each capability would be its own deployable with its own datastore.
- **No inter-service communication.** The backend has zero calls to the AI service (no `RestTemplate`, `WebClient`, or reference to port 8100 anywhere in `backend/src`). The two services never talk to each other; the browser fans out to both independently (`frontend/src/lib/api.js:8` for Spring, `:129` for FastAPI).
- **No microservice infrastructure.** No API gateway, no service registry/discovery, no config server, no load balancing, no message broker, no distributed tracing. `backend/pom.xml` has no Spring Cloud dependencies at all.
- **No independent scaling need or bounded contexts.** The split is by *technology* (Java vs Python for the LLM work), not by business capability.

What is genuinely microservice-flavoured:

- The AI service is independently deployable, versioned separately (`ai-service/app/main.py:57`, version `1.1.0`), has its own config and CORS, and is stateless with respect to the backend.
- It degrades gracefully when absent — the core app works with the AI service off, which is proper service-boundary discipline.

The honest label is **"two-service architecture"** or "a monolith with an AI sidecar." If asked in an interview, calling it microservices would invite a follow-up you couldn't defend: there's one database, one domain service, and no service-to-service calls.


### Q.) okay perfect, now, when swagger runs on browser which shows spring boots api's , does it also means its another server ?

No. Swagger UI is served *by* the same Spring Boot server on port 8080 — not a separate process.

The `springdoc-openapi-starter-webmvc-ui` dependency (`backend/pom.xml`, the springdoc block) adds two things to the existing app: a `/v3/api-docs` endpoint that generates a JSON description of your controllers by reflection, and a `/swagger-ui.html` page that renders that JSON as an interactive page. Both are just additional routes on the same Tomcat instance that's already running your `/api/*` endpoints — confirmed in `SecurityConfig.java`, where they're permitted alongside your real API paths in the same `authorizeHttpRequests` block, not a different security config or a different port.

Same for FastAPI's `/docs` on 8100 — that's Swagger UI too (FastAPI auto-generates it), served by the same uvicorn process, not a 6th server.



### Q. ) still i am not able to understand , tell like, you mean ai frontent fetches the required data from spring and spring through mongo, now frontend has that data, now it sends it to ai service and then ai service gets back response

Yes, that's exactly right.

```
1. Browser → Spring:   GET /api/journal
2. Spring  → Mongo:    query journal_entries collection
3. Mongo   → Spring:   returns the documents
4. Spring  → Browser:  JSON response, now sitting in React state (`entries`)

   ... user types a chat message, clicks send ...

5. Browser → AI service:  POST /chat  { context: buildContext(entries), query: "...", ... }
6. AI service → OpenAI:   forwards a prompt built from that context
7. OpenAI  → AI service:  reply
8. AI service → Browser:  { reply, suggestions }
```

Steps 1-4 are one round trip, already done before you even open the chat panel — that's just the page loading your journal entries normally. Steps 5-8 are a completely separate round trip, triggered only when you send a chat message. The browser is the only thing present in both. Spring is never involved in step 5 onward, and the AI service never talks to Spring or Mongo directly — it only sees whatever JSON the browser hands it in that one POST body.

That's the entire mechanism: no hidden pipe between the two backends, just the browser holding data from request 1 and reusing it as input to request 2.



## why was it done ? #integration.md  was it something special that only frontend should talk to both ? because normally anyone would think backend should have talked to ai right ? was it beasue of simplicity or data security trying to keep user data local or something else. check?


Let me check whether a rationale was actually written down anywhere, rather than guessing.

No, it wasn't a deliberate security or locality decision — and it wasn't documented as a decision at all. I looked for a stated rationale and there isn't one. What the docs actually say is narrower:

- `ai-service/README.md:3-5` — "standalone FastAPI microservice... kept completely separate from the Spring Boot backend."
- `integration.md`, Phase 4 opening — "The AI integration is purely additive — the core app already works without it."
- The architecture diagram in `integration.md` labels the AI hop "JSON body, no auth needed in dev."

So the honest reconstruction is **path of least change**, not design intent. The AI service was built and live-tested standalone *before* integration (it's listed under "Starting point" as "not yet called from the frontend"). By Phase 4, the frontend already had a working fetch wrapper and all the data loaded in React state. Adding `aiApi` to `lib/api.js` and one call in each of two pages touched zero Java files, needed no new Spring dependency, no HTTP client, no service-to-service auth. Routing through the backend would have meant new controllers, new DTOs, an HTTP client, and re-fetching data Spring already sent to the browser once. Phase 4 was explicitly framed as additive and rollback-safe, and browser-side wiring is the additive option.

Your instinct is right, though: **backend-to-AI is the conventional choice, and here it would be strictly better.** Reasons:

- **Security.** Right now the AI service is unauthenticated and the browser asserts its own `user_key` (`JournalPage.jsx:170`). Anything on the machine can POST to 8100 and claim any identity. If Spring were the caller, the AI service would sit behind the JWT-validated backend, and `user_key` would come from the verified token instead of client-supplied JSON.
- **API keys.** With OpenAI now wired in, the key lives in the AI service — fine while it's on localhost. But the moment you host this, a browser-callable AI endpoint with no auth is a free proxy to your paid OpenAI account. Backend-mediated calls let you enforce per-user rate limits.
- **Trusted context.** The context is currently built in the browser from data the browser can freely alter. Spring would build it from Mongo directly, so the grounding data couldn't be tampered with.
- **Vector store.** Nothing populates it because nothing owns that job. Spring is the natural owner: on journal create/update, push the entry to `/vectors/upsert`. That's the missing piece that would make `local_vector` mode actually work.

And to answer the data-locality part directly: **the current shape gives you no privacy benefit.** With OpenAI configured, the journal text goes browser → your AI service → OpenAI regardless of which backend called it. Browser-as-courier doesn't keep anything local; it just means the data crosses an extra unauthenticated hop on the way out.

So: it was simplicity and integration sequencing. It's defensible as "the AI layer was additive and I kept the blast radius to two files" — but if asked, the stronger answer is knowing why you'd move it behind Spring next.