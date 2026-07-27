# LifeTrack Backend

Spring Boot + MongoDB REST API for the LifeTrack React frontend (`/frontend`).

Provides JWT-authenticated endpoints for users, daily logs, expenses, journal
entries, and analytics, plus admin aggregation endpoints. CORS is enabled for
the frontend dev server.

Optional companion: a standalone FastAPI **AI microservice** lives at
[`../ai-service`](../ai-service) and provides LLM-powered insights, a grounded
chat assistant, and an optional local 4-bit vector store (TurboVec + local
Nomic embeddings via LM Studio). The Spring backend keeps serving its built-in
rule-based insights regardless, so the app degrades gracefully if the AI
service is offline.

## Tech stack

- Java 17, Spring Boot 3.3
- Spring Web, Spring Security (JWT), Spring Validation
- Spring Data MongoDB
- jjwt 0.12 for token signing/parsing

## Project structure

```
backend/
  src/main/java/com/lifetrack/
    config/        # Security, CORS, JWT configuration
    controller/    # REST endpoints
    dto/           # Request/response payloads
    entity/        # MongoDB documents
    exception/     # Error handling
    repository/    # Spring Data Mongo repositories
    security/      # JWT filter, service, user details
  src/main/resources/application.yml
```

Layering: `controller -> service -> repository -> entity`, with `dto` used at
the API boundary so documents are never exposed directly.

## Prerequisites

