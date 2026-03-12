# TradeBook — Complete App Replica Prompt

Build an exact replica of **TradeBook**, a mobile-first Progressive Web App (PWA) trading journal for day traders. The entire app is built with **vanilla JavaScript** (no frameworks, no build tools, no npm). It uses **IndexedDB** for offline-first local storage, **Supabase** for cloud sync and authentication, and **Chart.js** for data visualization.

---

## 1. PROJECT STRUCTURE

Create the following flat file structure (no subdirectories except `/icons/`):

```
/
├── index.html          # SPA entry point with splash screen
├── styles.css          # Full design system (dark theme)
├── auth.js             # Supabase authentication module
├── app.js              # Core application (~1000 lines)
├── features.js         # Streaks, strategies, CSV export, goals, rule violations
├── analytics.js        # Advanced analytics (drawdown, distribution, risk metrics)
├── sw.js               # Service Worker for offline caching
├── manifest.json       # PWA manifest
└── icons/
    ├── icon-192.png    # 192x192 app icon
    └── icon-512.png    # 512x512 app icon
```

**No package.json. No build process. No npm. All dependencies are loaded via CDN.**

---

## 2. INDEX.HTML

Create a minimal SPA shell:

- **Meta tags**: viewport with `viewport-fit=cover, user-scalable=no`, apple-mobile-web-app-capable, apple-mobile-web-app-status-bar-style `black-translucent`, theme-color `#070b14`
- **CDN scripts in `<head>`**:
  - Chart.js 4.4.7: `https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js`
  - Supabase JS 2.x: `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js`
