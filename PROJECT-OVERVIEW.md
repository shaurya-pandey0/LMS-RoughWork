# LifeTrack — Current Project State

A snapshot of everything that exists and works in this repository, verified on
25 July 2026 by compiling/building each module. Companion to `integration.md`
(which is the chronological journal of *how* the wiring happened); this document
is the *what is here now* reference.

LifeTrack is a personal lifestyle tracker: daily logs (sleep, water, steps
target, meals, moods, habits), expenses, a journal, analytics, rule-based
insights, an admin view, and an optional local-LLM assistant.

---

## 1. Repository layout

```
lms-frontend-backend-springboot/
├─ backend/         Spring Boot 3.3.4 + MongoDB REST API      (port 8080)
├─ frontend/        React 19 + Vite 8 SPA                     (port 5173)
├─ ai-service/      FastAPI microservice → LM Studio          (port 8100)
├─ UI/              Design references: mockups, design-system docs, tokens.json
├─ start-lifetrack.bat   Launches MongoDB + backend + AI + frontend in 4 windows
├─ integration.md   Phase-by-phase integration journal
├─ .env             Root env file (holds an LM Studio API key)
├─ .github/modernize/    Java-upgrade tooling hooks (unused by the app)
└─ .metadata/, .vscode/  Eclipse workspace metadata / editor settings
```

Three independent processes. The frontend talks to **both** the Spring backend
and the AI service directly; **the backend never calls the AI service** (no HTTP
client to port 8100 exists in the Java code).

```
React (5173) ──Authorization: Bearer <jwt>──▶ Spring Boot (8080) ──▶ MongoDB (27017)
      │
      └── plain JSON, no auth ──▶ FastAPI (8100) ──▶ LM Studio (1234, OpenAI-compatible)
```
Updated
```
React (5173) ──Authorization: Bearer <jwt>──▶ Spring Boot (8080) ──▶ MongoDB (27017) ──▶ Spring Boot (8080)  ──▶ FastAPI (8100) ──▶ chatGPT(1234, OpenAI-compatible)

```


## 2. Verified build state (this snapshot)

| Module | Command run | Result |
| --- | --- | --- |
| backend | `mvnw.cmd -o -DskipTests compile` | BUILD SUCCESS, 43 source files, Java 17 |
| frontend | `npm run build` | Built in ~650 ms → `dist/` (JS 326 kB, CSS 54 kB) |
| frontend | `npm run lint` | Clean, no errors |
| ai-service | `.venv\Scripts\python -m pip list` | venv present, all deps installed incl. `turbovec 0.8.0` |

Not verified here (needs running services): live MongoDB round-trips and LM
Studio generation. `integration.md` records those as passing at the time of the
last integration run.

There are **no automated tests** in any module. The backend has test
dependencies (`spring-boot-starter-test`, `spring-security-test`) and an empty
`target/test-classes`, but no test sources.

---

## 3. Backend — `backend/`

Spring Boot **3.3.4**, Java **17**, Maven wrapper included. Artifact
`com.lifetrack:lifetrack-backend:0.0.1-SNAPSHOT`.

Dependencies: `spring-boot-starter-web`, `-data-mongodb`, `-security`,
`-validation`, `springdoc-openapi-starter-webmvc-ui 2.6.0`, `jjwt 0.12.6`
(api/impl/jackson).

### Package structure (`com.lifetrack`)

| Package | Contents |
| --- | --- |
| root | `LifeTrackApplication` |
| `config` | `SecurityConfig`, `CorsProperties`, `JwtProperties`, `InsightProperties` |
| `controller` | `Auth`, `DailyLog`, `Expense`, `Journal`, `Analytics`, `Insight`, `Admin`, `Health` |
| `service` | `Auth`, `DailyLog`, `Expense`, `Journal`, `Analytics`, `Insight` |
| `repository` | `User`, `DailyLog`, `Expense`, `JournalEntry` (Spring Data Mongo) |
| `entity` | `User`, `Role`, `DailyLog` (+ nested `Meal`), `Expense`, `JournalEntry` |
| `dto` | Request/response records per resource, `UserDto` |
| `exception` | `GlobalExceptionHandler`, `BadRequestException`, `ResourceNotFoundException` |
| `security` | `JwtService`, `JwtAuthenticationFilter`, `CustomUserDetailsService`, `UserPrincipal`, `SecurityUtils` |

