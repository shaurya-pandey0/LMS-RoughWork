# LifeTrack — Phase 3 Backend Walkthrough and Team Split

**Purpose:** present the current Spring Boot backend end-to-end and divide it
between three presenters using complete vertical slices. Each presenter should
be able to trace:

```text
React action → HTTP request → Spring Security → controller → DTO → service
→ repository/JPA → MySQL → response DTO → HTTP response → React state → UI
```

CSS, component markup, chart geometry, colors and React's internal rendering
algorithm are presentation details. They are not part of the API pipeline.

> This document reflects the current Phase 3 scope: Spring Boot and MySQL are
> the stable application backend. Python AI, RAG, embeddings and LM Studio are
> deliberately parked for Phase 4. Spring AI is not used or planned.

---

## 1. Current status and scope decisions

### Backend-separation plan

| # | Work item | Current status | Phase 3 decision |
| --- | --- | --- | --- |
| 1 | `/api/reference` plus server-side category/mood validation | Complete: backend and frontend wired | Present |
| 2 | `/api/daily-logs/today` and targeted daily-log queries | Complete: backend and frontend wired | Present |
| 3 | `UserSettings` plus `/api/settings` | Complete: backend and frontend wired | Present |
| 4 | `/api/ai-context` | Complete: backend and frontend call sites wired | Present as the Phase 4 seam, not as AI inference |
| 5 | Dedicated `/api/dashboard/summary` | Not implemented | Intentionally skipped; current APIs are sufficient |
| 6 | Pagination for expenses/journals | Not implemented | Deferred scalability work |
| 7 | `stepsActual` and new analytics endpoints | Not implemented | Deferred; do not invent data |
| 7a | Remove seeded/random/hardcoded application metrics | In cleanup | Required before the demo |

Steps 1–4 achieve the original architectural goal: React is primarily a
presentation client, while Spring owns persisted facts, validation, settings,
domain vocabulary and trusted aggregation.

### “Real data only” rule

Every value presented as user, health, analytics or admin data must come from:

1. a real Spring Boot endpoint; and
2. persisted MySQL records, or a backend calculation derived from those
   records.

Allowed in the frontend:

- colors, labels and icons;
- date/number formatting;
- CSS and responsive layout;
- mapping response data into components;
- SVG coordinates and percentages used only to draw a chart.

Not allowed:

- seeded or random metrics;
- hardcoded values that pretend to be user/admin/health data;
- fallback arrays that look like real analytics;
- constructing trusted business context in the browser.

If real data does not exist, remove the visualization or display a clear
loading, error or “No data available yet” state.

### Work intentionally excluded

- No dedicated dashboard-summary endpoint for this phase.
- No pagination/date-filter expansion beyond the daily-log filters already
  implemented.
- No component-library or reusable “mini-Bootstrap” extraction is required.
- No Python/FastAPI, RAG, embeddings, LM Studio or Spring AI work in Phase 3.
- No new endpoint solely to preserve a fake visualization.

---

## 2. System at a glance

### Phase 3 system being presented

```text
Browser: React (:5173)
      │  fetch + JSON + Authorization: Bearer <JWT>
      ▼
Spring Boot (:8080)
      │  SecurityFilterChain → JwtAuthenticationFilter
      │  Controller → DTO → Service → Repository/JPA
      ▼
MySQL (:3306)
schema: lifestyle_ai
      │
      └── saved entity/aggregate → response DTO → JSON → React state → UI
```

React never accesses MySQL directly. React and Spring do not call each other
like local functions; the boundary is an HTTP contract such as:

```text
POST http://localhost:8080/api/expenses
```

### Phase 4 seam — implemented now, consumed later

```text
React or future application flow
      │ authenticated request
      ▼
Spring GET /api/ai-context?days=7
      │ owner-scoped MySQL queries + trusted aggregation
      ▼
Future Python service
      │ RAG / embeddings / LLM reasoning
      ▼
Generated AI result
```

`/api/ai-context` is an ordinary Spring endpoint. It performs no AI inference
and does not mean the project uses Spring AI. It prevents a future Python
service from owning CRUD rules or accepting an arbitrary browser-supplied user
identity.

### Backend technology

