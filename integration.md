# Integration Log — Frontend ↔ Backend (↔ AI Service)

> A running journal of how the React frontend is being wired to the Spring Boot
> backend, and (later) the FastAPI AI microservice. Each step records **what**
> was built, **why** that approach, and a short **how-to-explain-it** so the
> reasoning is recoverable in an interview.

## Starting point

- **Backend** (`/backend`): Spring Boot 3.3 + MongoDB. JWT auth. CRUD for
  users, daily logs, expenses, journal entries. Aggregated `/api/analytics`,
  rule-based `/api/insights`, admin endpoints. CORS allows
  `http://localhost:5173,http://localhost:3000`. Verified compiling & seeded
  with three demo users (see `backend/seed-data.js`).
- **Frontend** (`/frontend`): React 19 + Vite + React Router 7 + Tailwind 4.
  The UI is fully designed across Landing/Login/Register/Dashboard/Daily
  Log/Expenses/Journal/Analytics/Admin — but **every page uses hardcoded seed
  arrays**, and Login/Register just `setTimeout` and navigate to the
  dashboard. No real network calls anywhere.
- **AI service** (`/ai-service`): standalone FastAPI microservice. Built and
  live-tested. **Not yet called from the frontend** — that's the Phase 2 of
  this integration.

## Strategy (why this order)

Wire in **layers**, smallest first, so each step is independently testable
and rollback-safe:

1. **Foundation** — env config, a single fetch wrapper, an auth context, and
   protected routes. Nothing user-visible changes yet; this is the glue every
   later step depends on.
2. **Auth flow** — replace fake Login/Register with real backend calls. This
   is the first end-to-end test (browser → Spring → MongoDB → JWT back).
3. **Data pages** — one page at a time, swap mock arrays for live API calls,
   keep CRUD wired to the backend. The polished UI stays untouched; only the
   data source changes.
4. **AI service** — once the core app works, point the Journal page's AI
   Assistant and an Insights view at the FastAPI service, with graceful
   fallback if it's offline.

Rationale: keep changes small and reversible. Every layer leaves the app in
a working state. Cuts down risk during the interview-grade demo.

## Architecture at a glance

```
React (5173)  ─── Authorization: Bearer <jwt> ──▶  Spring Boot (8080) ──▶ MongoDB
       │
       └── (Phase 2)  JSON body, no auth needed in dev  ──▶  FastAPI (8100) ──▶ LM Studio
```

The frontend talks to **two independent services**. Spring is the source of
truth for users/logs/expenses/journals. The AI service is stateless from the
backend's perspective and pulls a separate local vector store per user when
asked to.

---

# Phase 1 — Foundation (✅ done)

Goal: one place to read config, one place to make HTTP calls, one place to
hold the logged-in user. Pages should never see fetch URLs, tokens, or
storage details.

## 1.1 Environment config

File: `frontend/.env`

```
VITE_API_BASE_URL=http://localhost:8080/api
VITE_AI_BASE_URL=http://localhost:8100
```

Vite exposes `import.meta.env.VITE_*` at build time. Two separate URLs so the
backend and AI service can be moved independently (e.g. AI service behind a
different host in prod).

**Explain it:** "I don't bake URLs into the code. The frontend reads them
from env vars at build time, so I can point a production build at a real
domain without code changes."

## 1.2 Fetch wrapper + typed endpoint helpers

File: `frontend/src/lib/api.js`

Responsibilities:
- Read `VITE_API_BASE_URL`.
- Read JWT from `localStorage` and attach `Authorization: Bearer <token>`.
- Parse JSON, throw an `ApiError` with `status`, `message`, `fieldErrors`
  for any non-2xx so callers can show field-level errors from
  `GlobalExceptionHandler` (e.g. validation `errors` map).
- Treat `204 No Content` correctly (DELETE returns nothing).
- On `401`, clear the token and emit a `lifetrack:unauthorized` event so the
  auth context can react (no tight coupling).
- Wrap network failures (server down) in a friendly `ApiError(0, ...)`.

Then thin per-resource helpers — `authApi`, `dailyLogApi`, `expenseApi`,
`journalApi`, `analyticsApi`, `insightsApi`, `adminApi` — so pages just call
`expenseApi.list()` instead of building paths and headers.

**Why a class for the error?** Components need to differentiate "the email is
already taken" (show a field error) from "the server is down" (show a
banner). Status + fieldErrors gives them that without parsing strings.