### Security model

- Stateless JWT (`SessionCreationPolicy.STATELESS`), CSRF disabled, BCrypt password hashing.
- `JwtAuthenticationFilter` runs before `UsernamePasswordAuthenticationFilter`.
- Public: `/api/auth/**`, `GET /api/health`, `/v3/api-docs/**`, `/swagger-ui/**`.
- `/api/admin/**` requires role `ADMIN`; everything else requires authentication.
- `@EnableMethodSecurity` is on, so method-level annotations are available.
- CORS: origins from `app.cors.allowed-origins`, methods GET/POST/PUT/PATCH/DELETE/OPTIONS, credentials allowed.
- Every non-admin service method is scoped by `SecurityUtils.currentUserId()`, so
  users can only read/write their own documents.

### Data model (MongoDB collections)

| Collection | Fields | Indexes |
| --- | --- | --- |
| `users` | `id`, `fullName`, `email`, `password` (BCrypt), `role` (`USER`/`ADMIN`), `createdAt` | unique on `email` |
| `daily_logs` | `id`, `userId`, `date`, `sleepHours`, `stepTarget`, `waterIntake`, `transactionalHabits[]`, `embeddedHabits[]`, `meals[{name, items[]}]`, `morningMood`, `afternoonMood`, `eveningMood`, `createdAt`, `updatedAt` | unique compound `(userId, date)` |
| `expenses` | `id`, `userId`, `date`, `category`, `amount`, `createdAt` | `userId` |
| `journal_entries` | `id`, `userId`, `date`, `mood`, `text`, `createdAt`, `updatedAt` | `userId` |

Expense categories used by the UI: Food, Housing, Travel, Wellness, Misc.
Journal moods: happy, calm, anxious, grateful, tired.

### REST API

All paths are prefixed `/api`. Auth = `Authorization: Bearer <jwt>` unless noted.

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/health` | public | `{"status":"UP"}` |
| POST | `/auth/register` | public | `{fullName, email, password≥8}` → 201 `{token, tokenType, user}` |
| POST | `/auth/login` | public | `{email, password}` → 200 same shape |
| GET | `/auth/me` | user | current `UserDto` |
| GET | `/daily-logs` | user | own logs, date desc |
| GET | `/daily-logs/{id}` | user | 404 if not owned |
| POST | `/daily-logs` | user | **upsert by (userId, date)** — re-saving a day updates it |
| PUT | `/daily-logs/{id}` | user | full replace |
| DELETE | `/daily-logs/{id}` | user | 204 |
| GET/POST/PUT/DELETE | `/expenses`, `/expenses/{id}` | user | CRUD; `amount` must be positive |
| GET/POST/PUT/DELETE | `/journal`, `/journal/{id}` | user | CRUD; `mood` and `text` required |
| GET | `/analytics` | user | `{weeklySleep[{date,hours}], expensesByCategory, totalExpenses, moodCounts, journalEntryCount}` |
| GET | `/insights` | user | `{from, to, insights[{category, severity, title, message, metric}]}` |
| GET | `/admin/stats` | admin | totals + aggregated expenses-by-category and mood counts |
| GET | `/admin/users` | admin | all users as `UserDto` |

Swagger UI is available at `/swagger-ui.html` (springdoc), OpenAPI JSON at
`/v3/api-docs`.

Errors come from `GlobalExceptionHandler` as `{message}` plus, for bean
validation failures, `{errors: {field: message}}` — which the frontend maps to
per-input errors.

### Rule-based insight engine (`InsightService`)

Deterministic, no external calls, trailing 7-day window (today + previous 6).
Five rules, each emitting at most one insight and staying silent without enough
data; if nothing fires, a "Not enough data yet" INFO insight is returned.

| Rule | Fires when | Severity |
| --- | --- | --- |
| Sleep | avg `< min-sleep-hours` (6.0) / `≥ good-sleep-hours` (7.5) | warning / positive |
| Spending | 7-day total `> weekly-spending-threshold` (1000) | warning |
| Habit consistency | ≥3 logged days and habit-days/7 `< threshold` (0.5) | warning |
| Hydration | avg water `< min-water-intake-ml` (2000) | warning |
| Mood | negative vs positive mood tally across logs + journals | warning / positive |

Thresholds are externalised via `app.insights.*` in `application.yml`.

### Configuration (`application.yml`)

| Key | Env override | Default |
| --- | --- | --- |
| `spring.data.mongodb.uri` | `MONGODB_URI` | `mongodb://localhost:27017/lifetrack` |
| `app.jwt.secret` | `APP_JWT_SECRET` | dev base64 secret **checked into the repo** |
| `app.jwt.expiration-ms` | `APP_JWT_EXPIRATION_MS` | `86400000` (24 h) |
| `app.cors.allowed-origins` | `APP_CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:3000` |
| `app.insights.*` | `APP_INSIGHTS_*` | see table above |
| server port | — | `8080` |