| Concern | Current choice |
| --- | --- |
| Language/runtime | Java 17 |
| Framework | Spring Boot 3.3.4 |
| HTTP | Spring Web and `@RestController` |
| Security | Spring Security, stateless JWT, BCrypt |
| Persistence | Spring Data JPA / Hibernate 6.5 |
| Database | MySQL, schema `lifestyle_ai` |
| Validation | Jakarta Bean Validation and `@Valid` |
| API documentation | springdoc-openapi 2.6.0 and Swagger UI |
| Monitoring | Spring Boot Actuator, metrics and Prometheus endpoint |
| AI for Phase 3 | None; Python work is parked |

---

## 3. Current endpoint inventory — 28 operations, 11 controllers

| Controller | Operations | Count | Access |
| --- | --- | ---: | --- |
| `AuthController` | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` | 3 | first two public; `/me` requires JWT |
| `ExpenseController` | list, get by ID, create, update, delete on `/api/expenses` | 5 | JWT, owner-scoped |
| `JournalController` | list, get by ID, create, update, delete on `/api/journal` | 5 | JWT, owner-scoped |
| `DailyLogController` | list/query, get by ID, create/upsert, update, delete, `GET /today` | 6 | JWT, owner-scoped |
| `UserSettingsController` | `GET /api/settings`, `PUT /api/settings` | 2 | JWT, owner-scoped |
| `ReferenceController` | `GET /api/reference` | 1 | JWT |
| `AnalyticsController` | `GET /api/analytics` | 1 | JWT, owner-scoped aggregation |
| `InsightController` | `GET /api/insights` | 1 | JWT, owner-scoped rules |
| `AiContextController` | `GET /api/ai-context?days=` | 1 | JWT, owner-scoped aggregation |
| `AdminController` | `GET /api/admin/stats`, `GET /api/admin/users` | 2 | JWT plus `ROLE_ADMIN` |
| `HealthController` | `GET /api/health` | 1 | public |
|  | **Total** | **28** |  |

`GET /api/daily-logs` supports three read modes without creating extra Swagger
operations:

- no parameters: all logs for the current user;
- `?date=YYYY-MM-DD`: zero or one record returned as a list;
- `?from=YYYY-MM-DD&to=YYYY-MM-DD`: an owner-scoped date range.

`GET /api/daily-logs/today` returns `200` with today's record or `204 No
Content` when no record exists.

---

## 4. The request pipeline everyone must be able to draw

```text
HTTP request
   │
   ├─ SecurityFilterChain
   │    └─ JwtAuthenticationFilter
   │         validates signature/expiry, loads user, sets SecurityContext
   │
   ├─ @RestController
   │    ├─ maps HTTP method + URL
   │    └─ @Valid Request DTO
   │
   ├─ Service
   │    ├─ receives SecurityUtils.currentUserId()
   │    ├─ enforces business/domain rules
   │    └─ orchestrates repositories
   │
   ├─ Spring Data repository
   │    └─ Hibernate derives/generates SQL
   │
   ├─ Entity ↔ MySQL table
   │
   ▼
saved Entity or aggregate
   → Response DTO
   → Spring/Jackson serializes JSON
   → HTTP status + body
   → api.js parses JSON
   → React updates state
   → UI re-renders

Exception
   → GlobalExceptionHandler or Spring Security
   → consistent 400/401/403/404/409 response
