# LifeTrack - Current Project Overview

Verified against the repository on **28 July 2026**.

This document describes what is implemented now. It replaces the older
MongoDB-era overview and keeps the Phase 3 backend scope separate from the
optional Python AI work intended for Phase 4.

## 1. Project in one paragraph

LifeTrack is a multi-user lifestyle tracking application. Users authenticate
with JWT, record one daily log per calendar date, manage expenses and journal
entries, configure personal targets, view real MySQL-backed sleep and spending
summaries, and receive deterministic Spring Boot insights. Administrators can
view system counts and registered users.

The stable Phase 3 architecture is:

```text
React presentation
        |
        | HTTP + JWT
        v
Spring Security + REST controllers + DTOs
        |
        v
Services: validation, ownership, rules and aggregation
        |
        v
Spring Data JPA / Hibernate
        |
        v
MySQL
```

The separate FastAPI service is an optional Phase 4 prototype. It is not Spring
AI and is not required for the Phase 3 CRUD application.

---

## 2. Repository layout

```text
lms-frontend-backend-springboot/
|-- backend/                 Spring Boot + JPA + MySQL API
|-- frontend/                React + Vite single-page application
|-- ai-service/              Optional FastAPI/LLM/vector prototype
|-- monitoring/              Prometheus and Grafana local Docker setup
|-- UI/                      Approved screens and LifeTrack design system
|-- docs/                    Architecture, presentation and audit notes
|-- API Create Expense/      Create-expense pipeline walkthrough
|-- start-lifetrack.bat      Windows setup and launcher
|-- start-lifetrack.sh       macOS/Linux setup and launcher
|-- integration.md          Historical integration journal
|-- initial promise.md       Original academic project promise
`-- PROJECT-OVERVIEW.md      Current-state reference (this file)
```

Main development ports:

| Process | Default address |
|---|---|
| React/Vite | `http://localhost:5173` |
| Spring Boot API | `http://localhost:8080` |
| MySQL | `localhost:3306` |
| FastAPI (optional) | `http://127.0.0.1:8100` |
| LM Studio/provider (optional local default) | `http://localhost:1234/v1` |
| Prometheus (optional) | `http://localhost:9090` |
| Grafana (optional) | `http://localhost:3000` |

---

## 3. Verification state

The following checks were run while updating this document:

| Module | Verification | Result |
|---|---|---|
| Backend | Maven offline compile using the local Maven repository | `BUILD SUCCESS`; 55 Java source files |
| Frontend | `npm.cmd run lint` | Clean |
| Frontend | `npm.cmd run build` | Success; 48 modules transformed |
| AI service | `python -m compileall -q app` | Success |
| Tests | Repository search | No JUnit, frontend unit, or Python test suite found |

This pass did **not** start MySQL, exercise live HTTP requests, call an LLM, or
start Prometheus/Grafana. Those require the local services to be running.

---

## 4. Backend

### 4.1 Stack

- Java 17
- Spring Boot 3.3.4
- Spring Web
- Spring Security
- Spring Validation
- Spring Data JPA / Hibernate
- MySQL Connector/J
- JJWT 0.12.6
- springdoc OpenAPI 2.6.0
- Spring Boot Actuator
- Micrometer Prometheus registry

Artifact:

```text
com.lifetrack:lifetrack-backend:0.0.1-SNAPSHOT
```

The `pom.xml` description still says MongoDB, but the dependency and
implementation use JPA and MySQL. See the documentation-drift section below.

### 4.2 Package responsibilities

| Package | Responsibility |
|---|---|
| `config` | Security, CORS, JWT, rule thresholds and reference vocabulary |
| `controller` | REST endpoints and HTTP status handling |
| `dto` | Validated request and response contracts |
| `service` | Ownership, validation, upsert rules, aggregation and insights |
| `repository` | Spring Data JPA repositories |
| `entity` | MySQL/JPA entities and the meals JSON converter |
| `security` | JWT filter, token service, current-user resolution |
| `exception` | Consistent API errors and validation responses |

The main request path is:

