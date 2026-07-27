# Phase 3 Refactor Plan — Pull Domain Logic Back Into Spring Boot

**Goal:** make Spring Boot the single source of domain truth and a stable CRUD
API, so that (a) the React app only renders, and (b) Phase 4's Python AI service
can be built freely — RAG, embeddings, vector search — without duplicating
business rules or trusting the browser.

**Scope:** Spring Boot + React only. The Python AI service is **on hold**; the
one thing we build for it now is a clean data seam (`/api/ai-context`) so Phase 4
has nothing to unpick. We are **not** using Spring AI — all AI work stays in
Python later.

---

## 1. The principle

> **Spring owns facts and rules. React owns pixels.**
> If a number would still be true with no browser attached, the backend computes it.

Two kinds of complexity, only one is a problem:

| Kind | Example | Verdict |
| --- | --- | --- |
| **Presentational complexity** | large CSS files, SVG chart maths, layout tokens, our own mini design system | **Fine.** Inherent to a polished UI, local in effect — break it and only pixels change. |
| **Domain complexity** | budget thresholds, category lists, averages, completion rates | **Not fine in the client.** Creates two sources of truth, cannot be enforced server-side, cannot be reused by a second client (Python). |

So: keep building the in-house component library. Move the rules.

---

## 2. Findings — what the frontend is doing that it shouldn't

Found by grepping `frontend/src`, not from memory.

### 2.1 Security-relevant (highest priority)

**The browser decides whose AI data is read.** `lib/api.js` calls the AI service
with **no `Authorization` header**, and `JournalPage` sends
`user_key: user?.id || user?.email`. The AI service trusts that value to select
the per-user vector store → any caller can pass another user's key and read
their journal embeddings. Authorization decided in the client is not
authorization.

Secondary: `LoginPage` validates password `>= 6` while the backend requires
`>= 8` — the UI admits input the server rejects.

### 2.2 Business logic in the wrong place

| What | File | Why it's wrong |
| --- | --- | --- |
| `MONTHLY_BUDGET = 4000` | `ExpensesPage.jsx` | Business threshold hardcoded in the browser. Backend already has `app.insights.weekly-spending-threshold` → two competing sources of truth. |
| `spendPct = total / MONTHLY_BUDGET` | `ExpensesPage.jsx` | Derived business metric computed client-side. |
| `buildContext(entries)` | `JournalPage.jsx` | The browser assembles the AI grounding payload and ships raw journal text to a second service. |
| `hours / 8 * 100` | `DashboardPage.jsx` | The "8 hour" sleep target is a domain constant living inside a chart. |
| Avg-sleep calculation | `DashboardPage.jsx` | Aggregation in the client. |
| Re-summing expenses by category | `ExpensesPage.jsx` | `/api/analytics` already returns `expensesByCategory`; the client recomputes it. |
| `TRANSACTIONAL_HABITS`, `EMBEDDED_HABITS` | `DailyLogPage.jsx` | Domain reference data. Habits can't change without a frontend redeploy, and the backend can't score consistency against the full catalog. |
| `CATEGORIES` | `ExpensesPage.jsx` | Frontend holds the canonical list while the backend accepts `category` as free text with only `@NotBlank` — `POST {"category":"Yacht"}` succeeds today. |
| `MOODS` / `MOOD_OPTIONS` | `JournalPage.jsx`, `DailyLogPage.jsx` | Same: domain vocabulary in the client. |
| Category → colour map duplicated | `DashboardPage.jsx` + `ExpensesPage.jsx` | Maintained twice. (Colour itself is presentation — the *list* is domain.) |
| Fetch-all-then-filter | `DailyLogPage.jsx` | Downloads **every** daily log to find today's. |
| No pagination anywhere | Expenses, Journal | `GET /api/expenses` returns everything; Journal's heading claims "Last 30 Days" but fetches all. |

### 2.3 Fake data still rendering (demo risk)

| Page | Fake element |
| --- | --- |
| `AnalyticsPage` | step-frequency bars, habit-completion donut, per-day expense comparison — **seeded pseudo-random**. Only the sleep line chart is real. |
| `AnalyticsPage` | the 7/30/90-day range dropdown changes **nothing real** — `/api/analytics` is hardcoded to 7 days. |
| `AdminPage` | step distribution, financial velocity, habit funnel — hardcoded. Only the 3 stat cards + user table are real. |
| `DashboardPage` | Stress Level (60), Hydration (75), Heart Rate (80), "balance score 72" — hardcoded. |