**Explain it:**
- "Centralising the token and base URL means I never repeat that boilerplate
  in pages."
- "The wrapper translates Spring's error JSON into a typed `ApiError` so the
  UI can render the right thing — field errors next to inputs, 401 redirects
  to login, network errors as a toast."
- "401 emits an event the auth context listens to; that decouples HTTP from
  state management."

## 1.3 Auth context

File: `frontend/src/lib/auth.jsx`

- React context exposing `{ user, token, isAuthenticated, isAdmin, loading,
  login, register, logout }`.
- Persists `token` and `user` in `localStorage` so a refresh doesn't kick you
  out.
- If we boot with a token but no user (older session, different tab),
  hydrates via `GET /auth/me`.
- Listens for `lifetrack:unauthorized` from the fetch wrapper and clears
  state — single source of truth.

**Explain it:** "The auth context is the only thing pages ever touch for
identity. They never read `localStorage` themselves. That keeps SSR/test
substitution simple and prevents drift between two pages that both think
they know who's logged in."

## 1.4 Wire it in

- `frontend/src/main.jsx` wraps `<App />` in `<AuthProvider>`.
- `frontend/src/App.jsx` adds a `<ProtectedRoute>` wrapper that:
  - Renders nothing while auth is hydrating (avoids a flash of the login
    page after a refresh).
  - Redirects unauthenticated visitors to `/login`, preserving the intended
    path in `location.state.from`.
  - Optionally enforces `requireAdmin` (redirects non-admins back to
    `/dashboard` rather than login — a small UX nicety).

**Explain it:** "Routes are still declared in one place. The gate is a
component wrapper, not a HOC or a router-config hack, so adding a new
protected page is just wrapping the element."

## Phase 1 verification

- `npm run dev` boots Vite, the app renders.
- Visiting `/dashboard` without a token now redirects to `/login`.
- No user-visible behaviour changed for already-public pages (Landing/Login/
  Register/Admin still render).

---

# Phase 2 — Auth pages (✅ done)

Goal: real backend round-trip on login and register; per-page identity from
the auth context; logout from the sidebar.

## 2.1 LoginPage

- Replaced the `setTimeout` fake with `useAuth().login(email, password)`.
- On success, redirects to `location.state.from || '/dashboard'` — preserves
  the original target when a protected page bounced the user to login.
- On `ApiError`, surfaces the server's message as a top-of-form banner.
  Spring's `GlobalExceptionHandler` returns `401 { message: "Invalid email
  or password" }` for `BadCredentialsException`, and field-level errors as
  `{ errors: { field: message } }` for validation failures — the wrapper
  parses both.

**Explain it:** "Login does the round-trip through the same fetch wrapper
every other page uses. The form just consumes the error message the
controller already produces — no duplicated translation logic."

## 2.2 RegisterPage

- Replaced the `setTimeout` fake with `useAuth().register(fullName, email,
  password)`.
- Surfaces server-side messages such as "An account with this email already
  exists" (Spring throws `BadRequestException` → `400`).
- Field-level validation errors (e.g. password too short) populate the same
  per-input error map the page already had for client-side validation, so
  the UI shape never changed.

## 2.3 Sidebar

Rewritten to read from `useAuth()`:
- Displays the real user's full name and initials (no more hardcoded "AJ").
- Conditionally renders the "Admin" link only when `isAdmin === true`. This
  matches `<ProtectedRoute requireAdmin>` on the admin route.
- Adds a logout button — calls `logout()` and `navigate('/login')`.

**Explain it:** "The sidebar is the only place the user identity is rendered
across the app, so binding it to the auth context means every authenticated
page shows the right user automatically. No prop-drilling."

## 2.4 App.jsx — protect every authenticated route

All five user routes and `/admin` are now wrapped in `<ProtectedRoute>`
(admin additionally with `requireAdmin`). Public routes (Landing/Login/
Register) are unchanged.

## Phase 2 verification (live, against MongoDB)

Both servers boot cleanly:
- Spring Boot on 8080 (`Started LifeTrackApplication in 3.9s`).
- Vite on 5173 (`VITE v8.0.16 ready in 620 ms`).

Verified four backend round-trips with seeded user `alex@example.com /
Password123!`:

| Call | Result |
| --- | --- |
| `GET /api/health` | `{ "status": "UP" }` |
| `POST /api/auth/login` (correct) | JWT + user `Alex Morgan` (USER role) |
| `GET /api/auth/me` (Bearer JWT) | User echoed back |
| `POST /api/auth/login` (wrong password) | `401 { "message": "Invalid email or password" }` |
| `POST /api/auth/register` (duplicate email) | `400 { "message": "An account with this email already exists" }` |