- JDK 17+
- Maven 3.9+ (or use your IDE's bundled Maven)
- MongoDB running locally, or a MongoDB Atlas connection string

Start MongoDB locally with Docker:

```bash
docker run -d --name lifetrack-mongo -p 27017:27017 mongo:7
```

## Configuration

All settings live in `src/main/resources/application.yml` and can be overridden
with environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| `MONGODB_URI` | `mongodb://localhost:27017/lifetrack` | MongoDB connection string |
| `APP_JWT_SECRET` | (dev key) | Base64-encoded 256-bit signing secret. **Set this in production.** |
| `APP_JWT_EXPIRATION_MS` | `86400000` | Token lifetime in ms (24h) |
| `APP_CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Comma-separated allowed frontend origins |
| `APP_INSIGHTS_MIN_SLEEP_HOURS` | `6.0` | Avg sleep below this (hrs) flags insufficient sleep |
| `APP_INSIGHTS_GOOD_SLEEP_HOURS` | `7.5` | Avg sleep at/above this (hrs) is praised |
| `APP_INSIGHTS_WEEKLY_SPENDING_THRESHOLD` | `1000.0` | Weekly spend above this flags overspending |
| `APP_INSIGHTS_MIN_WATER_INTAKE_ML` | `2000.0` | Avg daily water (ml) below this flags low hydration |
| `APP_INSIGHTS_HABIT_CONSISTENCY_THRESHOLD` | `0.5` | Fraction of days with a logged habit below this flags low consistency |

Generate a production JWT secret:

```bash
openssl rand -base64 32
```

## Run

```bash
cd backend
mvn spring-boot:run
```

The API starts on `http://localhost:8080`.

## Connecting the frontend

The Vite dev server runs on `http://localhost:5173` (already in the allowed
origins). Point the frontend at the API with a base URL of
`http://localhost:8080/api` and send the JWT as `Authorization: Bearer <token>`.

## Authentication flow

1. `POST /api/auth/register` or `POST /api/auth/login` returns:
   ```json
   { "token": "<jwt>", "tokenType": "Bearer", "user": { "id": "...", "fullName": "...", "email": "...", "role": "USER" } }
   ```
2. Store the token client-side and send it on every request:
   `Authorization: Bearer <jwt>`.

## API endpoints

### Auth (`/api/auth`) — public

| Method | Path | Body | Description |
| --- | --- | --- | --- |
| POST | `/register` | `{ fullName, email, password }` | Create account, returns token |
| POST | `/login` | `{ email, password }` | Authenticate, returns token |
| GET | `/me` | – | Current user (requires token) |

### Daily logs (`/api/daily-logs`) — authenticated

| Method | Path | Description |
| --- | --- | --- |
| GET | `/` | List the current user's daily logs |
| GET | `/{id}` | Get one daily log |
| POST | `/` | Create **or upsert** a daily log for the given date |
| PUT | `/{id}` | Update a daily log |
| DELETE | `/{id}` | Delete a daily log |

A user has at most one log per date (enforced by a unique
`(userId, date)` index). `POST /` is an upsert: re-logging the same day updates
the existing entry instead of failing with a duplicate-key error.

Daily log body:

```json
{
  "date": "2026-06-25",
  "sleepHours": 6.8,
  "stepTarget": 8000,
  "waterIntake": 2000,
  "transactionalHabits": ["Meditation (10 min)"],
  "embeddedHabits": ["Evening Stretch"],
  "meals": [{ "name": "Breakfast", "items": ["Oatmeal"] }],
  "morningMood": "great",
  "afternoonMood": "okay",
  "eveningMood": "good"
}
```

### Expenses (`/api/expenses`) — authenticated

`GET /`, `GET /{id}`, `POST /`, `PUT /{id}`, `DELETE /{id}`.

Body: `{ "date": "2026-06-25", "category": "Food", "amount": 50.0 }`
(categories: `Food`, `Housing`, `Travel`, `Wellness`, `Misc`).

### Journal (`/api/journal`) — authenticated

`GET /`, `GET /{id}`, `POST /`, `PUT /{id}`, `DELETE /{id}`.

Body: `{ "date": "2026-06-25", "mood": "grateful", "text": "..." }`
(moods: `happy`, `calm`, `anxious`, `grateful`, `tired`).

### Analytics (`/api/analytics`) — authenticated

`GET /` returns weekly sleep, expenses by category, total spend, mood counts,
and journal entry count for the current user.

### Insights (`/api/insights`) — authenticated

`GET /` runs the rule-based insight engine over the user's trailing 7 days and
returns deterministic observations. No external AI dependency — always available
and fast.

```json
{
  "from": "2026-06-21",
  "to": "2026-06-27",
  "insights": [
    {
      "category": "SLEEP",
      "severity": "warning",
      "title": "Insufficient sleep",
      "message": "You're averaging 5.4 hours of sleep this week, below the 6.0-hour minimum. Try an earlier wind-down routine.",
      "metric": 5.4
    }
  ]
}
```

Rules cover sleep, weekly spending, habit consistency, hydration, and mood.
`category` is one of `SLEEP`, `SPENDING`, `HABITS`, `HYDRATION`, `MOOD`,
`GENERAL`; `severity` is `positive`, `warning`, or `info`. Thresholds are
configurable under `app.insights` (see Configuration).

### Admin (`/api/admin`) — requires `ADMIN` role

| Method | Path | Description |
| --- | --- | --- |
| GET | `/stats` | System-wide aggregated statistics |
| GET | `/users` | List all users |

### Health

`GET /api/health` → `{ "status": "UP" }` (public).

## Granting admin access

New users are created with role `USER`. To promote a user to `ADMIN`, update
their document in MongoDB:

```js
db.users.updateOne({ email: "admin@example.com" }, { $set: { role: "ADMIN" } })
```

## Seed data

`seed-data.js` populates the `lifetrack` database with three demo users plus
seven days of daily logs, expenses, and journal entries each. The data is
tuned so the rule-based insight engine fires different rules for each user.

```bash
mongosh "mongodb://127.0.0.1:27017/lifetrack" seed-data.js
```

Re-runnable: it only removes and recreates these three users and their
documents, leaving any other data untouched. All three accounts use the
password `Password123!`:

| Email | Role | Profile |
| --- | --- | --- |
| `alex@example.com` | USER | Healthy (positive insights) |
| `priya@example.com` | USER | Poor sleep / overspending (warning insights) |
| `sam@example.com` | ADMIN | Mixed; use to exercise `/api/admin/*` |

## AI service integration (optional)

The Spring backend serves built-in rule-based insights at `/api/insights`. For
LLM-powered insights and a chat assistant, run the FastAPI service in
[`../ai-service`](../ai-service) and have the frontend (or a thin Spring proxy)
call it directly. It accepts the aggregated lifestyle data this backend
already exposes via `/api/analytics`, so no extra plumbing is required to
get started.

The AI service also supports an optional local vector store (TurboVec + local
Nomic embeddings via LM Studio) so journal-grounded chat works without
sending raw entries to a cloud provider. See its README for details.

## Notes

- Passwords are hashed with BCrypt; raw passwords are never stored or returned.
- All user-scoped resources are filtered by the authenticated user's id, so
  users can only read and modify their own logs, expenses, and journal entries.