---

## 3. Schema gaps (cannot be fixed by an endpoint alone)

1. **`DailyLog` has `stepTarget` but no actual step count.** That is *why* the
   step charts are fake — there is no data to serve. Add `stepsActual`.
2. **No fields exist for stress / heart rate.** Either add them to `DailyLog` or
   delete those dashboard gauges. Recommendation: delete for now — inventing
   health metrics we don't collect is worse than a smaller dashboard.
3. **`UserSettings` does not exist.** Needed to host per-user targets
   (budget, sleep, steps, water) instead of hardcoded constants.

---

## 4. Endpoints to build

### 4.1 `GET /api/reference` — reference/vocabulary data
```json
{
  "expenseCategories": ["Food", "Housing", "Travel", "Wellness", "Misc"],
  "transactionalHabits": ["Drink Water Before Coffee", "Meditation (10 min)", "..."],
  "embeddedHabits": ["Evening Stretch", "..."],
  "journalMoods": ["happy", "calm", "anxious", "grateful", "tired"],
  "dailyMoods": ["great", "good", "okay", "meh", "bad"]
}
```
- One call, fetched once at app load. Four separate endpoints would buy nothing.
- **Also enables server-side validation** of `category` and `mood` (currently
  `@NotBlank` only) — do both in the same change.
- Removes 5 hardcoded arrays from React.

### 4.2 `GET /api/settings` · `PUT /api/settings` — per-user targets
```json
{ "monthlyBudget": 4000, "sleepTargetHours": 8, "stepTarget": 10000, "waterTargetMl": 2000 }
```
New `UserSettings` entity (1:1 with `User`, created with defaults on register).
Kills `MONTHLY_BUDGET` and the `/ 8` sleep constant, and gives the insight
engine per-user thresholds instead of global config only.

### 4.3 Daily log lookup by date
```
GET /api/daily-logs/today
GET /api/daily-logs?date=YYYY-MM-DD
GET /api/daily-logs?from=&to=
```
Replaces the fetch-everything-and-filter-in-JS pattern.

### 4.4 `GET /api/dashboard/summary` — pre-computed dashboard
Returns weekly sleep **with percentage against the user's target**, expense
breakdown **with percentages**, budget-used %, today's stat chips, counts.
Biggest single reduction in frontend arithmetic.

### 4.5 Real analytics
```
GET /api/analytics?from=&to=            # make the range filter actually work
GET /api/analytics/habits               # completion % → replaces the fake donut
GET /api/analytics/expenses/daily?from=&to=   # per-day per-category series
GET /api/analytics/steps?from=&to=      # requires stepsActual (§3.1)
```
Habit completion is computable once the backend owns the habit catalog (§4.1):
`completed / total` per day.

### 4.6 Pagination & filtering
```
GET /api/expenses?page=&size=&from=&to=&category=
GET /api/journal?page=&size=&from=&to=
```
Return Spring `Page<T>` (`content`, `totalElements`, `totalPages`, `number`).

### 4.7 `GET /api/ai-context?days=30` — **the Phase 4 seam**
```json
{
  "periodDays": 30,
  "avgSleepHours": 6.4, "minSleepHours": 6.0, "goodSleepHours": 7.5,
  "weeklySpend": 1565.0, "spendThreshold": 1000.0,
  "expensesByCategory": { "Food": 215.0, "Misc": 490.0 },
  "avgWaterMl": 1450.0, "minWaterMl": 2000.0,
  "habitConsistency": 0.28, "habitConsistencyThreshold": 0.5,
  "moodCounts": { "tired": 4, "anxious": 2 },
  "journalExcerpts": ["..."]
}
```
**The most important item in this document.** It replaces
`JournalPage.buildContext()` and simultaneously fixes §2.1: Python asks Spring
for context (server-to-server, JWT forwarded) instead of trusting a
browser-supplied `user_key`.

Payoff for Phase 4: Python gets a single, authoritative, versioned input and is
then completely free — RAG, embeddings, TurboVec, agents, whatever — with no
duplicated domain rules and no Spring AI dependency.