That last one is the proof that error JSON flows through correctly: when the
register form catches the `ApiError`, it will display exactly that message.

**How to demo this in the interview:**
1. `seed-data.js` populates three demo users.
2. Log in as `alex@example.com / Password123!` → sidebar shows "Alex Morgan",
   no Admin link.
3. Log out → log in as `sam@example.com / Password123!` (admin) → Admin link
   appears, `/admin` accessible.
4. Try wrong password → server-rendered message appears under the form.

---

# Phase 3 — Data pages (✅ done)

Goal: every page reads/writes through the API; the polished UI is preserved.

## 3.1 Journal — full CRUD

- `useEffect` calls `journalApi.list()` on mount; entries render newest-first
  (backend already sorts by date desc).
- `Save Entry` → `journalApi.create({ date, mood, text })`; the response
  (with its server-generated id) is prepended to local state.
- `Update Entry` → `journalApi.update(id, ...)`; the same row is patched in
  place.
- Delete uses an **optimistic update with rollback**: remove from local
  state immediately, restore on error. Same pattern for Expenses.
- Inline loading/error states surface in the existing empty-state slot so
  the visual design doesn't shift.

**Explain it:** "Optimistic delete keeps the UI snappy. If the network
request fails I restore the snapshot and show the error — better than a
spinner gating the user."

## 3.2 Expenses — full CRUD

- Loads from `expenseApi.list()` (sorted desc by date on the server).
- Add / Edit / Delete map to POST / PUT / DELETE. The row carries an
  `isoDate` (raw `YYYY-MM-DD`) alongside the formatted `date` so editing an
  expense pre-populates the date picker correctly.
- Validation message + page error live in the same form-helper slots the
  page already used.

## 3.3 Daily Log — upsert by date

The original page had **no Save button** — it was an interactive form with
nowhere to commit. Added:

- Load-on-mount: fetch all logs, find today's (by `YYYY-MM-DD` match),
  pre-populate the form so the user keeps editing instead of overwriting.
- Single `Save Today's Log` action that POSTs the full daily-log payload.
  The backend's `POST /api/daily-logs` is an **upsert by `(userId, date)`**
  (the bug fix from earlier in the project), so one button works whether
  today's log exists or not.
- Replaced the page's local sidebar copy with the shared `<Sidebar />` so
  identity + logout are consistent.

**Explain it:** "The page was a form without a submit. I added Save, but the
real subtlety is the backend: `POST` is idempotent per `(userId, date)`, so
the UI never has to decide between create and update."

## 3.4 Analytics — real sleep, mock for the rest (honest trade-off)

`/api/analytics` returns weekly sleep, expenses by category, total spend,
mood counts, and journal count. The page has four charts:

| Chart | Source |
| --- | --- |
| Sleep Duration Line Chart | **Live** — `summary.weeklySleep` |
| Step Frequency Bar Chart | Mock — backend doesn't track steps yet |
| Habit Completion Donut | Mock — would need a new endpoint |
| Categorical Expense Comparison | Mock per-day; aggregated totals are on the dashboard donut instead |

I deliberately kept the mocked charts visible so the page doesn't lose
detail in a demo, but they're clearly identified in the code (`mockSleep`,
`mockExpenses`) so the next person knows what's real.

**Explain it:** "I prioritised correctness over coverage — the sleep chart
shows real data; the others would lie if I pretended they did. Adding the
missing endpoints is straightforward next work."

## 3.5 Dashboard — wired summary + live insights

- Weekly sleep bars derive from `summary.weeklySleep` (zero-state shows an
  empty week instead of an error).
- Financial donut derives from `summary.expensesByCategory`.
- The "LifeTrack News" card was **replaced** with a live **Insights** card
  rendering the rule-based output of `GET /api/insights`. The chip colour
  reflects severity (`positive` → success chip, `warning` → clay chip).
- Top-right shows the real user's name/initials from auth context.

## 3.6 Admin — gated and live

- The route is wrapped in `<ProtectedRoute requireAdmin>`; non-admins are
  bounced to `/dashboard`. The backend enforces the same with
  `.hasRole("ADMIN")`, so the gate is defence in depth.
- Stat cards now reflect `/api/admin/stats` (Total Users, Daily Logs,
  Journal Entries).