```text
Controller -> DTO validation -> Service -> JPA repository -> MySQL
```

### 4.3 Security model

- Stateless JWT authentication; no server session.
- BCrypt password hashes.
- The JWT filter runs before Spring's username/password filter.
- CSRF is disabled for the stateless JSON API.
- CORS origins come from `app.cors.allowed-origins`.
- User-facing services obtain the user ID from the authenticated JWT through
  `SecurityUtils.currentUserId()`.
- Resource lookups use both record ID and user ID, preventing one normal user
  from reading or changing another user's records.
- `/api/admin/**` requires the `ADMIN` role. A normal or unauthenticated Swagger
  request to an admin endpoint correctly returns `403`.

Public endpoints:

```text
/api/auth/**
GET /api/health
/v3/api-docs/**
/swagger-ui/**
/swagger-ui.html
/actuator/**
```

Everything else requires a valid bearer token.

### 4.4 MySQL configuration

Current local configuration in `backend/src/main/resources/application.yml`:

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/lifestyle_ai?createDatabaseIfNotExist=true
    username: root
    password: "1234"
  jpa:
    hibernate:
      ddl-auto: update
```

Hibernate creates or updates the schema when the backend starts. This is
convenient for local development, but migrations should replace `ddl-auto:
update` before a serious deployment.

### 4.5 Current tables

The `lifestyle_ai` database has seven application tables:

| Table | Purpose |
|---|---|
| `users` | Account, BCrypt password, role and creation time |
| `user_settings` | One settings row per user |
| `daily_logs` | One daily record per user and calendar date |
| `daily_log_transactional_habits` | Habit values linked to a daily log |
| `daily_log_embedded_habits` | Second habit collection linked to a daily log |
| `expenses` | User-owned dated expense rows |
| `journal_entries` | User-owned dated journal entries |

Important persistence details:

- IDs are MySQL auto-incrementing `BIGINT` values.
- `users.email` is unique.
- `user_settings.user_id` is unique.
- `daily_logs` has a unique `(user_id, date)` constraint.
- Daily-log habit lists use two collection tables.
- Meals are stored as JSON in the `daily_logs.meals` `TEXT` column through
  `MealListConverter`.
- Expenses and journal entries have indexes for user and user/date access.
- Entities store numeric `userId` values rather than a JPA `User` relationship.

### 4.6 Daily-log invariant

A user has at most **one daily-log row for a date**.

`POST /api/daily-logs` is an upsert:

```text
authenticated user + requested date
        |
        | findByUserIdAndDate(...)
        v
existing row -> update it
no row       -> insert it
```

Re-saving today's sleep, water, moods, meals or habits therefore updates the
same row and ID instead of creating duplicate daily logs.

`stepTarget` is a configured target. LifeTrack does **not** currently record an
actual step count.

### 4.7 REST API

All application API paths below require
`Authorization: Bearer <jwt>` unless marked public.

#### Authentication and health

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/auth/register` | Create a user and return JWT + user DTO (public) |
| `POST` | `/api/auth/login` | Authenticate and return JWT + user DTO (public) |
| `GET` | `/api/auth/me` | Return the authenticated user |
| `GET` | `/api/health` | Lightweight `{"status":"UP"}` response (public) |

#### Daily logs

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/daily-logs` | List the current user's logs |
| `GET` | `/api/daily-logs?date=YYYY-MM-DD` | Return a zero-or-one-item list for one date |
| `GET` | `/api/daily-logs?from=YYYY-MM-DD&to=YYYY-MM-DD` | List a date range |
| `GET` | `/api/daily-logs/today` | Today's row, or `204 No Content` |
| `GET` | `/api/daily-logs/{id}` | Get one owned row |
| `POST` | `/api/daily-logs` | Insert or update by user/date; returns `201` |
| `PUT` | `/api/daily-logs/{id}` | Replace one owned row |
| `DELETE` | `/api/daily-logs/{id}` | Delete one owned row; returns `204` |

#### Expenses

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/expenses` | List owned expenses, newest date first |
| `GET` | `/api/expenses/{id}` | Get one owned expense |
| `POST` | `/api/expenses` | Create an expense |
| `PUT` | `/api/expenses/{id}` | Update an expense |
| `DELETE` | `/api/expenses/{id}` | Delete an expense |