### 4.8 Admin trends (optional)
```
GET /api/admin/trends
```
Only if you want to keep the Admin charts. Otherwise delete them — see §6.

---

## 5. Boundary: what deliberately stays in React

So nobody over-corrects and starts round-tripping for formatting:

- Rendering, routing, component composition
- Form state, input handling, focus management
- SVG chart drawing (paths, arcs, gauges) and the chart maths for *layout*
- **Colours, theme tokens, category → colour map, all CSS** and the in-house
  design system
- Date and currency **formatting** (`isoToShort`, `fmtMoney`)
- Optimistic updates with rollback
- Client-side validation **as a UX mirror** of server rules — never as the only
  check, and it must not contradict the server (fix the 6-vs-8 password rule)
- Token storage, and showing/hiding the admin link (backend still enforces
  `hasRole("ADMIN")` — defence in depth)

Boundary example worth quoting in the interview: *backend returns the category
list, frontend decides Food is green.* The list is domain; the colour is not.

---

## 6. Handling the fake charts

Three honest options, per chart:

1. **Make it real** — needs `stepsActual` (steps) or new endpoints (habits,
   daily expenses). Do this for habits + daily expenses; both are computable
   from data we already store.
2. **Delete it** — best for Stress / Heart Rate / balance score. We don't
   collect that data and shouldn't pretend to.
3. **Label it** — if kept for visual completeness, mark it clearly as a
   placeholder in the UI, not just in a code comment.

Do **not** leave unlabelled random data on screen: if the teacher adds an
expense and Analytics doesn't move, that's a credibility hit that costs more
than the chart is worth.

---

## 7. Build order

Each step is small, independently demonstrable, and leaves the app working.

| # | Change | Why first |
| --- | --- | --- |
| 1 | `GET /api/reference` + server-side `category`/`mood` validation | Cheapest; closes a real validation gap; removes 5 hardcoded arrays. |
| 2 | `GET /api/daily-logs/today` (+ `?date=`) | Removes an obviously wrong data-fetch pattern. |
| 3 | `UserSettings` + `GET/PUT /api/settings` | Kills `MONTHLY_BUDGET` and the `/ 8` constant. |
| 4 | `GET /api/ai-context` | Unblocks Phase 4 and fixes the client-trust hole. |
| 5 | `GET /api/dashboard/summary` | Biggest cut to frontend math. |
| 6 | Pagination + `?from=&to=` on expenses/journal | Makes list endpoints scale; makes "Last 30 Days" true. |
| 7 | `stepsActual` + real analytics endpoints; delete/label remaining mocks | Retires the fake charts. |

Steps 1–4 are the ones I'd insist on before the Phase 3 interview.

---

## 8. Interview framing

This refactor is a **strength**, not an admission of failure. Framing:

> "The UI was built first, so some domain rules ended up in React — a budget
> threshold, the category list, a few aggregations. We audited the frontend,
> found them, and pulled them back behind the API. The rule we settled on is
> that Spring owns facts and rules, React owns pixels. The payoff is that our
> Python AI service can now consume one authoritative context endpoint instead
> of re-implementing our domain, and a user can no longer influence whose data
> the AI reads."

Expected follow-ups:
- *How did you find them?* Grepped the frontend for hardcoded constants and
  derived metrics; anything that would still be true without a browser belongs
  server-side.
- *Why not just use Spring AI?* We want the AI layer in Python for the
  ecosystem (embeddings, vector indexes, RAG tooling) and want it to fail
  independently. Spring stays a stable CRUD API.
- *Why is client-side validation still there?* UX only — instant feedback. The
  server re-validates everything; the client can never be the enforcement point.

---

## 9. Definition of done (Phase 3)

- [ ] No domain constant or threshold left in `frontend/src`
- [ ] `category` and `mood` rejected server-side when invalid
- [ ] No endpoint returns an unbounded list where the UI shows a window
- [ ] `buildContext()` deleted; Journal chat consumes `/api/ai-context`
- [ ] AI service no longer trusts a browser-supplied `user_key`
- [ ] Every chart on screen is either real or explicitly labelled a placeholder
- [ ] Client and server validation rules agree (password length, categories, moods)