- New "Active Users" table renders `/api/admin/users` — name, email, role
  chip. Easy to extend with last-login or activity once the backend exposes
  it.
- Real admin name + logout in the sidebar.

## Phase 3 verification (live, against MongoDB)

End-to-end requests as the seeded users:

```
Alex login                 → JWT
GET /api/analytics         → weekly sleep + by-category breakdown
GET /api/insights          → 2 positive insights (Alex's data is healthy)
GET /api/expenses          → 7 entries
GET /api/journal           → 3 entries
GET /api/daily-logs        → 7 entries
POST /api/daily-logs       → upsert for today succeeds (id returned)
Sam (ADMIN) login          → JWT
GET /api/admin/stats       → 4 users, 22 logs, 8 journals
GET /api/admin/users       → 4 users
Alex → /api/admin/stats    → 403 Forbidden  ✅ role enforcement works
```

**How to demo this in the interview:**
1. Log in as `alex@example.com` → Dashboard shows real bar chart from
   Alex's 7 daily logs; donut shows his expense breakdown; Insights card
   shows two positive insights driven by his good sleep.
2. Go to Expenses → list is real; add an entry → it persists across
   refresh; edit → date pre-fills correctly; delete → row vanishes
   optimistically.
3. Go to Daily Log → today's existing log is pre-populated; tweak something
   → Save → reload the page, edit survives.
4. Log out, log in as `sam@example.com` → Admin link appears in sidebar →
   `/admin` shows live stats and the four-user table.
5. Try `/admin` as Alex (via URL bar) → Vue router redirects to dashboard;
   if you bypass that, the backend returns 403 anyway.

---

# Phase 4 — AI service (✅ done)

The AI integration is purely additive — the core app already works without it.

## 4.1 AI client

Added `aiApi` to `lib/api.js` pointing at `VITE_AI_BASE_URL`
(`http://localhost:8100`). Separate from the Spring client: no JWT, its own
error handling. Exposes `health()`, `chat(payload)`, `insights(payload)`.

## 4.2 Journal "AI Assistant" → POST /chat

- The chat panel's canned replies were removed. `sendMessage` now POSTs to
  `/chat` with: the query, a `LifestyleContext` built from the user's journal
  entries (`mood_counts`, `journal_excerpts`), a rolling 6-message `history`,
  the user's name, and `user_key`.
- If the AI service is unreachable, a graceful bubble explains it instead of
  crashing.

## 4.3 Dashboard "Insights" → POST /insights (opt-in)

- The Insights card has a "✨ AI" button. By default it shows Spring's
  rule-based insights (free, always available). Clicking the button calls the
  AI service with a context derived from `/api/analytics`, and swaps in the
  richer LLM insights — with a source label ("Generated by AI" vs "AI
  unavailable — showing rules"). This respects the project's
  "vectorize/AI is optional, save credits" requirement.

## 4.4 Bug found in testing — and fixed

**Symptom:** chat worked for short replies, then the assistant started
returning the "AI unavailable" fallback bubble mid-conversation.

**Root cause (from LM Studio logs):**
```
parse: error parsing grammar: number of repetitions exceeds sane defaults
reply ::= "\"" char{1,4000} "\"" space
failed to parse grammar
```
The `AiChatReply.reply` field had `max_length=4000`. When the JSON schema is
sent as a `json_schema` response-format, LM Studio compiles it to a GBNF
grammar, and `maxLength: 4000` becomes `char{1,4000}` — which exceeds
llama.cpp's repetition limit, so grammar compilation **fails**. The model
then emits free-form text instead of JSON, our Pydantic validation rejects
it, and the service falls back. (Insights were unaffected because their
message cap is 600, under the limit.)

**Fix:** `llm_client._grammar_safe_schema()` recursively strips
length/count/range constraints (`maxLength`, `minLength`, `maxItems`,
`pattern`, numeric bounds) from the schema **before** sending it as a
grammar. The grammar only needs the *structure*; our own
`schema.model_validate()` still enforces the real limits on the parsed
response. So the strict-JSON contract is preserved — the constraints just
move from the (fragile) grammar to (reliable) server-side validation.

**Bonus fix:** added `user_name` to the chat request + system prompt, so the
assistant can answer "what's my name?" and personalise replies.

**Verified after the fix:**
```
POST /chat (5-turn convo ending in "what is my name")
  → source=ai
  → reply: "Oh, I see! Your name is Alex Morgan. What's on your mind?"
  → suggestions: [...]
```
No more grammar-parse failures; `source=ai` is stable across long replies.

## 4.5 Lint pass

Cleaned all 16 lint errors introduced/exposed during the integration:
unused mock constants (`SLEEP_DATA`, `DONUT_SEGMENTS`, `NEWS`), unused icon
components and the `Link` import in DailyLogPage, dead helpers
(`formatDate`, `todayLabel`), and the `react-hooks` "setState synchronously
in effect" warnings (fixed by lazy-initialising loading flags instead of
calling `setLoading(true)` inside effects). `npm run lint` is clean.