Amounts must be positive and categories must exist in the backend reference
catalogue.

#### Journal

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/journal` | List owned entries, newest date first |
| `GET` | `/api/journal/{id}` | Get one owned entry |
| `POST` | `/api/journal` | Create an entry |
| `PUT` | `/api/journal/{id}` | Update an entry |
| `DELETE` | `/api/journal/{id}` | Delete an entry |

Mood and text are validated; the mood must exist in the backend catalogue.

#### Settings, vocabulary, analytics and insights

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/reference` | Expense categories, habit catalogues and mood lists |
| `GET` | `/api/settings` | Get or create the current user's targets |
| `PUT` | `/api/settings` | Update budget, sleep, step and water targets |
| `GET` | `/api/analytics` | User sleep/expense/mood/journal summary |
| `GET` | `/api/insights` | Deterministic trailing-seven-day insights |
| `GET` | `/api/ai-context` | Authenticated aggregate context for optional Python AI |
| `GET` | `/api/ai-context?days=N` | Same context for a requested period |

`/api/analytics` currently returns:

- Sleep points for today and the previous six days.
- Expense totals and category totals across the user's stored expenses.
- Journal mood counts and journal-entry count across stored entries.

The visible Analytics page intentionally renders only the real sleep chart.
Unsupported step, habit and comparison charts were removed rather than showing
seeded or permanently empty data.

#### Administrator

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/admin/stats` | Counts plus aggregate expense/mood maps |
| `GET` | `/api/admin/users` | All users as safe `UserDto` objects |

These endpoints require a JWT whose user has role `ADMIN`.

#### Documentation and monitoring

| Path | Purpose |
|---|---|
| `/swagger-ui.html` | Interactive OpenAPI UI |
| `/v3/api-docs` | OpenAPI JSON |
| `/actuator/health` | Detailed Spring health |
| `/actuator/metrics` | Actuator metrics catalogue |
| `/actuator/prometheus` | Prometheus scrape format |

Actuator is intentionally public for local monitoring. It must be restricted
before public deployment.

### 4.8 Backend-owned domain logic

#### Reference vocabulary

Spring owns:

- Expense categories: `Food`, `Housing`, `Travel`, `Wellness`, `Misc`.
- Transactional and embedded habit catalogues.
- Journal moods: `happy`, `calm`, `anxious`, `grateful`, `tired`.
- Daily moods: `great`, `good`, `okay`, `meh`, `bad`.

`GET /api/reference` populates frontend controls, and the write-side services
reject unknown categories or moods. The lists are no longer duplicated as
business constants in React pages.

#### Per-user settings

The first `GET /api/settings` creates defaults when a user has no settings row:

| Setting | Default |
|---|---:|
| Monthly budget | 4000 |
| Sleep target | 8 hours |
| Daily step target | 10000 |
| Water target | 2000 mL |

Targets can be updated with `PUT /api/settings`.

#### Rule-based insights

`InsightService` evaluates the authenticated user's trailing seven days:

| Rule | Current behavior |
|---|---|
| Sleep | Warn below 6.0 hours; positive at or above 7.5 |
| Spending | Warn when seven-day total exceeds 1000 |
| Habit consistency | With at least 3 logged days, warn below 0.5 |
| Hydration | Warn when average water is below 2000 mL |
| Mood | Compare positive and negative moods from logs and journals |

Thresholds are externalized under `app.insights.*`. When no rule can make a
meaningful statement, the API returns an informational "Not enough data yet"
insight.

#### AI context boundary

`AiContextService` aggregates authenticated, user-scoped facts for a configurable
period (30 days by default):

- average sleep and water
- spending and category totals
- habit consistency
- mood counts
- up to 10 recent journal excerpts, each truncated to 500 characters
- the same insight thresholds used by Spring

React does not calculate those domain facts itself.

---

## 5. Frontend

### 5.1 Stack

- React 19.2
- React DOM 19.2
- React Router 7.17
- Vite 8
- ESLint 10
- JavaScript and JSX
- LifeTrack's hand-written CSS design system
- Tailwind packages are installed, but the current pages primarily use the
  documented CSS tokens and component classes.

### 5.2 Routes

| Route | Page | Access |
|---|---|---|
| `/` | Landing | Public |
| `/about` | About/team page | Public |
| `/login` | Login | Public |
| `/register` | Registration | Public |
| `/dashboard` | Dashboard | Authenticated |
| `/daily-log` | Today's daily log | Authenticated |
| `/expenses` | Expense CRUD | Authenticated |
| `/journal` | Journal CRUD and optional AI chat | Authenticated |
| `/analytics` | Real sleep analytics | Authenticated |
| `/settings` | Budget/sleep/step/water targets | Authenticated |
| `/admin` | Admin counts and user table | `ADMIN` only |
| `*` | Redirect to `/` | Public fallback |

`ProtectedRoute` waits for authentication hydration, redirects anonymous users
to login, and redirects non-admin users away from `/admin`. `ScrollToTop`
resets page position on route changes, and an error boundary supplies a
user-facing fallback if a page crashes.

### 5.3 Shared integration layer

#### `src/lib/api.js`

- Uses `VITE_API_BASE_URL`, defaulting to
  `http://localhost:8080/api`.
