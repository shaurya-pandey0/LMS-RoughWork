Both servers are up. Let me verify the backend endpoints the frontend now depends on are all responding correctly.

Everything the frontend now depends on works, and every category `/reference` advertises is accepted by the write endpoint — so the UI can't offer an option the server rejects. Let me check the browser console for runtime errors via the Vite output, then clean up.

Production build succeeds. Cleaning up.

Done. Domain logic is out of the frontend.

**New file:** `lib/reference.jsx` — a `ReferenceProvider` that fetches `/api/reference` + `/api/settings` once after login, plus the presentation-only `CATEGORY_COLOR` / `MOOD_DISPLAY` maps and `colorForCategory()` / `moodDisplay()` helpers.

**Deleted from React:**
- `CATEGORIES` + `CAT_COLOR` (ExpensesPage)
- `MONTHLY_BUDGET = 4000` → now `settings.monthlyBudget`
- `TRANSACTIONAL_HABITS`, `EMBEDDED_HABITS`, `MOOD_OPTIONS` (DailyLogPage)
- `MOODS`, `MOOD_BY_ID` (JournalPage)
- `CATEGORY_COLOR` duplicate (DashboardPage)
- `hours / 8 * 100` → now `settings.sleepTargetHours`
- `buildContext()` → replaced by `GET /api/ai-context`
- The fetch-all-then-filter block → replaced by `GET /api/daily-logs/today`
- Dashboard's client-side avg-sleep calc for AI insights → now relays Spring's context

**Security fix landed:** `user_key` is no longer sent from the browser. Both AI call sites now pull context from Spring using the user's JWT, so a user can't request another user's context.

**Also:** login's password rule now says 8 chars, matching the backend.

**Verified:** lint clean (fixed 3 `setState`-in-effect violations by deriving values instead of syncing state), production build succeeds in 738ms, and every endpoint the frontend now calls returns correct live data. I also confirmed all five categories from `/reference` are accepted by `POST /expenses` — the UI can no longer offer an option the server rejects.

Two things worth knowing:

1. **I didn't click through the UI in a browser.** The build compiles and the APIs verify, but I'd give the Expenses/Daily Log/Journal pages a quick manual pass — the category and mood pickers now populate asynchronously, so if `/reference` is slow the lists render empty for a moment. Worth seeing how that feels.

2. **The fake charts are still there** (Analytics step/habit/expense-comparison, Admin trends, Dashboard's Stress/Hydration/Heart-Rate gauges). Untouched by this work — still your decision on make-real / delete / label before the interview.

Next up would be your mini-Bootstrap: the pages are now thin enough that extracting `Card`, `Table`, `Input`, `Modal`, `Chart` is mechanical, and that's where the real line-count reduction comes from. Want me to start that?s