```

One-line responsibility of each layer:

- **React page:** collects input, calls the API and renders the returned state.
- **Frontend `api.js`:** owns HTTP mechanics, JWT header, JSON parsing and
  frontend API errors.
- **Controller:** maps HTTP to Java calls and selects the response status.
- **Request DTO:** defines and validates the incoming API contract.
- **Service:** owns domain validation and use-case orchestration.
- **Repository:** exposes persistence operations; Spring Data implements them.
- **Entity:** maps Java fields to database tables/columns.
- **Response DTO:** defines exactly what is returned; entities are not exposed.

### Example: Create Expense

```text
ExpensesPage.handleSubmit()
→ expenseApi.create(payload)
→ POST /api/expenses with JWT and JSON
→ JwtAuthenticationFilter
→ ExpenseController.create(@Valid ExpenseRequest)
→ ExpenseService.create(currentUserId, request)
→ validate category against ReferenceProperties
→ ExpenseRepository.save(Expense)
→ Hibernate INSERT into expenses
→ MySQL generates ID
→ ExpenseResponse
→ HTTP 201 Created + JSON
→ api.js
→ setTxns(...)
→ expense appears in the UI
```

The CSS classes used by the expense card/table are deliberately outside this
pipeline.

---

## 5. Nine request paths to understand

Every current endpoint is a variation of these paths.

| # | Pipeline | Entry points | Distinguishing behavior |
| --- | --- | --- | --- |
| **P1** | Authentication/token issue | register, login | Public input; BCrypt and JWT creation; no incoming JWT |
| **P2** | JWT authentication | every protected endpoint | Filter validates token and establishes the current user before the controller |
| **P3** | Owner-scoped CRUD write | POST/PUT/DELETE for expenses, journal, daily logs | DTO validation, service rules, JPA write; daily-log POST includes upsert-by-date |
| **P4** | Owner-scoped CRUD read | list and get-by-ID endpoints | Queries always include the authenticated user ID |
| **P5** | Targeted daily-log read | `/daily-logs/today`, `?date=`, `?from=&to=` | Database performs the targeted lookup instead of React fetching everything |
| **P6** | Domain reference/config | `/reference` | Backend supplies categories, habits and moods; write services enforce matching values |
| **P7** | Per-user settings | GET/PUT `/settings` | Defaults are persisted on first read; later updates use the same user row |
| **P8** | Derived data | `/analytics`, `/insights`, `/ai-context` | Owner-scoped rows become aggregate DTOs or deterministic rules, not entities |
| **P9** | Role-gated administration | `/admin/stats`, `/admin/users` | System-wide data and `ROLE_ADMIN` authorization |

P2 is cross-cutting: a request such as `POST /api/expenses` passes through both
P2 and P3.

---

## 6. The four completed backend seams

### A. `/api/reference`

Spring is now the source of truth for:

- expense categories;
- transactional and embedded habit catalogs;
- journal moods;
- daily-log moods.

`ExpenseService`, `JournalService` and `DailyLogService` reject unknown values
with `400 Bad Request`. React uses the returned lists to render controls, while
colors and icons remain frontend presentation choices.

### B. `/api/daily-logs/today` and date queries

The frontend no longer downloads all logs and filters them to find today's
record. The database lookup is owner-scoped, and the HTTP response distinguishes
“found” (`200`) from “not created yet” (`204`).

### C. `/api/settings`

`UserSettingsService.getOrCreate(userId)` persists one settings row per user.
The current fields are:

- monthly budget;
- sleep target hours;
- step target;
- water target in millilitres.

These values are not frontend constants. `PUT /api/settings` validates positive
targets and persists changes.

### D. `/api/ai-context`

The endpoint accepts an optional `days` window and aggregates owner-scoped:

- average sleep;
- spending and category totals;
- average water intake;
- habit consistency;
- mood counts;
- a bounded number of recent journal excerpts;
- the configured rule thresholds.

The current user's ID comes from Spring Security, never from a browser-provided
`user_key`. This is the stable Phase 4 boundary: Spring supplies trusted facts;
future Python is free to perform RAG or other AI reasoning.

---

## 7. Persistence model worth explaining

Hibernate currently manages these application tables:

- `users`
- `user_settings`
- `expenses`
- `journal_entries`
- `daily_logs`
- `daily_log_transactional_habits`
- `daily_log_embedded_habits`

`DailyLog` demonstrates three useful persistence patterns:

1. `(userId, date)` has a unique constraint, enabling one log per user per day.
2. Habit lists use `@ElementCollection` collection tables.
3. Meals use `MealListConverter` to persist the nested list as JSON in a
   `TEXT` column because nested element collections are not supported directly.

`repository.save(entity)` is where JPA/Hibernate issues the SQL write. For
identity-generated IDs, MySQL generates the ID and Hibernate returns it on the
saved entity.

---

## 8. Team split — three vertical slices

The endpoint counts are intentionally unequal; complexity and presentation time
are more important than raw counts. Everyone must understand Sections 2–5.

### Person A — Identity, configuration and privileged access

**Endpoints (9):**

- auth register/login/me;
- settings GET/PUT;
- reference GET;
- admin stats/users;
- health GET.

**Primary files:**

`AuthController`, `AuthService`, `SecurityConfig`, `JwtService`,
`JwtAuthenticationFilter`, `CustomUserDetailsService`, `UserPrincipal`,
`SecurityUtils`, `UserSettingsController`, `UserSettingsService`,
`ReferenceController`, `ReferenceProperties`, `AdminController`,
`HealthController`, related DTOs/entities/repositories.

**Story:**

1. Registration checks email uniqueness, hashes the password with BCrypt,
   persists the user and returns a signed JWT plus `UserDto`.
2. Login delegates credential checking to Spring Security and returns a new
   token.
3. A protected request is authenticated by the JWT filter before its
   controller executes.
4. `/settings` proves authenticated per-user configuration persistence.
5. `/reference` demonstrates config-owned domain vocabulary.
6. `/admin/**` demonstrates role authorization; health demonstrates a public
   operational endpoint.

**Must answer:**

- Why JWT is signed rather than encrypted.
- Why passwords use BCrypt.
- Why `userId` comes from the security context.
- Why CORS is required between ports 5173 and 8080.
- Difference between authentication (`401`) and authorization (`403`).
- How first-read settings defaults become a real MySQL row.

### Person B — Domain CRUD and persistence

**Endpoints (16):**

- five expense operations;
- five journal operations;
- six daily-log operations, including `/today`.

**Primary files:**

the three domain controllers/services/repositories, `DailyLog`, `Meal`,
`MealListConverter`, `Expense`, `JournalEntry`, domain DTOs,
`GlobalExceptionHandler`, `ReferenceProperties` and `application.yml`.

**Story:**

1. Trace Create Expense fully from React through `POST /api/expenses`, category
   validation, JPA/MySQL and `201 Created` back to React.
2. Demonstrate that user identity comes from JWT rather than request JSON.
3. Trace daily-log POST as an upsert protected by `(userId, date)`.
4. Demonstrate `/daily-logs/today` or `?date=` as a targeted database query.
5. Explain owner-scoped repository methods such as `findByIdAndUserId`.
6. Explain habit collection tables and the meals JSON converter.

**Must answer:**

- How Spring Data derives queries from repository method names.
- Why DTOs are preferred over returning entities.
- How one user is prevented from reading another user's rows.
- How `@Valid` differs from service-level category/mood validation.
- How unique-constraint failures become `409 Conflict`.
- Why `ddl-auto: update` is convenient for development but unsuitable for
  production migrations.

### Person C — Derived data and the future AI boundary

**Endpoints (3):**

- `GET /api/analytics`;
- `GET /api/insights`;
- `GET /api/ai-context?days=`.

**Primary files:**

`AnalyticsController`, `AnalyticsService`, `AnalyticsDtos`,
`InsightController`, `InsightService`, `InsightProperties`, `InsightDtos`,
`AiContextController`, `AiContextService`, `AiContextDtos` and the three domain
repositories.

**Story:**

1. `/analytics` reads owner-scoped rows and produces weekly sleep, expense
   totals by category, total expenses, mood counts and journal count.
2. `/insights` runs deterministic rules using thresholds externalized through
   `InsightProperties`.
3. `/ai-context?days=7` proves the date window changes the aggregated result
   and demonstrates the contract future Python can consume.
4. Clearly state that no Python or LLM is required for any Phase 3 endpoint.

**Must answer:**

- Why aggregation belongs behind an endpoint instead of inside a chart
  component.
- Why Java-stream aggregation is acceptable now and SQL `GROUP BY` may scale
  better later.
- Why deterministic insights are useful without an LLM.
- Why `/api/ai-context` is not Spring AI.
- Why Python should consume trusted context rather than own CRUD or accept an
  arbitrary `user_key`.

---

## 9. Suggested 15-minute demonstration

1. **Identity:** call `GET /api/health`, register/login, copy the JWT into
   Swagger's Authorize dialog, then call `/api/auth/me`.
2. **Reference validation:** call `/api/reference`; submit an invalid expense
   category and show `400`; submit a valid expense and show `201`.
3. **Database round trip:** call `GET /api/expenses`, then show the inserted row
   in MySQL. Explain JPA-generated SQL and the response DTO.
4. **Daily-log targeting:** call `/api/daily-logs/today` before and after
   creating today's log. Optionally post the same date twice to demonstrate
   upsert and the unique constraint.
5. **Settings:** call `GET /api/settings` to create defaults, `PUT` new values,
   then `GET` again to prove persistence.
6. **Derived data:** call `/api/analytics` and `/api/insights`; connect their
   values to the records created earlier.
7. **Future seam:** call `/api/ai-context?days=7`, then a different window.
   Explain that Spring produces trusted context and Python is intentionally
   postponed.
8. **Authorization:** call `/api/admin/stats` as a normal user and show `403`,
   or demonstrate it with an admin token if available.

Closing line:

> React collects and renders; Spring authenticates, validates, applies domain
> rules and owns the data; JPA persists it in MySQL; Python remains an optional
> Phase 4 consumer of trusted Spring context.

---

## 10. Definition of done before the presentation

### Complete

- [x] Reference endpoint is wired into React.
- [x] Expense and mood values are validated server-side.
- [x] Daily-log today/date lookup is implemented and wired.
- [x] Settings defaults persist and updates survive a second GET.
- [x] AI context uses the authenticated user and respects the `days` window.
- [x] CRUD requests have been exercised against real MySQL.
- [x] Swagger exposes the current 28 operations.

### Required final cleanup

- [ ] Remove/replace seeded random charts in `AnalyticsPage`.
- [ ] Remove/replace `HABIT_SEGMENTS` if it is not API-backed.
- [ ] Remove/replace hardcoded dashboard Stress/Hydration/Heart Rate metrics.
- [ ] Remove/replace Admin `FUNNEL`, fallback `STAT_CARDS` and seeded charts
      unless their values come from `/api/admin/stats`.
- [ ] Use honest loading/error/empty states where no backend data exists.
- [ ] Search the frontend once more for fake application metrics.
- [ ] Run frontend lint and production build after the cleanup.
- [ ] Smoke-test the Swagger demo sequence against MySQL.

### Explicitly deferred

- [ ] Pagination for unbounded expense/journal lists.
- [ ] SQL-side aggregation.
- [ ] Flyway/Liquibase migrations.
- [ ] Refresh tokens and revocation.
- [ ] New dashboard-summary or steps-actual endpoints.
- [ ] Python service authentication and Phase 4 AI/RAG work.

---

## 11. Likely questions and concise answers

| Question | Answer |
| --- | --- |
| How do React and Spring communicate? | The browser sends JSON over HTTP using `fetch`; Spring maps the method/path and returns status plus JSON. |
| Does React access MySQL? | No. Only Spring repositories/JPA access MySQL. |
| Where is the SQL? | Hibernate generates writes and Spring Data derives most queries from repository method names. |
| Where does business logic live? | Spring services and configuration properties; React keeps interaction and presentation transformations. |
| Why can React still calculate chart coordinates? | That changes how facts are drawn, not what the business facts are. |
| How is user isolation enforced? | JWT establishes the current user; repository queries include that user ID. |
| Why both DTO validation and service validation? | DTO constraints validate shape/range; services validate domain membership and use-case rules. |
| Is `/api/ai-context` an AI endpoint? | It is a trusted aggregation endpoint for a future AI consumer; it performs no model inference. |
| Why not Spring AI? | Phase 4 AI will use a separate Python service; Spring remains the stable CRUD/domain backend. |
| What happens when data is absent? | The API returns an empty/204 result as designed and React renders an honest empty state, never invented metrics. |
| Why no pagination yet? | It is acknowledged scalability work, intentionally deferred from the Phase 3 architecture goal. |
| Why Java aggregation rather than SQL? | Simpler and sufficient for the current data size; SQL aggregation is a known scaling improvement. |
| Why JWT instead of sessions? | Stateless requests are simple to scale and do not require a server-side session store. |
| Is JWT encrypted? | No. It is signed; the payload is readable but cannot be altered without invalidating the signature. |

---

## 12. Known limitations — state them confidently

1. `ddl-auto: update` is appropriate for local development, not controlled
   production schema evolution; use Flyway or Liquibase later.
2. The local datasource password is written directly in `application.yml`;
   it must move to environment variables or a secret manager before deployment.
3. The JWT development default must be overridden in production.
4. There are no backend automated tests in the current repository; add service,
   controller and MySQL integration tests.
5. Expense and journal list endpoints are unpaginated.
6. Analytics currently aggregates some full lists in Java; move heavy
   aggregation to SQL as data volume grows.
7. JWTs have no refresh/revocation mechanism.
8. Actuator endpoints are public for local Prometheus use and must be restricted
   before public deployment.
9. The Python service is out of Phase 3 scope and remains unauthenticated; it
   must not be publicly exposed or trusted with arbitrary browser user IDs.
10. Fake frontend metrics are unacceptable for the final demo and must be
    removed or replaced with honest empty states.

Owning these limitations demonstrates architectural judgment. None changes the
core Phase 3 result: the Spring/MySQL API is the source of truth, React is its
presentation client, and the future Python AI layer remains replaceable.
