## Components: Shared, not page-specific

The components in [06-components.md](file:///c:/Users/PC/Desktop/V2/LMS-Docs/UI/design-system/06-components.md) are **reusable building blocks**, not page-specific. Here's why that matters:

| Component | Used on these pages |
|-----------|-------------------|
| Primary Button | Landing, Login, Register, Daily Log, Expenses, Journal |
| Sidebar + Top Nav | Dashboard, Daily Log, Expenses, Journal, Trends, Admin (6 pages!) |
| Standard Card | Dashboard, Daily Log, Expenses, Journal, Trends, Admin |
| Text Input | Login, Register, Daily Log, Expenses |
| Donut/Bar Charts | Dashboard, Expenses, Trends, Admin |
| Auth Card | Login, Register |

So **someone needs to build the shared components first** (or at least in parallel), otherwise all 3 of you will be duplicating the same sidebar, nav bar, buttons, and cards independently.

---

## Recommended work split for 3 people

### Phase 1 — Shared foundation (1 person, ~1 day)

**Person 1** builds the **component library + layout shell**:
- CSS variables (the `:root` block from the README)
- Sidebar component
- Top navigation bar
- Button variants (primary, secondary, ghost, destructive)
- Card component (standard)
- Input / Select / Checkbox components
- Auth card layout
- Toast component

> This is the most critical work — it unblocks everyone else.

### Phase 2 — Pages in parallel (all 3, simultaneously)

Once the shared components exist, divide **pages by equal effort**, not just count:

| Person | Pages | Why balanced |
|--------|-------|-------------|
| **Person 1** | 🏠 **Dashboard** + 🔐 **Login** + 🌐 **Landing** | 1 complex + 2 simple pages. Also already familiar with the components they built. |
| **Person 2** | 📋 **Daily Log** + 📝 **Register** + 📈 **Trends** | 1 complex + 1 simple + 1 medium. Daily Log has many form controls; Trends is mostly charts. |
| **Person 3** | 💰 **Expenses** + 📓 **Journal** + 🛡️ **Admin** | 2 medium-high + 1 medium. Expenses has CRUD table; Journal has AI chat panel; Admin reuses chart patterns. |

### Complexity breakdown

```
Page              Effort    Why
─────────────────────────────────────────────
Landing           ★☆☆☆☆    Hero text + CTA, no interactivity
Login             ★☆☆☆☆    2 inputs + 1 button
Register          ★★☆☆☆    4 inputs + 1 button
Trends            ★★★☆☆    4 charts + filter bar (no forms)
Admin             ★★★☆☆    Stat row + 3 charts (mirrors dashboard patterns)
Expenses          ★★★★☆    Form + dropdown + CRUD table + donut chart
Journal           ★★★★☆    Textarea + mood selector + history list + AI chat panel
Daily Log         ★★★★☆    3-column form, checkboxes, meal cards, gauges, mood
Dashboard         ★★★★★    Most diverse: charts, cards, sidebar, nav, journal preview
```

**Total effort per person:**
- Person 1: ★★★★★ + ★☆☆☆☆ + ★☆☆☆☆ = **~7 stars** (+ Phase 1 components)
- Person 2: ★★★★☆ + ★★☆☆☆ + ★★★☆☆ = **~9 stars**
- Person 3: ★★★★☆ + ★★★★☆ + ★★★☆☆ = **~10 stars**

Person 1 has fewer page stars because they did Phase 1 (shared components). It evens out.

---