### Seed data (`backend/seed-data.js`)

Run with `mongosh "mongodb://127.0.0.1:27017/lifetrack" seed-data.js`.
Idempotent for the three demo accounts (it deletes and recreates only those).

| User | Role | Pattern | Password |
| --- | --- | --- | --- |
| `alex@example.com` | USER | healthy → positive insights | `Password123!` |
| `priya@example.com` | USER | poor → warning insights | `Password123!` |
| `sam@example.com` | ADMIN | mixed | `Password123!` |

Each gets 7 days of daily logs plus expenses and journal entries.

---

## 4. Frontend — `frontend/`

React **19.2**, Vite **8**, React Router **7.17**, Tailwind **4** (via
`@tailwindcss/vite`) alongside a hand-written CSS design system. ESLint 10 flat
config. JavaScript + JSX, no TypeScript.

### Routes (`src/App.jsx`)

| Path | Page | Gate |
| --- | --- | --- |
| `/` | `LandingPage` | public |
| `/login` | `LoginPage` | public |
| `/register` | `RegisterPage` | public |
| `/dashboard` | `DashboardPage` | authenticated |
| `/daily-log` | `DailyLogPage` | authenticated |
| `/expenses` | `ExpensesPage` | authenticated |
| `/journal` | `JournalPage` | authenticated |
| `/analytics` | `AnalyticsPage` | authenticated |
| `/admin` | `AdminPage` | authenticated + `ADMIN` |
| `*` | redirect to `/` | — |

`App.jsx` also provides `ScrollToTop` and a class-based `ErrorBoundary` with a
"Something went wrong" fallback card. `ProtectedRoute` renders nothing while
auth is hydrating, redirects anonymous users to `/login` (preserving the intended
path in `location.state.from`), and bounces non-admins from admin routes to
`/dashboard`.

### Integration layer

- **`src/lib/api.js`** — single `fetch` wrapper. Reads `VITE_API_BASE_URL`,
  attaches the JWT from `localStorage` (`lifetrack.token`), handles `204`,
  throws `ApiError(status, message, fieldErrors)` on non-2xx, clears the token
  and dispatches a `lifetrack:unauthorized` event on 401, and converts network
  failures into `ApiError(0, ...)`. Exposes `authApi`, `dailyLogApi`,
  `expenseApi`, `journalApi`, `analyticsApi`, `insightsApi`, `adminApi`, and a
  separate `aiApi` (`health`, `chat`, `insights`) pointed at `VITE_AI_BASE_URL`.
- **`src/lib/auth.jsx`** — `AuthProvider` / `useAuth` exposing
  `{user, token, isAuthenticated, isAdmin, loading, login, register, logout}`.
  Persists user + token, hydrates via `GET /auth/me` when a token exists without
  a user, and listens for `lifetrack:unauthorized`.
- **`src/components/Sidebar.jsx`** — shared nav; shows the real user's name and
  initials, conditionally renders the Admin link, and provides logout.

### Page-by-page data wiring

| Page | State |
| --- | --- |
| Landing | Static marketing page with an in-page app mockup. |
| Login / Register | Live `POST /auth/login` and `/auth/register`; server messages shown as a form banner, `errors` map bound to individual inputs. |
| Dashboard | Live: weekly sleep bars and expense donut from `/analytics`; Insights card from `/insights`, with an opt-in "✨ AI" button that switches to the AI service's `/insights` and labels the source. |
| Daily Log | Live: loads all logs on mount, pre-populates today's entry, single "Save Today's Log" posts to `/daily-logs` (upsert). |
| Expenses | Full live CRUD; optimistic delete with rollback; keeps `isoDate` alongside the display date so editing pre-fills the picker. |
| Journal | Full live CRUD; AI Assistant panel posts to the AI service `/chat` with a context built from the user's entries, a rolling 6-message history, `user_name` and `user_key`; graceful message when the service is down. |
| Analytics | **Partly mocked.** Sleep line chart uses `/analytics` `weeklySleep`; step bar chart, habit donut, and the grouped per-day expense chart are still generated mock data (`mockSleep` is only a fallback; `expenseGroups = mockExpenses`). |
| Admin | Live `/admin/stats` cards and an `/admin/users` table (name, email, role chip). |

