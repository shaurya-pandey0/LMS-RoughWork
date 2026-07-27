# LifeTrack — Backend Walkthrough & Team Split

**Purpose:** presentation plan for explaining the backend end-to-end to the
teacher. 23 REST endpoints across 8 controllers, split between 3 presenters so
that **each person owns a complete vertical slice** (HTTP request → security →
controller → DTO → service → repository → MySQL → response), not just one layer.

> Why vertical, not horizontal? If we split by layer ("you do controllers, you
> do services"), nobody can answer "what happens when I click Save?". Splitting
> by feature means each of us can trace a full request start-to-finish.

---

## 1. System at a glance

```
Browser (React, :5173)
      │  fetch + Authorization: Bearer <JWT>
      ▼
Spring Boot (:8080)
      │  SecurityFilterChain → JwtAuthenticationFilter → Controller
      │  Controller → Service → Repository (Spring Data JPA)
      ▼
MySQL (:3306)   schema: lifestyle_ai   (tables auto-created by Hibernate)

Browser ──► FastAPI AI service (:8100) ──► LM Studio (:1234, local LLM)
                                     └──► local vector store (TurboVec)
```

Two independent backends. Spring owns all persisted data; the FastAPI service
is stateless w.r.t. Spring and is optional — if it's off, the app still works.

### Tech stack (backend)
| Concern | Choice |
| --- | --- |
| Framework | Spring Boot 3.3.4, Java 17 |
| Web | Spring Web (`@RestController`) |
| Security | Spring Security + JWT (jjwt 0.12), stateless |
| Persistence | Spring Data JPA / Hibernate 6.5 → MySQL 8 |
| Validation | Jakarta Bean Validation (`@Valid`) |
| Docs | springdoc-openapi → Swagger UI |
| AI service | Python FastAPI + Pydantic, OpenAI-compatible client |

---

## 2. Endpoint inventory (23 total)

| Controller | Endpoints | Count | Auth |
| --- | --- | --- | --- |
| `AuthController` | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` | 3 | public / public / JWT |
| `DailyLogController` | `GET`, `POST`, `GET /{id}`, `PUT /{id}`, `DELETE /{id}` on `/api/daily-logs` | 5 | JWT |
| `ExpenseController` | same 5 shapes on `/api/expenses` | 5 | JWT |
| `JournalController` | same 5 shapes on `/api/journal` | 5 | JWT |
| `AnalyticsController` | `GET /api/analytics` | 1 | JWT |
| `InsightController` | `GET /api/insights` | 1 | JWT |
| `AdminController` | `GET /api/admin/stats`, `GET /api/admin/users` | 2 | JWT + `ROLE_ADMIN` |
| `HealthController` | `GET /api/health` | 1 | public |
| | **Total** | **23** | |

Plus the AI microservice (separate app, not in Swagger): `GET /health`,
`GET /models`, `POST /insights`, `POST /chat`, `POST /vectors/upsert`,
`POST /vectors/search`, `DELETE /vectors/{user_key}`.

---

## 3. How many pipelines do we have?

**7 distinct pipelines.** A "pipeline" = a different path a request takes
through the system. Memorise these 7; every endpoint falls into one.

| # | Pipeline | Entry points | What makes it different |
| --- | --- | --- | --- |
| **P1** | **Authentication & token issue** | `/auth/register`, `/auth/login` | Public. Password hashing (BCrypt) + JWT creation. No JWT on the way in. |
| **P2** | **Authenticated request (token validation)** | every protected endpoint | `JwtAuthenticationFilter` parses/validates the JWT and populates `SecurityContext` before the controller runs. |
| **P3** | **Write / CRUD** | `POST`/`PUT`/`DELETE` on daily-logs, expenses, journal | DTO validation → service → `repository.save()` → Hibernate `INSERT/UPDATE`. Includes the **upsert-by-date** special case. |
| **P4** | **Read / owner-scoped query** | `GET` list + `GET /{id}` on the 3 resources | Every query is filtered by the authenticated user's id (`findByUserId...`) so users can't read each other's rows. |
| **P5** | **Aggregation / analytics** | `GET /analytics` | Reads many rows, then groups/sums **in Java streams** to build a summary DTO. No entity is returned. |
| **P6** | **Rule-based insight engine** | `GET /insights` | Deterministic business rules over a 7-day window, thresholds injected from config. |
| **P7** | **Role-gated admin** | `/admin/stats`, `/admin/users` | System-wide (not user-scoped) + requires `ROLE_ADMIN`, enforced by `SecurityConfig`. |

Two **extra pipelines live in the AI microservice** (mention if asked):

| # | Pipeline | Entry | Notes |
| --- | --- | --- | --- |
| **P8** | AI insight / chat | `POST /insights`, `POST /chat` | Prompt → LLM → **Pydantic validation** → falls back to rules if invalid/unreachable. |
| **P9** | Local RAG / vector | `POST /vectors/upsert`, `/vectors/search` | Local Nomic embeddings → 4-bit TurboVec index, per-user folder. |

---

## 4. The layer chain (everyone must be able to draw this)

```
HTTP request
   │
   ├─ SecurityFilterChain            SecurityConfig.java
   │     └─ JwtAuthenticationFilter  validates token, sets SecurityContext
   │
   ├─ @RestController                controller/*.java     ← HTTP concerns only
   │     └─ @Valid  RequestDTO       dto/*Dtos.java         ← input contract
   │
   ├─ Service                        service/*.java         ← business logic
   │     └─ SecurityUtils.currentUserId()  ← who am I?
   │
   ├─ Repository (interface only!)   repository/*.java      ← Spring Data JPA
   │     └─ Hibernate generates SQL
   │
   ├─ Entity                         entity/*.java          ← table mapping
   │
   ▼
 MySQL   →  Entity  →  ResponseDTO  →  JSON
                        (never expose the entity directly)

Errors anywhere ──► GlobalExceptionHandler (@RestControllerAdvice) ──► clean JSON
```

**One-line rationale for each layer** (good exam answer):
- **Controller** — translates HTTP to method calls. No business logic.
- **DTO** — the API contract. Keeps entities out of the JSON so DB changes don't break clients, and hides fields like `password`.
- **Service** — the business rules + transaction boundary.
- **Repository** — we write only the *method name*; Spring Data generates the query at runtime.
- **Entity** — the ORM mapping to a table.

---

## 5. Team split — 3 vertical slices

Everyone must first know **Section 4 (layer chain)** and **Section 3 (the 7
pipelines)**. Then each person owns the deep detail below.

### 👤 Person A — "Identity & Access" (Pipelines P1, P2, P7)

**Endpoints (6):** `POST /auth/register`, `POST /auth/login`, `GET /auth/me`,
`GET /admin/stats`, `GET /admin/users`, `GET /health`

**Files to read:**
`AuthController`, `AuthService`, `SecurityConfig`, `JwtService`,
`JwtAuthenticationFilter`, `CustomUserDetailsService`, `UserPrincipal`,
`SecurityUtils`, `User`, `Role`, `UserRepository`, `AuthDtos`, `UserDto`,
`AdminController`

**Story to tell (register → login → protected call):**
1. `POST /register` → `AuthService.register()` → `existsByEmail` guard →
   **BCrypt** hash → `userRepository.save()` → issue JWT → return
   `{token, tokenType, user}`. Password is *never* returned (that's why `UserDto` exists).
2. `POST /login` → `AuthenticationManager.authenticate()` →
   `DaoAuthenticationProvider` → `CustomUserDetailsService.loadUserByUsername()`
   → BCrypt compare → JWT signed **HS384** with subject=email, claims `uid` + `role`, 24h expiry.
3. Any protected call → `JwtAuthenticationFilter` runs *before*
   `UsernamePasswordAuthenticationFilter`: reads `Authorization: Bearer`,
   validates signature+expiry, loads the user, sets `SecurityContext`.
   **Stateless** — no session, `SessionCreationPolicy.STATELESS`.
4. `/admin/**` → `.hasRole("ADMIN")`. Authority string is `ROLE_ADMIN`
   (`UserPrincipal` prefixes `ROLE_`), `hasRole` adds the prefix itself.

**Must be able to answer:**
- Why JWT instead of sessions? (stateless, scales, no server-side store)
- What's inside the token? (show a decoded payload; note it's **signed, not encrypted**)
- Why BCrypt not SHA-256? (slow + per-password salt → resists brute force)
- What happens if the token is tampered with? (signature check fails → 401)
- Where does CORS get configured, and why is it needed? (`SecurityConfig`, browser blocks :5173→:8080 otherwise)

---

### 👤 Person B — "Domain Data & Persistence" (Pipelines P3, P4)

**Endpoints (15 — the CRUD bulk):** all 5 on `/api/daily-logs`, all 5 on
`/api/expenses`, all 5 on `/api/journal`

**Files to read:**
`DailyLogController`/`Service`, `ExpenseController`/`Service`,
`JournalController`/`Service`, all 3 repositories, `DailyLog` (+`Meal`,
`MealListConverter`), `Expense`, `JournalEntry`, the 3 `*Dtos`,
`GlobalExceptionHandler`, `application.yml` (datasource + `ddl-auto`)

**Story to tell (one save, end to end):**
1. `POST /api/daily-logs` with JSON body → `@Valid @RequestBody DailyLogRequest`
   (a Java `record`). Validation failure → `MethodArgumentNotValidException` →
   handler returns `400` with a per-field `errors` map.
2. Controller calls `SecurityUtils.currentUserId()` — the user id comes from the
   **token**, never from the request body. (Security point: otherwise user 1
   could write rows for user 2.)
3. `DailyLogService.create()` → the **upsert**: `findByUserIdAndDate()`; if a
   log exists for that date, update it, else create. Backed by a DB
   `@UniqueConstraint(userId, date)`.
4. `repository.save()` → Hibernate emits `INSERT` or `UPDATE`.
5. Entity → `DailyLogResponse.from(...)` → JSON.

**The interesting mapping problem (your highlight):**
`DailyLog` has `List<Meal>`, and `Meal` itself holds `List<String> items`.
JPA can't nest an `@ElementCollection` inside an `@Embeddable`, so:
- habits (`List<String>`) → two **collection tables**
  (`daily_log_transactional_habits`, `daily_log_embedded_habits`)
- meals → a single **JSON `TEXT` column** via `MealListConverter`
  (`AttributeConverter`), keeping the API shape identical.

**Tables Hibernate creates:** `users`, `expenses`, `journal_entries`,
`daily_logs`, `daily_log_transactional_habits`, `daily_log_embedded_habits`.

**Must be able to answer:**
- How does `findByUserIdAndDateBetweenOrderByDateAsc` work with no SQL written? (Spring Data parses the method name → builds the query)
- What does `ddl-auto: update` do, and why is it risky in production? (mutates schema; prod should use Flyway/Liquibase)
- Why DTOs instead of returning entities? (contract stability, hide `password`, avoid lazy-loading serialisation issues)
- How do you stop user A reading user B's data? (every query is `...ByUserId...` + `findByIdAndUserId` for single fetch)
- What happens on a duplicate? (`DataIntegrityViolationException` → `409 Conflict` via the handler)

---

### 👤 Person C — "Derived Data & AI" (Pipelines P5, P6, + P8/P9)

**Endpoints (2 in Spring + the AI service):** `GET /api/analytics`,
`GET /api/insights`, and the FastAPI endpoints

**Files to read:**
`AnalyticsController`/`AnalyticsService`, `InsightController`/`InsightService`,
`InsightProperties`, `AnalyticsDtos`, `InsightDtos`, then
`ai-service/app/{main,schemas,llm_client,rules,prompts,embeddings}.py`,
`ai-service/app/vector/*`

**Story to tell:**
1. `GET /analytics` → `AnalyticsService.userAnalytics(userId)`: pulls the
   trailing 7 days of logs + all expenses + journals, then aggregates **in Java
   streams** — `Collectors.groupingBy(Expense::getCategory,
   Collectors.summingDouble(...))`, mood counts via `counting()`. Returns
   `UserAnalyticsResponse` (weeklySleep, expensesByCategory, totalExpenses,
   moodCounts, journalEntryCount).
   *Trade-off to mention:* aggregating in Java is simpler and DB-agnostic, but a
   `GROUP BY` in SQL would scale better — correct next step.
2. `GET /insights` → `InsightService`: 5 deterministic rules (sleep, spending,
   habit consistency, hydration, mood) over 7 days. Thresholds are **not
   hardcoded** — injected via `@ConfigurationProperties("app.insights")`, so
   they're tunable by env var. Rules stay silent when data is missing; if
   nothing fires, a friendly "not enough data" insight is returned.
3. **AI service (separate process):** Spring's rule engine is the always-on
   default; the FastAPI service adds LLM insights + chat. Strict JSON at every
   boundary via **Pydantic**; if the model returns anything invalid, it falls
   back to the same deterministic rules. Runs fully offline against LM Studio.
4. **Vector/RAG (optional):** journal text → local Nomic embeddings →
   compressed to 4-bit by TurboVec → per-user in-RAM index, so chat retrieves
   only the top-k relevant snippets instead of re-reading everything.

**Must be able to answer:**
- Why have rule-based insights at all when you have an LLM? (deterministic, instant, free, works offline; LLM is the optional upgrade)
- Where do the thresholds come from? (config, not magic numbers)
- How do you guarantee the LLM returns usable data? (JSON-schema request + Pydantic validation + rules fallback)
- Why is the AI a separate service? (different language/runtime, independent scaling, failure isolation — Spring keeps working if it dies)

---

## 6. Cross-cutting topics — **all three must know**

| Topic | Where | One-liner |
| --- | --- | --- |
| Layered architecture | whole `com.lifetrack` tree | controller → service → repository → entity, DTOs at the edge |
| Dependency injection | every `@Service`/`@RestController` | constructor injection; no `new`, Spring owns object lifecycle |
| Global error handling | `GlobalExceptionHandler` | `@RestControllerAdvice` maps exceptions → consistent JSON (`404/400/401/403/409`) |
| Validation | `dto/*` + `@Valid` | fail fast at the boundary with field-level messages |
| Stateless security | `SecurityConfig` | no sessions; every request re-authenticates from the JWT |
| Config externalisation | `application.yml` | `${ENV_VAR:default}` everywhere → same jar, different environments |
| Swagger/OpenAPI | springdoc | docs generated from the code, so they can't drift |

---

## 7. Suggested 15-minute demo order

1. **(A)** `GET /api/health` — prove it's up. Then `POST /auth/register` in
   Swagger → show the returned JWT → paste into **Authorize**.
2. **(A)** `GET /auth/me` — proves the token identifies the user.
   Then hit `/admin/stats` as a normal user → **403**, explaining role gating.
3. **(B)** `POST /api/expenses` → `GET /api/expenses`. Show the new row in
   MySQL (`SELECT * FROM expenses;`) to close the loop to the database.
4. **(B)** `POST /api/daily-logs` twice with the same date → still one row.
   Explain the unique constraint + upsert. Show the habit collection tables and
   the meals JSON column.
5. **(C)** `GET /api/analytics` → point out the numbers came from the rows just
   created. Then `GET /api/insights` → show a rule firing because of that data.
6. **(C)** (optional) FastAPI `/docs` → `POST /chat` with LM Studio, note the
   Pydantic validation + rule fallback, and that it works with Wi-Fi off.

Closing line: *"Same request path every time — filter, controller, DTO,
service, repository, MySQL — and the only things that differ are the 7
pipelines we just showed."*

---

## 8. Likely teacher questions (rapid fire)

| Question | Owner | Short answer |
| --- | --- | --- |
| Why Spring Boot? | any | Auto-config, embedded server, huge ecosystem, DI/AOP built in |
| Difference: `@Controller` vs `@RestController`? | any | `@RestController` = `@Controller` + `@ResponseBody` → returns data, not views |
| Where's the SQL? | B | Nowhere written by hand — Spring Data derives it from method names; Hibernate generates DDL/DML |
| Is the JWT encrypted? | A | No — signed. Anyone can read the payload; nobody can forge it without the secret |
| How is the password stored? | A | BCrypt hash with per-password salt; never reversible, never returned |
| What if two users log the same date? | B | Constraint is `(userId, date)`, so both can log the same day — isolation is per user |
| Why MySQL over MongoDB (we migrated)? | B | Relational integrity, real constraints/FKs, SQL aggregation; we swapped entities to JPA and Hibernate created the schema |
| What happens if the AI service is down? | C | Rule-based insights still serve; chat shows a graceful message — no crash |
| How would you scale this? | any | Stateless JWT → run N instances behind a load balancer; move aggregation into SQL; add caching/indexes |
| What's missing / next? | any | Refresh tokens, Flyway migrations, unit + integration tests, pagination, SQL-side aggregation, secrets out of `application.yml` |

---

## 9. Known weak spots — better to own them than get caught

Saying these *before* being asked reads as maturity:

1. **`ddl-auto: update`** is convenient for dev, wrong for production — should be Flyway/Liquibase migrations.
2. **DB password + JWT secret sit in `application.yml`** — should be env vars / a secrets manager.
3. **No automated tests yet** — the whole thing was verified manually via Swagger/HTTP; unit tests for services and `@WebMvcTest` for controllers are the obvious next step.
4. **Aggregation happens in Java, not SQL** — fine at this data size, wouldn't scale.
5. **No pagination** on list endpoints — `GET /api/expenses` returns everything.
6. **No refresh tokens** — a 24h JWT can't be revoked before it expires.