## How to talk about Phase 4 in the interview

- "The AI layer is additive and degrades gracefully — if the FastAPI service
  or LM Studio is down, the Journal chat shows a friendly message and the
  Dashboard keeps showing Spring's rule-based insights."
- "The interesting bug was a grammar-compilation failure: a `maxLength: 4000`
  on the reply field blew past llama.cpp's GBNF repetition limit, silently
  disabling structured output. I fixed it by stripping length constraints
  from the grammar schema while keeping Pydantic validation on my side — so
  the strict-JSON guarantee held, the constraint just moved to where it's
  reliably enforced."
- "AI insights are opt-in per the privacy/credits requirement; rule-based is
  the always-on default."

---

## Final state

All four phases complete and verified end-to-end against MongoDB + LM Studio:

- React (5173) → Spring Boot (8080) → MongoDB: auth + all CRUD + analytics +
  admin, JWT-secured, role-gated.
- React (5173) → FastAPI (8100) → LM Studio: chat + insights, strict-JSON,
  rule-based fallback, optional local vector retrieval.

Run order for a demo: MongoDB → `backend` (mvnw spring-boot:run) →
`ai-service` (uvicorn, optional) → `frontend` (npm run dev). Seed with
`seed-data.js`; log in as `alex@example.com` / `Password123!`.

A `start-lifetrack.bat` in the repo root launches all four in their own
terminals and opens the browser.

---

## Troubleshooting log

### AI service "All connection attempts failed" when offline

**Symptom:** With Wi-Fi turned off (to demo fully-offline operation), the
Journal chat kept showing the "AI assistant is unavailable" fallback. The AI
service window logged:
```
Chat completion request failed at http://172.16.0.2:1234/v1/chat/completions:
All connection attempts failed
```
Yet LM Studio showed Status: Running, "Reachable at http://172.16.0.2:1234".

**Root cause:** `ai-service/.env` pointed `AI_BASE_URL` at `172.16.0.2` — the
machine's **Wi-Fi LAN IP**. That address only exists while the Wi-Fi adapter
is up (DHCP-assigned). Turning Wi-Fi off removed the interface, so the address
became unreachable. It worked during earlier development only because Wi-Fi
happened to be on.

**Fix:** point the AI service at LM Studio over **loopback**:
`AI_BASE_URL=http://localhost:1234/v1`. The loopback interface
(127.0.0.1/localhost) is always available regardless of network state, so a
same-machine call works fully offline. This is also the correct setup for the
project's "runs completely offline / no cloud" goal — there was never any
reason to route same-machine traffic through the LAN IP.

**Lesson / talking point:** "For an offline, single-machine stack, always use
`localhost` between local services. A LAN IP is tied to a network adapter and
vanishes when you go offline; loopback never does. The earlier LAN-IP config
was a latent bug that only surfaced the moment we actually demoed offline."

## How to talk about this in an interview

1. **Set the scene.** "Frontend was already fully designed but disconnected.
   The job was to wire it to a real Spring Boot backend without breaking the
   visual design."
2. **Show the seams.** "I introduced three tiny modules — `.env`,
   `lib/api.js`, `lib/auth.jsx` — and a `ProtectedRoute` wrapper. That's the
   integration surface. Everything else is unchanged UI."
3. **Justify the choices.** Centralised fetch wrapper for consistent error
   handling, token attachment, and 401 recovery. Context for auth so pages
   stay declarative. Layered rollout so each step is verifiable.
4. **Trade-offs you'd own up to.** `localStorage` for the JWT is the obvious
   one — fine for an SPA on a trusted device, but for a stricter app you'd
   want HttpOnly cookies. Sticking with `localStorage` here because the
   backend was designed around bearer tokens; switching would mean changing
   both sides.
5. **What's next.** Auth pages → data pages → AI service, with graceful
   degradation if the AI is offline.