### Styling

`src/styles/`: `tokens.css`, `reset.css`, `typography.css`, `layout.css`,
`components.css`, `main.css`, plus per-page sheets (`admin`, `analytics`,
`daily-log`, `expenses`, `journal`). Charts are hand-rolled SVG/CSS — no chart
library. Assets: `botanical-shadow.png`, `geometric-mesh.svg`, `hero.png`.
`public/` has `favicon.svg` and `icons.svg`. A built `dist/` exists locally
(gitignored).

### Environment (`frontend/.env`)

```
VITE_API_BASE_URL=http://localhost:8080/api
VITE_AI_BASE_URL=http://localhost:8100
```

(The comment in that file calling the AI URL a "Phase 2 placeholder" is stale —
it is in active use.)

---

## 5. AI service — `ai-service/`

FastAPI **0.115.6** + uvicorn, Pydantic **2.10.4** / pydantic-settings,
httpx, numpy, `turbovec 0.8.0`. Runs standalone at `http://127.0.0.1:8100`
(`run.ps1` creates the venv, copies `.env`, and starts uvicorn). Interactive
docs at `/docs`. Title reports version `1.1.0`.

Provider-agnostic: it speaks the OpenAI-compatible `/models`,
`/chat/completions`, and `/embeddings` endpoints, so `lmstudio`, `openai`,
`mistral`, and `gemini` (OpenAI-compat) are all selectable by config alone.
Current `.env` targets **LM Studio at `http://localhost:1234/v1`** with model
`qwen3.5-2b-mtp` and embedding model `text-embedding-nomic`, i.e. fully offline
over loopback.

### Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | status, provider, base URL, default model |
| GET | `/models` | model ids from the provider (empty list if unreachable) |
| POST | `/insights` | LLM insights validated against `AiInsightList`; falls back to `rules.py` when AI is off, errors, or returns nothing (`source: "ai"` / `"rules"`) |
| POST | `/chat` | grounded assistant reply + suggestions (`source: "ai"` / `"fallback"`); `context_mode` `full` or `local_vector` |
| POST | `/vectors/upsert` | embed + index a user's journal records |
| POST | `/vectors/search` | semantic search over one user's index |
| DELETE | `/vectors/{user_key}` | drop a user's store |

The frontend currently uses `/health`, `/chat`, and `/insights` only — the
`/vectors/*` endpoints are functional but not called from the UI, and
`ai-service/data/users/` is currently empty (no stores created yet).

### Structured-output contract

`schemas.py` validates three boundaries: inbound requests, raw LLM output
(`AiInsightList`, `AiChatReply`), and outbound responses. `llm_client.py`
negotiates the structured-output mode per provider — `json_schema` →
`json_object` → prompt-only — and caches the first mode that isn't rejected with
HTTP 400. Before sending a JSON schema as a grammar it runs
`_grammar_safe_schema()`, which strips `maxLength`/`minLength`/`pattern`/
`minItems`/`maxItems`/numeric bounds; llama.cpp rejects large repetition counts
in GBNF, which previously broke structured output silently. The real limits are
still enforced by Pydantic on the service side.

`rules.py` mirrors the Spring `InsightService` rules (sleep, spending, habits,
hydration, mood) so a deterministic answer is always available.

### Local vector store

Per-user, per-machine stores under `VECTOR_DATA_DIR` (`./data/users`):

```
data/users/<sha256(salt:user_key)[:32]>/
  meta.json        dim, backend, model, next_id, ext-id → int-id map
  index.tvim|.npz  the index
  payloads.jsonl   int-id → {ext_id, date, mood, snippet}
```