- Adds the JWT from `localStorage` as a bearer token.
- Handles JSON, `204 No Content`, network failures and structured field errors.
- Clears the token and emits `lifetrack:unauthorized` after a `401`.
- Exposes helpers for auth, daily logs, expenses, journals, analytics,
  insights, admin, reference data, settings and AI context.
- Contains a separate unauthenticated client for the local FastAPI service.

#### `src/lib/auth.jsx`

`AuthProvider` exposes:

```text
user, token, isAuthenticated, isAdmin, loading,
login, register, logout
```

It stores the JWT locally, hydrates the current user through
`GET /api/auth/me`, and reacts to unauthorized events from the API wrapper.

#### `src/lib/reference.jsx`

`ReferenceProvider` loads these after authentication:

```text
GET /api/reference
GET /api/settings
```

Pages consume backend categories, habits, moods and user targets through
`useReference()`. Colors and emoji labels remain presentation concerns in
React.

#### Shared UI

- `Sidebar` renders navigation, real user initials/name, role-aware Admin link,
  settings navigation and logout.
- `UserProfileModal` is read-only and shows the authenticated name, email and
  role already held by the auth context.
- The LifeTrack design system lives in `frontend/src/styles/` and is documented
  by `UI/Reference.html` and `UI/design-system/`.

### 5.4 Current page behavior

| Page | Current data and behavior |
|---|---|
| Landing | Public marketing page. Its small chart/expense preview is illustrative marketing content, not authenticated user data. |
| About | Project purpose, team and Phase 3/Phase 4 explanation. Optional team WebP files replace botanical-initial fallbacks automatically. |
| Login/Register | Real Spring authentication with server and field-level errors. |
| Dashboard | Real sleep and expense visualizations from `/api/analytics`; deterministic cards from `/api/insights`; optional opt-in AI call. |
| Daily Log | Loads only `/api/daily-logs/today`; saves through the user/date upsert. Habits and moods come from `/api/reference`. |
| Expenses | Full real create/list/update/delete flow. Category and budget information comes from Spring. |
| Journal | Full real CRUD. Mood vocabulary comes from Spring. The optional chat first requests Spring-built `/api/ai-context`, then calls FastAPI. |
| Analytics | Only the real MySQL-backed sleep-duration line chart remains. Unsupported fake charts were removed. |
| Settings | Real `GET/PUT /api/settings` for four persisted targets. |
| Admin | Real `/api/admin/stats` count cards and `/api/admin/users` table. Seeded charts and the inert trends tab were removed. |

### 5.5 Styling and UI references

The frontend is guided by repository-owned references, not ad-hoc page design:

```text
UI/Reference.html
UI/design-system/README.md
UI/design-system/01-design-tokens.md ... 07-logo-guidelines.md
UI/1. Landing page.jpg ... UI/Admin page.png
frontend/src/styles/tokens.css
frontend/src/styles/typography.css
frontend/src/styles/layout.css
frontend/src/styles/components.css
```

Typography:

- Playfair Display for display, page and section headings.
- Inter for body text, navigation, forms and card headings.

Primary assets include the botanical shadow, geometric mesh, logo/icon sprites,
public favicon, and optional team photos under
`frontend/src/assets/team/`.

---

## 6. Optional Python AI service

### 6.1 Honest current boundary

There is **no Spring AI integration**.

Spring Boot does not currently make an HTTP call to FastAPI. The implemented
browser flow is:

```text
React --JWT--> GET /api/ai-context --Spring/JPA--> MySQL
   |
   | receives authenticated aggregate context
   |
   `--plain JSON, no JWT--> FastAPI /chat or /insights
                                  |
                                  `--> configured OpenAI-compatible provider
```

Current UI call sites:

- Dashboard: an opt-in AI button requests seven-day Spring context and calls
  FastAPI `/insights`.
- Journal: the assistant requests 30-day Spring context and calls FastAPI
  `/chat` in `full` context mode.

The Python service is optional. The normal dashboard still has Spring's
deterministic `/api/insights`, and CRUD/settings/analytics do not depend on
Python.

For a production Phase 4, the intended safer boundary is server-to-server
Spring/Python communication with authentication. The current direct browser to
FastAPI path is local prototype behavior.

### 6.2 FastAPI capabilities

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Provider/model health metadata |
| `GET` | `/models` | Available provider models |
| `POST` | `/insights` | Validated LLM insights with deterministic fallback |
| `POST` | `/chat` | Validated grounded reply with fallback |
| `POST` | `/vectors/upsert` | Embed and index journal records |
| `POST` | `/vectors/search` | Search one local user index |
| `DELETE` | `/vectors/{user_key}` | Delete one local vector store |

The service supports OpenAI-compatible LM Studio, OpenAI, Mistral and Gemini
endpoints through configuration. Pydantic validates inbound data, model JSON
and outbound responses.

The local vector layer supports TurboVec/TurboQuant with a NumPy cosine
fallback. Stores are separated into hashed user-key directories.

The React UI does **not** currently call the vector endpoints or use
`local_vector` chat mode. RAG/vector retrieval should therefore be described as
an available Python prototype, not an integrated product feature.

### 6.3 AI security limitation

FastAPI has CORS restrictions but no JWT authentication. Any process that can
reach port 8100 can call its chat, insight and vector endpoints. It is bound to
`127.0.0.1` by the supplied launch scripts and must not be exposed to a network
until service authentication and trusted user identity are added.

---

## 7. Monitoring

The backend exposes Actuator health and Prometheus metrics. The
`monitoring/docker-compose.yml` stack contains:

- Prometheus 2.55.1 on port 9090.
- Grafana 11.3.0 on port 3000.
- Prometheus scraping Spring at
  `host.docker.internal:8080/actuator/prometheus` every five seconds.

The local Grafana compose credentials are `admin` / `admin`. Change them for
anything beyond local demonstration.

Run:

```powershell
docker compose -f monitoring/docker-compose.yml up -d
```

Spring Boot must be running on the host for Prometheus to scrape it.

---

## 8. Running the project

### 8.1 Prerequisites

- JDK 17 or newer
- Node.js 18 or newer
- MySQL 8 running on port 3306
- Python 3.10 or newer only for the optional AI service
- An OpenAI-compatible provider only for live AI generation
- Docker only for the optional monitoring stack

### 8.2 Launch scripts

Windows:

```powershell
.\start-lifetrack.bat
```

macOS/Linux:

```bash
chmod +x start-lifetrack.sh
./start-lifetrack.sh
```

The scripts:

1. Check Java and Node.
2. Check or attempt to start MySQL.
3. Install frontend dependencies when missing.
4. Optionally create the Python virtual environment and install AI packages.
5. Resolve Maven dependencies.
6. Start Spring Boot, optional FastAPI and Vite.
7. Open `http://localhost:5173`.

