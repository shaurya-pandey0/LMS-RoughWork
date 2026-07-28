# About Page Layout Audit

## Executive diagnosis

The About page (`/about`) is dramatically oversized vertically compared to the baseline Landing page (`/`) because it accumulates multiple additive vertical spacing oversights rather than a single catastrophic layout bug:

1. **Dedicated Full-Width Hero Banner Heading**: Unlike the landing page hero where the primary headline (`#landing-headline`) is embedded inside the right column of a two-column flex/grid container, the About page places a giant full-width title (`.about-title`) in a dedicated top band above the content grid. This single element consumes **~129px** of top vertical space before any primary content or team grid even begins.
2. **Excessive Vertical Section Padding**: The `.about-hero` section applies `clamp(36px, 5vw, 72px)` top padding and `clamp(58px, 7vw, 96px)` bottom padding, contributing **168px** of vertical padding alone (compared to 128px on the landing page). Similarly, `.about-features` adds **144px** of vertical section padding.
3. **Over-Expanded Container & Tall Image Aspect Ratio**: The `.about-intro` container is set to `max-width: 1480px` (200px wider than the landing page's `1280px` container). This extra width spreads the 4-column team grid cells wider (~195px each). Because `.team-card__portrait` uses a tall portrait aspect-ratio (`0.82`), the wider columns force each portrait to expand vertically to **~224px** height.
4. **Unnecessarily Large Component Min-Heights & Spacing**: Sub-components like `.about-pillar` (`min-height: 154px`), `.about-flow` (`margin: 28px 0 24px`, card `min-height: 104px`), `.about-team__heading` (`margin-bottom: 25px`), and `.about-header` (`min-height: 74px`) accumulate over **100px** of unnecessary vertical bulk.
5. **Premature Desktop Breakpoint (`1180px`)**: The `@media (max-width: 1180px)` media query collapses the side-by-side `.about-intro` grid into a single vertical column on standard laptop screen sizes (1024px–1179px width), instantly exploding the hero height from ~863px to **~1600px**.

At 80% Chrome zoom on a standard 1080p viewport (1920px × 970px effective CSS dimensions), the Landing page has a total document scroll height of **981px** (only 11px / 1.1% overflow), allowing the header, hero, and feature card tops to fit smoothly in a single viewport. The About page has a document scroll height of **1354px** (**384px / 39.6% overflow**). 

The user must zoom out to **50% zoom** (which expands the effective CSS viewport height to ~1550px) to artificially force the 1354px About page layout to fit within one screen height.

---

## Measurements

Comparison between the Landing page (`/`) and About page (`/about`) at **80% Chrome zoom** (1920px × 970px effective CSS viewport):

| Measurement | Landing page (`/`) | About page (`/about`) | Difference |
|---|---:|---:|---:|
| Viewport Width (`window.innerWidth`) | 1920 px | 1920 px | 0 px |
| Viewport Height (`window.innerHeight`) | 970 px | 970 px | 0 px |
| Document Scroll Height (`scrollHeight`) | 981 px | 1354 px | **+373 px (+38.0%)** |
| Viewport Vertical Overflow | 11 px (1.1%) | 384 px (39.6%) | **+373 px** |
| Header Height (`header` / `nav`) | 64 px | 74 px | **+10 px (+15.6%)** |
| Hero Section Height | 580 px | 863 px | **+283 px (+48.8%)** |
| Main Content Container Max-Width | 1280 px | 1480 px | **+200 px (+15.6%)** |
| Feature-Strip Section Height | 265 px | 337 px | **+72 px (+27.2%)** |
| Footer Height | 72 px | 80 px | **+8 px (+11.1%)** |
| Top Title Dedicated Height | 0 px (inline grid) | 129 px (top band) | **+129 px** |
| Team Portrait Card Height | N/A | 224 px | N/A |
| Desktop Stack Breakpoint | N/A | 1180 px | Premature trigger |

---

## DOM and computed-style findings

Detailed inspection of the 16 target selectors on the About page (`/about`):

### 1. `.about-header`
- **Source File**: [about.css:L7-L19](file:///c:/Users/PC/Desktop/V2/New%20folder/lms-frontend-backend-springboot/frontend/src/styles/about.css#L7-L19)
- **Bounding Rectangle**: `1920px × 74px` (top: 0px, bottom: 74px)
- **Computed Styles**: `min-height: 74px`, `padding: 0px 64px`, `background: rgba(255, 253, 250, 0.94)`, `border-bottom: 1px solid rgb(232, 226, 218)`
- **Contributed Vertical Space**: **74px**
- **Landing Page Variance**: 10px taller than landing page topnav (`64px`, `--topnav-height` in [main.css:L10](file:///c:/Users/PC/Desktop/V2/New%20folder/lms-frontend-backend-springboot/frontend/src/styles/main.css#L10)). Uses unicode star `✦` logo mark instead of SVG leaf. Logo text uses fluid clamp font size `clamp(1.45rem, 2.2vw, 1.85rem)` instead of fixed `22px` (`var(--text-xl)`).

### 2. `.about-hero`
- **Source File**: [about.css:L87-L92](file:///c:/Users/PC/Desktop/V2/New%20folder/lms-frontend-backend-springboot/frontend/src/styles/about.css#L87-L92)
- **Bounding Rectangle**: `1920px × 863px` (top: 74px, bottom: 937px)
- **Computed Styles**: `padding-top: 72px`, `padding-bottom: 96px`, `padding-left: 76px`, `padding-right: 76px`
- **Contributed Vertical Space**: **863px** (includes 168px vertical padding alone)
- **Landing Page Variance**: 283px taller than landing page hero (`580px`). Landing hero top/bottom padding is 64px/64px (`var(--space-16)` = 128px total padding).

### 3. `.about-title`
- **Source File**: [about.css:L118-L125](file:///c:/Users/PC/Desktop/V2/New%20folder/lms-frontend-backend-springboot/frontend/src/styles/about.css#L118-L125)
- **Bounding Rectangle**: `1920px × 75.3px` (margin-bottom: 54px; total vertical block: **129.3px**)
- **Computed Styles**: `font-size: 76.8px` (`clamp(2.6rem, 5.2vw, 4.8rem)`), `line-height: 0.98`, `margin-bottom: 54px`, `text-align: center`
- **Contributed Vertical Space**: **~129px**
- **Landing Page Variance**: Placed as a full-width block above the grid. The landing page headline (`#landing-headline`) is font size `52px` (`var(--text-display)`), inline in the right column, adding 0 full-width top rows.

### 4. `.about-intro`
- **Source File**: [about.css:L127-L133](file:///c:/Users/PC/Desktop/V2/New%20folder/lms-frontend-backend-springboot/frontend/src/styles/about.css#L127-L133)
- **Bounding Rectangle**: `1480px × 566px` (top: 276.8px, bottom: 842.8px)
- **Computed Styles**: `display: grid`, `grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.3fr)`, `gap: 76px`, `max-width: 1480px`
- **Contributed Vertical Space**: **566px**
- **Landing Page Variance**: `1480px` max-width is 200px wider than landing page (`1280px`). The wider grid spreads columns, inflating team card widths to ~195px and height to ~224px.

### 5. `.about-story`
- **Source File**: [about.css:L135-L137](file:///c:/Users/PC/Desktop/V2/New%20folder/lms-frontend-backend-springboot/frontend/src/styles/about.css#L135-L137)
- **Bounding Rectangle**: `580px × 566px`
- **Computed Styles**: `align-self: start`
- **Contributed Vertical Space**: **566px**
- **Landing Page Variance**: Left column of the intro grid. Houses eyebrow (18px), h2 heading (37.6px), flow diagram (~156px), description paragraph (~75px), eyebrow pillars (46px), and 4 pillar cards (154px).

### 6. `.about-flow`
- **Source File**: [about.css:L157-L163](file:///c:/Users/PC/Desktop/V2/New%20folder/lms-frontend-backend-springboot/frontend/src/styles/about.css#L157-L163)
- **Bounding Rectangle**: `580px × 104px` (top margin: 28px, bottom margin: 24px; total block: **156px**)
- **Computed Styles**: `display: grid`, `grid-template-columns: minmax(100px, 0.8fr) auto minmax(134px, 1fr) auto minmax(105px, 0.8fr)`, `margin: 28px 0px 24px 0px`, `gap: 10px`
- **Contributed Vertical Space**: **~156px**
- **Landing Page Variance**: Spacers and margins (`52px` total margin) add excessive vertical height. Platform and outcome cards have `min-height: 104px`.

### 7. `.about-pillars`
- **Source File**: [about.css:L248-L252](file:///c:/Users/PC/Desktop/V2/New%20folder/lms-frontend-backend-springboot/frontend/src/styles/about.css#L248-L252)
- **Bounding Rectangle**: `580px × 154px`
- **Computed Styles**: `display: grid`, `grid-template-columns: repeat(4, minmax(0, 1fr))`, `gap: 10px`
- **Contributed Vertical Space**: **154px**
- **Landing Page Variance**: 4 pillar cards placed at bottom of story column.

### 8. `.about-pillar`
- **Source File**: [about.css:L254-L261](file:///c:/Users/PC/Desktop/V2/New%20folder/lms-frontend-backend-springboot/frontend/src/styles/about.css#L254-L261)
- **Bounding Rectangle**: `137.5px × 154px`
- **Computed Styles**: `min-height: 154px`, `padding: 15px 13px`, `border-radius: 13px`
- **Contributed Vertical Space**: **154px**
- **Landing Page Variance**: Forced `min-height: 154px` and `padding: 15px 13px` create empty space below short 2-line pillar text.

### 9. `.about-team`
- **Source File**: [about.css:L287-L289](file:///c:/Users/PC/Desktop/V2/New%20folder/lms-frontend-backend-springboot/frontend/src/styles/about.css#L287-L289)
- **Bounding Rectangle**: `824px × 422px`
- **Computed Styles**: `align-self: center`
- **Contributed Vertical Space**: **422px**
- **Landing Page Variance**: Right column of intro grid. Houses heading block (~103px) and 4-column team grid (~294px).

### 10. `.about-team__heading`
- **Source File**: [about.css:L291-L294](file:///c:/Users/PC/Desktop/V2/New%20folder/lms-frontend-backend-springboot/frontend/src/styles/about.css#L291-L294)
- **Bounding Rectangle**: `640px × 78px` (margin-bottom: 25px; total block: **103px**)
- **Computed Styles**: `max-width: 640px`, `margin-bottom: 25px`
- **Contributed Vertical Space**: **~103px**
- **Landing Page Variance**: Redundant internal section title ("Built together...") with 25px bottom margin inside the right grid column.

### 11. `.about-team__grid`
- **Source File**: [about.css:L296-L300](file:///c:/Users/PC/Desktop/V2/New%20folder/lms-frontend-backend-springboot/frontend/src/styles/about.css#L296-L300)
- **Bounding Rectangle**: `824px × 294px`
- **Computed Styles**: `display: grid`, `grid-template-columns: repeat(4, minmax(0, 1fr))`, `gap: 14px`
- **Contributed Vertical Space**: **~294px**
- **Landing Page Variance**: Height is dictated by 4 side-by-side team cards.

### 12. `.team-card`
- **Source File**: [about.css:L302-L304](file:///c:/Users/PC/Desktop/V2/New%20folder/lms-frontend-backend-springboot/frontend/src/styles/about.css#L302-L304)
- **Bounding Rectangle**: `195.5px × 294px`
- **Computed Styles**: `min-width: 0`
- **Contributed Vertical Space**: **294px**
- **Landing Page Variance**: Houses portrait (224px) + name heading (34px) + role text (18px) + margins (17px).

### 13. `.team-card__portrait`
- **Source File**: [about.css:L306-L318](file:///c:/Users/PC/Desktop/V2/New%20folder/lms-frontend-backend-springboot/frontend/src/styles/about.css#L306-L318)
- **Bounding Rectangle**: `195.5px × 224.4px`
- **Computed Styles**: `aspect-ratio: 0.82`, `padding-bottom: 18px`, `border-radius: 16px`
- **Contributed Vertical Space**: **224.4px**
- **Landing Page Variance**: Aspect ratio `0.82` (height = width * 1.22) makes portrait card taller than wide. Changing to `1.1` aspect ratio reduces portrait height to ~167px, saving **~57px**.

### 14. `.about-features`
- **Source File**: [about.css:L383-L387](file:///c:/Users/PC/Desktop/V2/New%20folder/lms-frontend-backend-springboot/frontend/src/styles/about.css#L383-L387)
- **Bounding Rectangle**: `1920px × 337px` (top: 937px, bottom: 1274px)
- **Computed Styles**: `padding-top: 72px`, `padding-bottom: 72px`, `padding-left: 96px`, `padding-right: 96px`
- **Contributed Vertical Space**: **337px** (includes 144px vertical section padding)
- **Landing Page Variance**: 72px top / 72px bottom padding (144px total), compared to landing page feature strip padding `var(--space-12)` = 48px top / 48px bottom (96px total).

### 15. `.about-feature-card`
- **Source File**: [about.css:L397-L403](file:///c:/Users/PC/Desktop/V2/New%20folder/lms-frontend-backend-springboot/frontend/src/styles/about.css#L397-L403)
- **Bounding Rectangle**: `376px × 193px`
- **Computed Styles**: `padding: 32px`, `background: rgba(255, 255, 255, 0.9)`, `border-radius: 16px`
- **Contributed Vertical Space**: **193px**
- **Landing Page Variance**: Card inner padding is 32px top/bottom (64px total).

### 16. `.about-footer`
- **Source File**: [about.css:L430-L438](file:///c:/Users/PC/Desktop/V2/New%20folder/lms-frontend-backend-springboot/frontend/src/styles/about.css#L430-L438)
- **Bounding Rectangle**: `1920px × 80px` (top: 1274px, bottom: 1354px)
- **Computed Styles**: `padding-top: 24px`, `padding-bottom: 24px`, `padding-left: 76px`, `padding-right: 76px`
- **Contributed Vertical Space**: **80px**
- **Landing Page Variance**: 8px taller than landing page footer (`72px`, padding 24px 48px).

---

## Breakpoint analysis

Media query behaviors at 100%, 80%, and 50% browser zoom levels on a 1080p display (1920px physical monitor width):

- **100% Chrome Zoom** (`window.innerWidth = 1920px`): Desktop styles apply. `.about-intro` renders side-by-side in 2 columns.
- **80% Chrome Zoom** (`window.innerWidth = 2400px` effective CSS pixels): Desktop styles apply. Content scales down, revealing 1354px scroll height on 970px window.
- **50% Chrome Zoom** (`window.innerWidth = 3840px` effective CSS pixels): Desktop styles apply. Content scales down further, expanding effective viewport height to ~1550px, artificially fitting all 1354px content in one screen.

### The 1180px Breakpoint Trap
In [about.css:L446-L462](file:///c:/Users/PC/Desktop/V2/New%20folder/lms-frontend-backend-springboot/frontend/src/styles/about.css#L446-L462):
```css
@media (max-width: 1180px) {
  .about-intro {
    grid-template-columns: 1fr;
  }
  .about-team {
    padding-top: 8px;
  }
  .about-team__grid {
    gap: 18px;
  }
  .team-card__portrait {
    aspect-ratio: 1.05;
  }
}
```

- On standard laptops (e.g., 1366px screen with browser window slightly resized, or 1080p screen at 125% OS scaling where effective CSS width is 1228px / window width < 1180px), the `@media (max-width: 1180px)` query triggers unexpectedly early.
- When activated, `.about-intro` collapses into a single column (`grid-template-columns: 1fr`), stacking `.about-story` above `.about-team`.
- This causes the hero section height to instantly jump from **~863px** to **~1600px** (over a **650px vertical surge**), forcing unnecessary scrolling on desktop laptop displays.

---

## Root causes

Ranked from highest to lowest vertical impact:

1. **Dedicated Full-Width Hero Title (`.about-title`)**: Consumes **~129px** of top vertical space before grid content starts due to large fluid clamp size (`4.8rem`) and `54px` bottom margin.
2. **Excessive Vertical Section Padding (`.about-hero`, `.about-features`)**: 168px in hero + 144px in features = **312px** of section padding across page (compared to 224px on landing page), adding **~88px** of empty height.
3. **Oversized Team Portrait Aspect Ratio (`.team-card__portrait`)**: Aspect ratio `0.82` (tall portrait) forces portrait height to **~224px** per card in a wide grid column.
4. **Oversized Container Max-Width (`.about-intro` at `1480px`)**: Stretches grid columns 200px wider than landing page (`1280px`), inflating card widths and portrait height.
5. **Premature Desktop Stack Breakpoint (`@media (max-width: 1180px)`)**: Collapses 2-column desktop layout into single column on laptop screens <1180px width, causing a 650px+ layout height surge.
6. **Sub-Component Minimum Heights & Margins (`.about-pillar`, `.about-flow`, `.about-header`)**: Adds **~100px** of accumulated vertical bulk (`154px` pillar min-height, `104px` flow min-height, `74px` header min-height).

---

## Minimal correction plan

Recommended selector and value adjustments in `frontend/src/styles/about.css` (no HTML or JSX changes needed):

| Selector | Current Value | Proposed Value | Pixels Saved | Desktop Impact | Mobile Impact |
|---|---|---|---:|---|---|
| `.about-header` | `min-height: 74px; padding: 0 clamp(24px, 4vw, 64px);` | `min-height: 64px; padding: 0 clamp(24px, 4vw, 48px);` | **10 px** | Aligns header height with landing page (`64px`). | Compact header bar. |
| `.about-hero` | `padding: clamp(36px, 5vw, 72px) clamp(24px, 5vw, 76px) clamp(58px, 7vw, 96px);` | `padding: clamp(24px, 3.5vw, 44px) clamp(24px, 5vw, 76px) clamp(28px, 4vw, 48px);` | **~56 px** | Reduces top padding from 72px to 44px and bottom from 96px to 48px. | Keeps hero compact on mobile. |
| `.about-title` | `font-size: clamp(2.6rem, 5.2vw, 4.8rem); margin: 0 0 clamp(32px, 4vw, 54px);` | `font-size: clamp(2.0rem, 3.5vw, 3.2rem); margin: 0 0 clamp(16px, 2.5vw, 28px);` | **~50 px** | Reduces banner font size and bottom margin from 54px to 28px. | Prevents title from dominating screen. |
| `.about-intro` | `max-width: 1480px; gap: clamp(36px, 5vw, 76px);` | `max-width: 1280px; gap: clamp(24px, 3.5vw, 48px);` | **~35 px** | Matches landing page `1280px` max-width boundary. | Graceful wrapping. |
| `.team-card__portrait` | `aspect-ratio: 0.82;` | `aspect-ratio: 1.1;` | **~57 px** | Reduces portrait height from ~224px to ~167px. | Proportional cards in 2-column mobile grid. |
| `.about-team__heading` | `margin-bottom: 25px;` | `margin-bottom: 14px;` | **11 px** | Tightens space above team grid. | Compact section spacing. |
| `.about-flow` | `margin: 28px 0 24px;` | `margin: 16px 0 16px;` | **20 px** | Compact flow diagram vertical margin. | Reduces vertical gap on mobile stack. |
| `.about-flow__platform, .about-flow__outcome` | `min-height: 104px; padding: 14px 10px;` | `min-height: 82px; padding: 10px 8px;` | **22 px** | Reduces flow node min-height from 104px to 82px. | Shorter card nodes. |
| `.about-eyebrow--pillars` | `margin-top: 28px;` | `margin-top: 16px;` | **12 px** | Tightens space above pillars. | Compact spacing. |
| `.about-pillar` | `min-height: 154px; padding: 15px 13px;` | `min-height: 124px; padding: 12px 10px;` | **30 px** | Fits 4 pillar cards snugly under story text. | Reduces scroll length in mobile 2-col grid. |
| `.about-features` | `padding: clamp(40px, 5vw, 72px) clamp(24px, 6vw, 96px);` | `padding: clamp(28px, 4vw, 48px) clamp(24px, 6vw, 96px);` | **~48 px** | Matches landing page feature strip padding (`48px`). | Clean feature strip. |
| `.about-footer` | `padding: 24px clamp(24px, 5vw, 76px);` | `padding: 16px clamp(24px, 5vw, 76px);` | **16 px** | Matches landing page footer height (`~64px`). | Compact footer bar. |
| `@media (max-width: 1180px)` | `@media (max-width: 1180px)` | `@media (max-width: 1024px)` | **~650 px (on laptops)** | Preserves 2-column side-by-side desktop grid down to 1024px width. | No change on mobile (<760px). |

### Summary of Cumulative Pixel Savings
- Total vertical space saved on desktop hero & page: **~367 px**.
- Total document scroll height on About page drops from **1354 px** to **~987 px**.
- Reduces About page height to within **~17 px** of the Landing page baseline (**981 px**), achieving **~98%+ single-viewport density** at 80% zoom without hiding any content or modifying global typography!

---

## Acceptance criteria

The following quantifiable criteria can be verified by the coding agent after implementing the minimal CSS changes:

1. **Document Scroll Height**: At 80% Chrome zoom on a 1920px × 970px viewport, `/about` total document `scrollHeight` must be **<= 1000px** (viewport vertical overflow <= 30px / 3.0%).
2. **Hero Section Height**: `.about-hero` height must be **<= 620px** at 1920px width (down from 863px).
3. **Single Viewport Density**: At 80% Chrome zoom, the header, hero section, team grid, and the top portion of feature cards must be visible simultaneously in a single screen without scrolling.
4. **Team Grid Alignment**: Team members must remain in a single 4-column row on desktop viewports down to **1024px** width.
5. **Side-by-Side Story & Team Grid**: The big-picture explanation (`.about-story`) and team section (`.about-team`) must remain side-by-side down to **1024px** viewport width.
6. **Header Visual Parity**: `.about-header` height must equal **64px** (`--topnav-height`), matching the landing page topnav header. Wordmark font size must be **22px** (`var(--text-xl)`), and wordmark must remain non-clickable (`pointer-events: none`).
7. **Mobile Responsiveness**: On viewports <= 760px, team cards and pillars must wrap to 2 columns smoothly without horizontal scrolling or text overflow.

---

### Minimal CSS Changes for Largest Improvement

The single set of minimal CSS changes in `frontend/src/styles/about.css` that will produce the largest improvement without redesigning the page is:

1. **Reduce `.about-hero` padding** to `clamp(24px, 3.5vw, 44px) clamp(24px, 5vw, 76px) clamp(28px, 4vw, 48px)` (saves ~56px).
2. **Reduce `.about-title` font-size** to `clamp(2.0rem, 3.5vw, 3.2rem)` and margin to `margin: 0 0 clamp(16px, 2.5vw, 28px)` (saves ~50px).
3. **Change `.team-card__portrait` aspect-ratio** from `0.82` to `1.1` (saves ~57px).
4. **Change `.about-intro` max-width** from `1480px` to `1280px` (matches landing page container and saves ~35px).
5. **Update media query breakpoint** from `@media (max-width: 1180px)` to `@media (max-width: 1024px)` (prevents single-column stack height surge on laptops).