- **Splash screen**: A fixed overlay (`#splash-screen`) with dark background `#050d0f`, centered "TradeBook" heading (2.5rem, weight 700) and "Trading Journal" subtitle (0.75rem, uppercase, letter-spacing 0.2em, color #6b7280). The splash fades out (opacity transition 0.5s) via a `hideSplash()` function that adds a `.hidden` class and removes the element after 600ms. Fallback: auto-hide after 5 seconds.
- **`<div id="app"></div>`** — the single mount point
- **Script loading order in `<body>`**: auth.js → app.js → features.js → analytics.js

---

## 3. MANIFEST.JSON (PWA)

```json
{
  "name": "TradeBook",
  "short_name": "TradeBook",
  "description": "Trading journal with P&L tracking, calendar heatmap, and reflection writing",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#070b14",
  "theme_color": "#10b981",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

---

## 4. SERVICE WORKER (sw.js)

- Cache name: `tradebook-v17`
- Pre-cache assets: `/`, `/index.html`, `/app.js`, `/styles.css`, `/manifest.json`, `/auth.js`, `/features.js`, `/analytics.js`, both icon files, and the Google Fonts CSS URL
- **Install**: Cache all assets, call `self.skipWaiting()`
- **Activate**: Delete old caches, call `self.clients.claim()`
- **Fetch**: Cache-first strategy — serve cached version if available, otherwise fetch from network and cache the response (GET requests only, `res.ok` check). On network failure, fall back to cache.

---

## 5. STYLES.CSS — COMPLETE DESIGN SYSTEM

### Fonts
Import Google Fonts: `DM Sans` (weights 300, 500, 700, 900, italic 400) and `JetBrains Mono` (weights 500, 700).

### CSS Custom Properties (`:root`)
```css
--bg-0: #050810;    /* deepest background */
--bg-1: #0c1018;
--bg-2: #111827;    /* card backgrounds */
--bg-3: #1a2235;    /* card gradient end */
--border: #1c2536;
--text-0: #f1f5f9;  /* brightest text */
--text-1: #cbd5e1;  /* main body text */
--text-2: #64748b;  /* muted text */
--text-3: #334155;  /* dim text */
--green: #10b981;   --green-dim: #065f46;  --green-glow: rgba(16,185,129,0.12);
--red: #ef4444;     --red-dim: #7f1d1d;
--amber: #f59e0b;   --violet: #818cf8;     --blue: #60a5fa;
--radius: 14px;
--font: 'DM Sans', -apple-system, sans-serif;
--mono: 'JetBrains Mono', monospace;
```

### Global Reset
- `* { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }`
- Body: `font-family: var(--font); background: var(--bg-0); color: var(--text-0); min-height: 100dvh; overflow-x: hidden; -webkit-font-smoothing: antialiased;`

### Layout
- `.app-shell`: `padding: env(safe-area-inset-top) 0 0 0;`
- `.app-shell::before`: Fixed full-screen noise texture overlay using inline SVG data URI (fractalNoise filter, opacity 0.015, background-size 180px)
- `.app-content`: `max-width: 480px; margin: 0 auto; padding: 12px 14px 100px;`

### Typography Classes
- `.heading-xl`: 1.5rem, weight 900, letter-spacing -0.03em, line-height 1.1
- `.heading-lg`: 1.125rem, weight 800, letter-spacing -0.02em
- `.heading-md`: 0.9375rem, weight 700
- `.label`: 0.625rem, weight 600, letter-spacing 0.08em, uppercase, color var(--text-2)
- `.mono`: font-family var(--mono)
- Color utility classes: `.text-green`, `.text-red`, `.text-amber`, `.text-violet`, `.text-muted` (text-2), `.text-dim` (text-3)

### Card Component
- `.card`: `background: linear-gradient(135deg, var(--bg-2) 0%, var(--bg-3) 100%); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; position: relative; overflow: hidden;`
- `.card::after`: Pseudo-element glow — `position:absolute; top:0; right:0; width:80px; height:80px; border-radius:50%; opacity:0.04; filter:blur(20px);`
- Color variants: `.card-green::after` (green bg), `.card-amber::after`, `.card-violet::after`, `.card-red::after`

### Grid & Layout Utilities
- `.grid-2`: 2-column CSS grid, 8px gap
- `.grid-3`: 3-column CSS grid, 8px gap
- `.stack`: Flex column, 10px gap
- `.row`: Flex row, align-items center
- `.between`: justify-content space-between
- Gap utilities: `.gap-4`, `.gap-6`, `.gap-8`, `.gap-12`, `.gap-16`

### Tab Bar
- `.tab-bar`: Flex row, 2px gap, 3px padding, 12px border-radius, bg-2 background
- `.tab-btn`: 7px 14px padding, 10px radius, 0.6875rem font, weight 700, transparent bg, text-3 color, 0.15s transition
- `.tab-btn.active`: bg-3 background, text-0 color

### Form Elements
- `.input`, `.select`, `.textarea`: Full width, 10px 12px padding, 10px radius, border with border color, bg-0 background, text-0 color, 0.8125rem font, 0.15s border transition
- Focus state: green border
- `.select`: Remove native appearance
- `.textarea`: Vertical resize, line-height 1.6
- `.form-group`: Flex column, 4px gap
- `.form-label`: Same as `.label` styling

### Calendar Grid
- `.cal-grid`: 7-column CSS grid, 3px gap
- `.cal-header`: Center text, text-3 color, 0.625rem, weight 600
- `.cal-cell`: 8px radius, min-height 48px, flex column centered, relative positioning, 3px padding
- `.cal-day-num`: Absolute top-right, 0.5rem, text-3 color
- `.cal-pnl`: 0.625rem, weight 800
- `.cal-trades`: 0.4375rem, text-3 color
- `.cal-nav-btn`: 36x36px, bg-1, border, 10px radius, centered flex, 0.875rem font

### Pill Badge
- `.pill`: Inline-block, 2px 8px padding, 6px radius, 0.625rem, weight 600

### Journal Card
- `.journal-card`: Same gradient as card, border, radius, 14px padding, cursor pointer, border-color transition on active
- `.journal-body-preview`: text-2 color, 0.6875rem, line-height 1.5, 2-line clamp with `-webkit-line-clamp`

### FAB (Floating Action Button)
- Fixed bottom-right: `bottom: max(24px, env(safe-area-inset-bottom, 24px)); right: 20px;`
- 56x56px circle, green gradient (`#10b981` → `#059669`), green box-shadow with glow
- "+" text, 1.75rem, weight 300, white, z-index 90
- Active state: scale(0.92)

### Modal
- `.modal-overlay`: Fixed inset, z-index 999, rgba(0,0,0,0.7) background, backdrop-filter blur(6px), flex align-items end, fadeIn animation
- `.modal-sheet`: Full width, max-width 440px, max-height 88dvh, gradient bg (bg-2 → bg-0), 20px top radius, 20px padding, overflow-y auto, slideUp animation
- `.modal-handle`: 36x4px centered bar, 2px radius, text-3 color, 16px bottom margin
- Picker buttons: `.picker-btn` — flex row, 12px gap, 14px padding, bg-0, border, full width

### Buttons
- `.btn`: 12px padding, 12px radius, weight 700, 0.8125rem, 0.15s opacity transition
- `.btn-primary`: Green gradient, white text, weight 800
- `.btn-secondary`: bg-3, text-2 color
- `.btn-danger`: Red text, subtle red background (8% opacity), red border (15% opacity)
- `.btn-danger-sm`: Smaller variant for inline use

### Detail Views
- `.detail-stat`: bg-2, 10px radius, 10px padding, center text
- `.detail-section`: bg-2, 12px radius, 14px padding, 10px bottom margin
- `.back-btn`: text-2 color, 0.75rem, transparent bg, no border, flex with 4px gap

### Charts
- `.ring-wrap`: 68x68px relative container for SVG donut
- `.ring-label`: Absolute centered overlay
- `.chart-wrap`: Full width container

### Daily List
- `.daily-row`: Flex row, space-between, 6px vertical padding, cursor pointer, bottom border
- `.daily-dot`: 5x5px circle indicator

### Weekly Summary
- `.week-row`: Flex row, 6px gap, 12px top margin/padding, top border
- `.week-pill`: Flex 1, 10px radius, 8px 4px padding, center text, bg-0

### Animations
```css
@keyframes fadeIn { from{opacity:0} to{opacity:1} }
@keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
```

### Scrollbar
Custom webkit scrollbar: 4px width, transparent track, border-colored thumb with 4px radius.

### Safe Area Support
```css
@supports(padding-top: env(safe-area-inset-top)) {
  .app-shell { padding-top: env(safe-area-inset-top); }
}
```

---

## 6. AUTH.JS — Supabase Authentication

This module loads **before** app.js. It handles:

### Supabase Initialization
- Create a Supabase client using `window.supabase.createClient(URL, ANON_KEY)` stored in global `sb`
- Global `currentUser` variable (initially null)

### Auth Screen (`renderAuthScreen()`)
- Full-viewport centered form (max-width 360px)
- "TradeBook" heading + "Trading Journal" subtitle
- Error message div (hidden by default)
- Email input + password input (min 6 chars) + submit button (green #22c55e)
- Toggle between "Sign In" and "Sign Up" modes via click
- On submit: call `sb.auth.signInWithPassword()` or `sb.auth.signUp()`
- On signup without session: show "Check your email to confirm" in green
- On error: show error message in red (#ff6b6b)
- Disable button and show "Signing in/up..." during auth

### Session Management
- `handleAuthChange(event, session)`: On session → set `currentUser`, upsert profile (display_name = email prefix), call `init()`. No session → show auth screen.
- `logout()`: Sign out via Supabase, clear user, show auth screen.

### Boot Sequence
- IIFE `bootAuth()`: Listen for auth state changes, check existing session. If session exists, set user and call `init()`. Otherwise show auth screen.

### Supabase Tables Required
Set up these tables in Supabase with Row Level Security (RLS) filtering by `user_id`:
- `daily_entries` — daily trading summaries
- `trades` — individual trade entries
- `journal_entries` — journal/reflection entries
- `profiles` — user display names (id, display_name)

---

## 7. APP.JS — Core Application (~1000 lines)

### IndexedDB Setup
- Database name: `tradebook`, version 1
- Object stores: `daily`, `trades`, `journal` (all with keyPath `id`)
- Table name mapping: `{ daily: 'daily_entries', trades: 'trades', journal: 'journal_entries' }`

### Database Functions
- `openDB()` — Returns promise that opens/upgrades IndexedDB
- `localGetAll(store)` — Get all records from a store
- `localPut(store, item)` — Put a record
- `localDelete(store, id)` — Delete by id
- `dbGetAll(store)` — Try Supabase first (filtered by user_id), fallback to IndexedDB
- `dbPut(store, item)` — Save to both IndexedDB and Supabase (with user_id)
- `dbPutMany(store, items)` — Batch save to IndexedDB
- `dbDelete(store, id)` — Delete from both

### Field Name Mapping
Supabase uses snake_case, app uses camelCase:
- `toSnake(obj)`: `preMarket` → `pre_market`, `postMarket` → `post_market`, `entry` → `entry_price`, `exit` → `exit_price`
- `toCamel(obj)`: reverse mapping

### Helper Functions
- `uid()`: `Date.now().toString(36) + Math.random().toString(36).slice(2, 7)`
- `today()`: ISO date string `YYYY-MM-DD`
- `fmtDate(iso)`: Short format "Jan 1"
- `fmtDateLong(iso)`: "Mon, Jan 1, 2024"
- `dayNum/monthNum/yearNum(iso)`: Extract date parts (always add `T12:00:00` to prevent timezone issues)
- `fmt(v)`: Format P&L as `+$1,234` or `-$567` (use `String.fromCharCode(36)` for `$`)
- `fmtK(v)`: Abbreviate thousands as `+$1.2K`
- `esc(s)`: XSS-safe HTML escaping via `textContent`/`innerHTML`
- `MONTH_NAMES`: Full month name array
- `daysInMonth(y, m)`: Calendar utility

### Constants
```javascript
const CAT = {
  mindset:     { emoji:'🧠', color:'#60a5fa', label:'Mindset' },
  lesson:      { emoji:'📝', color:'#10b981', label:'Lesson' },
  strategy:    { emoji:'💡', color:'#f59e0b', label:'Strategy' },
  frustration: { emoji:'😤', color:'#ef4444', label:'Vent' },
  goals:       { emoji:'🎯', color:'#a78bfa', label:'Goals' },
  freewrite:   { emoji:'📖', color:'#64748b', label:'Free Write' },
};

const MOOD = {
  locked:     { emoji:'🔥', label:'Locked In' },
  calm:       { emoji:'😌', label:'Calm' },
  neutral:    { emoji:'😐', label:'Neutral' },
  frustrated: { emoji:'😣', label:'Frustrated' },
  anxious:    { emoji:'😰', label:'Anxious' },
};

const RATING_EMOJI = { great:'🟢', okay:'🟡', bad:'🔴' };
```

### Global State
```javascript
let state = {
  tab: 'overview',           // 'overview' | 'calendar' | 'journal'
  daily: [],                 // Array of daily entry objects
  trades: [],                // Array of trade objects
  journal: [],               // Array of journal objects
  loaded: false,
  modal: null,               // null | 'picker' | 'daily' | 'trade' | 'journal' | 'edit-trade'
  viewing: null,             // null | { entry, type: 'daily'|'journal'|'calday' }
  calYear: new Date().getFullYear(),
  calMonth: new Date().getMonth(),
  editingTrade: null,
  charts: {},
};
```

### Render Engine
The `render()` function rebuilds the entire DOM on every state change:

1. If not loaded: show "Loading..." centered
2. If `state.viewing` is set: render detail view
3. Otherwise: render the app shell with:
   - Header: "Trading Journal" label, "TradeBook" heading, Sign Out button
   - Tab bar: 📊 Stats | 📅 Cal | ✍️ Write
   - Tab content: `renderOverview()`, `renderCalendar()`, or `renderJournal()`
   - FAB button ("+")
   - Modal (if `state.modal` is set)
4. After render: call `bindEvents()`, `initCharts()`, analytics init, and `hideSplash()`

### `computeStats()` — Statistics Engine
From `state.daily` array, compute:
- `totalTrades`, `totalWins`, `totalLosses`
- `netPnl`: Sum of all daily P&L
- `winRate`: (totalWins / totalTrades) * 100
- `greenDays` / `redDays`: Count of positive/negative P&L days
- `pf` (Profit Factor): totalWinDollars / totalLossDollars (or "∞")
- `chartData`: Sorted by date, with cumulative P&L (`cumPnl`) and formatted label

### Overview Tab (`renderOverview(stats)`)
Renders a vertical stack of cards:

1. **2x2 Grid of Stat Cards**:
   - **Net P&L** (card-green): Large green mono number (fmtK), trade count + day count
   - **Win Rate**: SVG donut ring (34px radius, green stroke proportional to win rate), percentage in center, W/L counts
   - **Green/Red Days** (card-amber): Format as "XG / YR", green day percentage
   - **Profit Factor** (card-violet): Mono violet number, "Target: >2.0"

2. **Equity Curve Card**: Label "Equity Curve", net P&L display, Chart.js line chart (canvas id `equity-chart`, height 140)

3. **Daily P&L Card**: Label, Chart.js bar chart (canvas id `daily-chart`, height 110), then a list of all daily entries (sorted newest first) as clickable rows with dot indicator, date, trade stats, and P&L amount

4. **Feature Cards** (conditionally rendered if functions exist):
   - Streak card
   - Rule violations card
   - Strategy breakdown card
   - Monthly recap card
   - Export section
   - P&L goals card
   - Analytics cards (drawdown, day-of-week, distribution, risk metrics, rolling, trade size)

### Calendar Tab (`renderCalendar()`)
- Month/year navigation with prev/next buttons (can't go past current month)
- Month name heading with trading day count
- MTD (month-to-date) P&L pill badge
- 7-column grid with S/M/T/W/T/F/S headers
- Each day cell is color-coded by P&L intensity:
  - `>$3000`: dark green bg (#065f46), light green text (#6ee7b7)
  - `>$0`: darker green bg (#064e3b), lighter green text (#a7f3d0)
  - `<-$1000`: dark red bg (#7f1d1d), light red text (#fca5a5)
  - `<$0`: red bg (#991b1b), light red text (#fecaca)
  - `$0`: gray (#374151, #d1d5db)
  - No data: transparent with subtle bg
- Day cells with data are clickable → navigate to calday detail view
- First day cell gets `grid-column-start` set to correct day-of-week
- Weekly summary row at bottom: "Wk 1", "Wk 2", etc. with P&L and day count

### Journal Tab (`renderJournal()`)
- "Writing Journal" label
- Empty state: centered dim text "No entries yet. Tap + to start writing."
- Each journal entry rendered as a `.journal-card`:
  - Category emoji + title (heading-md)
  - Mood emoji
  - Body preview (2-line clamp)
  - Category pill + date
- Sorted newest first
- Cards are clickable → view journal detail

### Detail Views (`renderDetail()`)

**Calendar Day Detail** (`type === 'calday'`):
- Back button, date heading (long format), total P&L
- If daily entry exists: 3-column stat grid (Trades, Wins, Losses), rating pill, session label
- Pre-market notes (amber header with 📋 icon)
- Post-market notes (green header with 📝 icon)
- Delete daily review button
- "Trades (N)" section listing individual trades with: symbol, side pill, P&L, strategy, volume, entry/exit prices, delete button, edit button, notes

**Journal Detail** (`type === 'journal'`):
- Back button, category emoji + title, category pill, long date, mood emoji/label
- Full body text (pre-wrap, 0.875rem, line-height 1.8)
- Delete entry button

**Daily Detail** (`type === 'daily'`):
- Same as calendar day detail but accessed from overview list
- Shows the single daily entry without the trades list

**Detail Event Bindings**:
- Back button: clear `state.viewing`, re-render
- Delete button: remove from state array, delete from DB, clear viewing, re-render
- Delete trade: removes trade, recalculates daily totals, removes auto-created daily entries if no trades remain
- Edit trade: sets `state.editingTrade` and `state.modal = 'edit-trade'`, re-renders

### Modal System (`renderModal()`)

All modals share: overlay with blur, bottom sheet with handle bar, slideUp animation.

**Quick Add Picker** (`state.modal === 'picker'`):
- "Quick Add" heading
- Three picker buttons with large emoji icons:
  - 📅 Daily Review — "Log today's P&L and notes"
  - 📈 Trade Entry — "Log an individual trade"
  - ✍️ Journal Entry — "Write a reflection"

**Daily Review Form** (`state.modal === 'daily'`):
- 📅 Daily Review heading
- Fields: Date (date input, default today), Day P&L (number, step 0.01), Wins (number), Losses (number), Total Trades (number), Rating (select: 🟢 Great / 🟡 Okay / 🔴 Bad), Pre-Market Notes (textarea, 3 rows), Post-Market Review (textarea, 3 rows)
- Back + Save Entry buttons

**Trade Entry Form** (`state.modal === 'trade'`):
- 📈 Trade Entry heading
- Fields: Date (default today), Symbol (default "MNQ"), Side (Long/Short select), Strategy (custom select with "+ Add new..." option), Volume (default 2), Net P&L (number), Entry price, Exit price, Emotions (select: 😌 Calm / 💪 Confident / 🧘 Patient / 😱 FOMO / 😤 Frustration / 🔥 Revenge), Rating (5 star buttons with amber fill), Notes/Setup (textarea, 2 rows)
- Back + Save Trade buttons

**Edit Trade Form** (`state.modal === 'edit-trade'`):
- ✏️ Edit Trade heading
- Pre-populated with existing trade data
- Cancel + Update Trade buttons

**Journal Entry Form** (`state.modal === 'journal'`):
- ✍️ Journal Entry heading
- Fields: Title, Date, Category (🧠 Mindset / 📝 Lesson / 💡 Strategy / 😤 Vent / 🎯 Goals / 📖 Free Write), Mood (🔥 Locked In / 😌 Calm / 😐 Neutral / 😣 Frustrated / 😰 Anxious), Write body (textarea, 6 rows)
- Back + Save Entry buttons

### Modal Interactions
- Click overlay backdrop → close modal
- Swipe down on sheet → dismiss (touchstart/touchmove/touchend: track Y delta, translate sheet, dismiss if dy > 80px with 200ms slide-out animation)
- Picker buttons → switch to selected form
- Star buttons → visual fill up to clicked star, store rating in `data-rating` attribute
- Back buttons → return to picker

### Charts (Chart.js Integration)

**Equity Curve** (line chart):
- Green line (#10b981), 2px width, 0.3 tension
- Green gradient fill (0.2 → 0 opacity)
- 3px point radius with dark border
- Y-axis: `$Xk` format
- Dark tooltip styling (#1f2937 bg, #374151 border)

**Daily P&L** (bar chart):
- Green bars for positive, red for negative (75% opacity)
- 4px border radius, 16px bar thickness
- Same axis and tooltip styling

**Chart Defaults**: DM Sans font, #374151 color, no legends displayed.

### Save Logic (`handleSave()`)

**Daily Entry**:
```javascript
{ id: uid(), date, pnl, trades, wins, losses, rating, session: 'New York', preMarket, postMarket, reviewed: false }
```

**Trade Entry**:
```javascript
{ id: uid(), date, symbol, side, strategy, pnl, volume, entry, exit, emotions, rating, notes }
```
After saving a trade, **auto-update daily totals**: find or create a daily entry for that date, recalculate P&L/wins/losses from all trades on that date. Auto-created daily entries have id format: `auto_{userId}_{date}`.

**Journal Entry**:
```javascript
{ id: uid(), date, title, category, mood, body }
```

**Edit Trade**: Update trade in state array by index, persist, recalculate daily totals.

### Event Bindings (`bindEvents()`)
- Sign Out button → `logout()`
- Tab buttons → update `state.tab`, re-render
- FAB → open picker modal
- Modal overlay click → close
- Picker buttons → switch modal type
- Star rating buttons → visual update
- Save button → `handleSave()`
- Daily row clicks → view daily detail
- Journal card clicks → view journal detail
- Calendar nav (prev/next month)
- Calendar day clicks → view calday detail
- Feature bindings: export buttons, strategy select, P&L goals

### Init Function
```javascript
async function init() {
  const [daily, trades, journal] = await Promise.all([
    dbGetAll('daily'), dbGetAll('trades'), dbGetAll('journal')
  ]);
  state.daily = daily;
  state.trades = trades;
  state.journal = journal;
  state.loaded = true;
  render();
}
```

### Service Worker Registration
```javascript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(function() {});
}
```

### Fallback Boot
If no auth module (`sb` undefined), boot via `DOMContentLoaded`.

---

## 8. FEATURES.JS — Extended Features Module

### Custom Strategies
- Stored in `localStorage` key `tb_custom_strategies` (JSON array)
- Default strategies: `['ORB Breakout', 'EMA Tap', 'Supply Reject', 'Demand Bounce', 'Reversal']`
- `getAllStrategies()`: defaults + custom
- `addCustomStrategy(name)` / `removeCustomStrategy(name)`
- `renderStrategySelect(id, selected)`: Renders `<select>` with all strategies + "+ Add new..." option
- `bindStrategySelect(selectId)`: On selecting "+ Add new...", prompt user for name, add to list, re-render select

### Streak Tracker
- `computeStreaks(daily, journal)`: Returns `{ greenStreak, journalStreak, bestStreak }`
  - **Green streak**: Count consecutive profitable days from most recent backwards
  - **Journal streak**: Count consecutive days with journal entries from today backwards
  - **Best streak**: Longest ever consecutive green day run
- `renderStreakCard()`: Card with 3-column grid showing streaks with fire emojis (🔥×1/2/3 based on streak length)

### Rule Violations
- `checkRules(daily)`: Checks last 10 days for:
  - **Over-trading** (high severity): >5 trades in a day
  - **Revenge Trading** (high severity): 3+ losses and continued trading
  - **Emotional Trading** (medium severity): Bad day rating + >3 trades
- Returns max 5 violations with date, rule name, detail, severity
- `renderRuleViolations()`: If clean → green card with ✅ "Clean Record". Otherwise → red card listing violations with severity indicators (🔴/🟡)

### Strategy Breakdown
- `getStrategyBreakdown(trades)`: Groups trades by strategy, computes totalPnl, wins, losses, count per strategy. Sorted by P&L descending.
- `renderStrategyBreakdown()`: Card listing each strategy with:
  - Rank (#1, #2...), name, total P&L
  - Progress bar (width proportional to max P&L, green/red colored)
  - Trade count + win rate percentage

### Monthly Recap
- `computeMonthlyRecap(daily, trades, journal)`: Current month stats including totalPnl, greenDays, redDays, bestDay, worstDay, avgPnl, totalTrades, winRate, journalCount, weekly breakdown, strategy breakdown
- `renderMonthlyRecap()`: Two cards:
  1. Main recap: 2x2 stats grid, best/worst day rows, journal count
  2. Weekly breakdown: Horizontal flex of weekly P&L pills

### CSV Export
- `exportDailyCSV(daily)` / `exportTradesCSV(trades)` / `exportJournalCSV(journal)`: Generate CSV strings and trigger download via blob URL + hidden anchor click
- `renderExportSection()`: Card with 4 buttons (Daily P&L, Trades, Journal, Export All) + "Sync Daily Totals from Trades" button
- `bindExportButtons()`: Attach click handlers; Export All triggers all three with 300ms delays. Sync button recalculates all daily entries from trade data and removes orphaned auto-entries.

### P&L Goal Tracker
- Goals stored in `localStorage` key `tb_pnl_goals` (JSON: `{ daily, monthly }`)
- `renderPnlGoals(daily)`: Card with:
  - Edit button that toggles inline goal input form
  - 2-column grid: Today's P&L vs daily goal, This Month's P&L vs monthly goal
  - Progress bars with color coding: ≥100% green, ≥50% amber, otherwise blue
  - Percentage display
- `bindPnlGoals()`: Toggle edit form, save goals to localStorage, re-render card in place

---

## 9. ANALYTICS.JS — Advanced Analytics Module

Exposed as `window.TradeBookAnalytics` with `renderAll(daily)` and `initAll(daily)` methods.

### Drawdown Analysis
- `computeDrawdown(dailyEntries)`: Track cumulative P&L, peak, max drawdown, current drawdown, days in drawdown
- `renderDrawdownCard()`: 3-column stats (Max DD, Current DD, Days in DD) + line chart
- `initDrawdownChart()`: Red line chart with red fill (15% opacity), no point radius

### Day-of-Week Performance
- `computeDayOfWeek(dailyEntries)`: For each day (Sun-Sat), compute total P&L, wins, losses, avgPnl, winRate
- `renderDayOfWeekCard()`: Best/worst day callout + bar chart + win rate row for trading days (Mon-Fri)
- `initDayOfWeekChart()`: Green/red bar chart by day

### P&L Distribution
- `computeDistribution(dailyEntries)`: Calculate mean, median, std dev, skew direction. Create histogram buckets (max 10).
- `renderDistributionCard()`: 3-column stats (Mean, Median, Std Dev) + histogram chart + skew description
- `initDistributionChart()`: Green/red bar chart based on bucket sign

### Risk Metrics
- `computeRiskMetrics(dailyEntries)`: Calculate:
  - **Sharpe Ratio**: `(mean / stdDev) * sqrt(252)` (annualized)
  - **Sortino Ratio**: `(mean / downsideDev) * sqrt(252)` (downside only)
  - **Expectancy/Day**: `(winRate * avgWin) - ((1-winRate) * avgLoss)`
  - **Payoff Ratio**: `avgWin / avgLoss`
  - **Win Rate** and **Daily Volatility**
- `renderRiskMetricsCard()`: Table of metrics with color-coded values and targets
- Color logic: `metricColor(val, [lowThreshold, highThreshold])` → red/amber/green

### Rolling Performance (5-Day Window)
- `computeRolling(dailyEntries, windowDays)`: Sliding window P&L, win rate, green day percentage
- `renderRollingCard()`: Trend indicator (↗ Improving / ↘ Declining) + line chart
- `initRollingChart()`: Multi-colored line using Chart.js `segment` option (green when positive, red when negative, amber at crossover)

### Trade Count vs P&L Correlation
- `computeTradeSizeCorrelation(dailyEntries)`: Pearson correlation coefficient between trade count and P&L, green day avg trades, red day avg trades, interpretation text
- `renderTradeSizeCard()`: 3-column stats (Correlation, Green Day Avg, Red Day Avg) + interpretation box

### Public API
```javascript
window.TradeBookAnalytics = {
  renderAll(daily) { /* returns concatenated HTML strings of all cards */ },
  initAll(daily) { /* initializes all Chart.js instances */ },
  // Plus individual render/init functions
};
```

All analytics cards require minimum 5 daily entries to render (graceful degradation with empty string return).

---

## 10. DATA SCHEMAS

### Daily Entry
```javascript
{
  id: string,              // uid() or "auto_{userId}_{date}"
  date: "YYYY-MM-DD",
  pnl: number,
  trades: number,
  wins: number,
  losses: number,
  rating: "great" | "okay" | "bad",
  session: "New York",
  preMarket: string,
  postMarket: string,
  reviewed: boolean
}
```

### Trade Entry
```javascript
{
  id: string,
  date: "YYYY-MM-DD",
  symbol: string,           // default "MNQ"
  side: "Long" | "Short",
  strategy: string,         // default "ORB Breakout"
  pnl: number,
  volume: number,           // default 2
  entry: number,            // entry price
  exit: number,             // exit price
  emotions: "calm" | "confident" | "patient" | "FOMO" | "frustration" | "revenge",
  rating: 1-5,              // star rating
  notes: string
}
```

### Journal Entry
```javascript
{
  id: string,
  date: "YYYY-MM-DD",
  title: string,
  category: "mindset" | "lesson" | "strategy" | "frustration" | "goals" | "freewrite",
  mood: "locked" | "calm" | "neutral" | "frustrated" | "anxious",
  body: string
}
```

---

## 11. SUPABASE SCHEMA

### Tables

**`profiles`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | References auth.users |
| display_name | text | Email prefix |

**`daily_entries`**
| Column | Type | Notes |
|--------|------|-------|
| id | text (PK) | uid() |
| user_id | uuid | References auth.users |
| date | text | YYYY-MM-DD |
| pnl | numeric | |
| trades | integer | |
| wins | integer | |
| losses | integer | |
| rating | text | great/okay/bad |
| session | text | |
| pre_market | text | Note: snake_case |
| post_market | text | Note: snake_case |
| reviewed | boolean | |

**`trades`**
| Column | Type | Notes |
|--------|------|-------|
| id | text (PK) | uid() |
| user_id | uuid | References auth.users |
| date | text | |
| symbol | text | |
| side | text | |
| strategy | text | |
| pnl | numeric | |
| volume | integer | |
| entry_price | numeric | Note: snake_case |
| exit_price | numeric | Note: snake_case |
| emotions | text | |
| rating | integer | |
| notes | text | |

**`journal_entries`**
| Column | Type | Notes |
|--------|------|-------|
| id | text (PK) | uid() |
| user_id | uuid | References auth.users |
| date | text | |
| title | text | |
| category | text | |
| mood | text | |
| body | text | |

### Row Level Security
All tables should have RLS enabled with policies that restrict SELECT, INSERT, UPDATE, DELETE to rows where `user_id = auth.uid()`.

---

## 12. KEY BEHAVIORAL DETAILS

1. **Offline-first**: Always save to IndexedDB immediately, then attempt Supabase sync in background. Silent failures on cloud sync.
2. **Auto daily totals**: When saving a trade, automatically create or update the daily entry for that date by summing all trades.
3. **Auto-entry cleanup**: When deleting the last trade on a day, remove auto-created daily entries (ids starting with `auto_`).
4. **Sync button**: Manual recalculation of all daily totals from trades, with progress feedback.
5. **Timezone safety**: Always append `T12:00:00` when creating `Date` objects from ISO date strings to avoid UTC offset issues.
6. **Calendar navigation**: Can go back indefinitely but cannot go forward past current month.
7. **No build process**: Everything runs directly in the browser with no transpilation.
8. **Mobile-first**: Max-width 480px, no desktop breakpoints, safe-area-inset support throughout.
9. **Full re-render**: Every state change triggers a complete DOM rebuild via `render()` → `bindEvents()`. No virtual DOM, no diffing.
10. **Star rating**: Clicking a star fills all stars up to that one (visual only), stores value in parent `data-rating` attribute.

---

## 13. VISUAL DESIGN SPECIFICATIONS

- **Theme**: Ultra-dark (near-black backgrounds), high contrast with green/red accents
- **Primary action color**: Green gradient (#10b981 → #059669)
- **Negative indicator**: Red (#ef4444)
- **Warning/secondary**: Amber (#f59e0b)
- **Accent**: Violet (#818cf8) for profit factor, streaks
- **Numbers**: Always in JetBrains Mono
- **Cards**: Subtle gradient with colored glow pseudo-element
- **Modals**: Bottom sheet pattern (iOS-style) with backdrop blur
- **Interactions**: 0.15s transitions, scale(0.92) on press, swipe-to-dismiss on modals
- **Noise texture**: Fractal noise SVG overlay at 1.5% opacity for organic feel

---

Build this app exactly as described. Every file should be complete and production-ready. The app should work fully offline after first load, sync to Supabase when online, and provide a native-app-like experience on mobile devices.