Two interchangeable index backends (`vector/index.py`): `TurboVecIndex`
(TurboQuant 4-bit, stable uint64 ids, persisted via `write`/`load`) and a
float32 cosine `NumpyIndex` fallback chosen automatically when `turbovec` isn't
importable. `VECTOR_BACKEND=auto|turbovec|numpy` forces the choice.
`UserStoreManager` keeps an LRU of resident indexes (`VECTOR_CACHE_USERS`, default
16) and isolates stores per user key. `vector/retrieval.py` embeds the query,
pulls top-k snippets, and folds them into a `LifestyleContext` while keeping any
numeric fields the caller supplied.

`docs/vector-db-turbovec.md` documents the design in more depth.

### Key settings (`.env` / `.env.example`)

`AI_PROVIDER`, `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, `AI_TEMPERATURE` (0.4),
`AI_TIMEOUT_SECONDS` (60), `AI_MAX_TOKENS` (800),
`AI_RETRIEVAL_MODE` (`full`), `EMBEDDING_MODEL`, `VECTOR_DATA_DIR`,
`VECTOR_TOP_K` (5), `VECTOR_CACHE_USERS`, `VECTOR_BIT_WIDTH` (4),
`VECTOR_BACKEND`, `USER_KEY_SALT`, `MAX_SNIPPET_CHARS` (500),
`CORS_ALLOWED_ORIGINS`. `AI_JSON_MODE` (default `auto`) is supported by
`config.py` but not listed in either env file.

---

## 6. Running it

Ports: MongoDB 27017, backend 8080, AI service 8100, frontend 5173, LM Studio 1234.

Double-click `start-lifetrack.bat` (reuses an existing mongod on 27017, else
starts one with `--dbpath .\data\mongodb`; starts the backend via `mvnw.cmd
spring-boot:run`, the AI service if `.venv` exists, and Vite; waits 30 s and
opens the browser). Manually:

```
mongod --dbpath <data dir>
cd backend      && mvnw.cmd -DskipTests spring-boot:run
cd ai-service   && .venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8100
cd frontend     && npm run dev
mongosh "mongodb://127.0.0.1:27017/lifetrack" backend/seed-data.js
```

The AI service and LM Studio are optional: without them the Journal chat shows a
friendly unavailable message and the Dashboard keeps Spring's rule-based
insights.

---

## 7. Gaps and known issues

Functional gaps
- **No tests anywhere** — no JUnit, no Vitest, no pytest.
- **Analytics page is partly mocked**: steps, habit completion, and per-day
  expense grouping have no backing endpoints. `stepTarget` is stored but never
  aggregated; habit completion would need a new endpoint.
- **Admin surface is thin**: stats + user list only. No user edit/delete/role
  change, no pagination, and `AdminStatsResponse.aggregated*` fields are
  returned but unused by the UI.
- **AI vector endpoints are unused by the UI**, so `local_vector` chat mode is
  never exercised from the browser (nothing upserts journal entries into the
  index).
- No refresh tokens, password reset, email verification, or profile editing.
- No Dockerfiles, CI pipeline, or deployment config.

Security notes
- The **default JWT secret is committed** in `application.yml`. Fine for local
  dev, must be overridden via `APP_JWT_SECRET` anywhere else.
- `ai-service/.env` holds an LM Studio API key and *is* gitignored. The **root
  `.env` also holds a key and is not covered by any `.gitignore`** (there is no
  root-level ignore file) — worth fixing before publishing.
- JWT is stored in `localStorage`, which is XSS-exposed; HttpOnly cookies would
  be stricter but require changing both sides.
- **The AI service has no authentication** — any local process can POST to
  `/chat`, `/insights`, or `/vectors/*` and, with a guessed `user_key`, read
  another user's indexed snippets. Acceptable while it is bound to `127.0.0.1`;
  do not expose it on a network without adding auth.
- CORS on both services is limited to the two localhost dev origins, which needs
  updating for any real deployment.

Housekeeping
- Eclipse workspace metadata (`.metadata/`, `backend/.metadata/`,
  `backend/.settings/`, `.classpath`, `.project`) and build output
  (`backend/target/`, `frontend/dist/`, `frontend/node_modules/`) sit in the
  tree; the frontend ones are gitignored, the Eclipse ones are not.
- `frontend/.env` comment still describes the AI URL as an unused placeholder.
- `.github/modernize/java-upgrade/` holds tooling hooks unrelated to the app.