They do not start Prometheus/Grafana or seed demo data.

### 8.3 Manual startup

Backend:

```powershell
cd backend
.\mvnw.cmd -DskipTests spring-boot:run
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

Optional AI:

```powershell
cd ai-service
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8100
```

Configure a valid provider/model in `ai-service/.env` before expecting live LLM
responses.

---

## 9. Demo data

`backend/scripts/seed-demo-7-days.sql` supplies current seven-day data for
existing users with IDs 1 and 2.

It inserts or preserves:

- per-user settings
- seven daily logs per user
- transactional and embedded habits
- at least eight expense rows per user
- seven journal entries per user

Dates are relative to `CURDATE()`, daily logs use the unique user/date key, and
duplicate expense/journal/habit rows are checked before insertion. The script
does not create users or modify credentials.

From the MySQL client:

```sql
USE lifestyle_ai;
SOURCE C:/Users/PC/Desktop/V2/New folder/lms-frontend-backend-springboot/backend/scripts/seed-demo-7-days.sql;
```

Confirm that users 1 and 2 are the intended demo users before running it.

---

## 10. Known gaps and risks

### Functional scope

- No automated backend, frontend or AI tests.
- Expense and journal list endpoints are unpaginated.
- The general daily-log list is unpaginated, although date and range filters
  exist.
- The Analytics page currently has only the real sleep-duration visualization.
- `stepTarget` exists; actual steps do not.
- The profile modal is read-only. User name/email editing is not implemented.
- Settings are limited to budget, sleep target, step target and water target.
- No password reset, email verification, refresh token or account deletion.
- Admin supports counts and a user list, not user mutation or role management.
- No application Docker image, CI pipeline or production deployment
  configuration.
- Vector/RAG endpoints are not integrated into the browser flow.

### Security and deployment

- The MySQL username/password are hardcoded for local development.
- A default development JWT secret exists in `application.yml`; override
  `APP_JWT_SECRET` outside local development.
- JWT is stored in `localStorage`, which is exposed to successful XSS.
- FastAPI has no authentication and must remain loopback-only.
- Actuator endpoints are public.
- Swagger is public.
- Hibernate `ddl-auto: update` is not a production migration strategy.
- Local Grafana uses default credentials.

### Documentation drift elsewhere

The following supporting files still contain older wording and must not be used
as the current architecture source:

- `backend/README.md` still describes MongoDB.
- `backend/pom.xml` has a MongoDB description even though its dependencies use
  JPA/MySQL.
- `frontend/.env` calls the AI URL an unused placeholder even though optional
  AI buttons currently call it.
- `ai-service/README.md` says Spring posts to FastAPI; the current code has
  React call FastAPI after fetching Spring's authenticated context.
- Historical portions of `integration.md` describe earlier phases and should
  be read as a journal, not as current state.

This `PROJECT-OVERVIEW.md` is the current architecture reference until those
supporting files are separately corrected.

---

## 11. Phase 3 presentation boundary

A defensible summary is:

> LifeTrack is a secure multi-user lifestyle platform that stores daily logs,
> habits, moods, meals, journals, settings and expenses in MySQL. Spring Boot
> owns authentication, authorization, validation, CRUD, aggregation and
> deterministic insights. React presents this data. `/api/ai-context` is the
> trusted aggregation seam for optional Python AI/RAG work in Phase 4.

Safe claims:

- "Users configure a daily step target."
- "A user has one updatable daily log per date."
- "Every authenticated resource is scoped to the JWT user."
- "Displayed user analytics come from Spring and MySQL."
- "Spring produces deterministic rule-based insights."
- "Python AI/RAG is an optional, separate Phase 4 layer."

Claims to avoid:

- "LifeTrack tracks actual steps."
- "All original analytics mockups are implemented."
- "Spring AI powers LifeTrack."
- "Spring Boot currently calls the Python service."
- "RAG is integrated into the current UI."
- "The application learns and adapts automatically."
