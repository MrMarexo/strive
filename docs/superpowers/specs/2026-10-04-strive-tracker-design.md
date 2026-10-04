# Strive — Self-Improvement Tracker: Design Spec

Date: 2026-10-04
Status: Approved in brainstorming, pending written-spec review

## 1. Purpose

A personal browser app for tracking daily and weekly self-improvement habits. Completing tasks earns points; failing them costs points. The point total determines a medieval-fantasy rank, from **Beggar** to **Legend of the Realm**. Success means the user opens it every day, taps what they did, and trusts the scoring rules.

## 2. Scope

**In scope:** single-page React + TypeScript app (Vite), no backend, state in `localStorage`, one main screen, automatic settlement of finished days/weeks, retro pixel-art visual style.

**Out of scope (for now):** history/stats views, editing past days, custom/user-defined tasks, notifications, multiple users, sync.

## 3. Tasks

| Id | Name | Cadence | Max per day |
|---|---|---|---|
| `reading` | Reading | daily | 1 |
| `coding` | Coding | weekly, target 5 | 1 |
| `running` | Running | daily | 1 |
| `sport` | Sport & Exercise | weekly, target 4 | 1 |
| `abstinence` | Abstinence | daily | 1 |
| `logic` | Logic Workout | daily | 1 |
| `chores` | House Chores | weekly, target 4 | unlimited |
| `language` | Language Learning | daily | 1 |

```ts
type TaskId = 'reading' | 'coding' | 'running' | 'sport'
            | 'abstinence' | 'logic' | 'chores' | 'language';

interface TaskDef {
  id: TaskId;
  name: string;
  cadence: { kind: 'daily' } | { kind: 'weekly'; target: number };
  maxPerDay: number | null; // null = unlimited
}
```

## 4. Scoring rules

- Week runs **Monday–Sunday** in the device's local time zone. A day ends at local midnight.
- **Daily task:** completed that day → **+1**; not completed → **−2**. Awarded when the day is settled.
- **Weekly task:** each completion → **+1**, awarded when that day is settled, **capped at the weekly target** (completions beyond the target are recorded but earn 0).
- **Weekly shortfall:** when a Sunday is settled, each weekly task applies **−2 × (target − min(completions, target))**.
  - Example: Sport & Exercise target 4, done 1 → +1 on the day done, −6 at week end.
- **Floor:** points never go below 0. Clamping is applied after each day's net change, and again after the Sunday weekly penalty (not after each individual task).
  - Example: 1 point, a day nets +3 −4 = −1 → 0.
- Anything not marked done by end of day counts as failed. There is no "skip" or "rest day".
- **First-week grace:** no weekly shortfall penalty is applied for the week (Mon–Sun) in which the app was first opened. Daily scoring and weekly +1s apply normally that week.

## 5. Ranks

Rank is derived from `points` at render time; it is never stored. Losing points can drop rank.

| # | Title | Min points |
|---|---|---|
| 1 | Beggar | 0 |
| 2 | Peasant | 5 |
| 3 | Stable Hand | 15 |
| 4 | Squire | 30 |
| 5 | Man-at-Arms | 50 |
| 6 | Knight | 75 |
| 7 | Ranger | 105 |
| 8 | Battlemage | 140 |
| 9 | Lord | 180 |
| 10 | Paladin | 225 |
| 11 | Archmage | 275 |
| 12 | Dragon Slayer | 330 |
| 13 | King | 390 |
| 14 | Wizard of the White Order | 460 |
| 15 | Legend of the Realm | 550 |

A perfect week yields 48 points (35 daily + 13 weekly), so the top rank takes ~11–12 flawless weeks.

`getRank(points)` returns `{ current, next | null, progress }`, where `progress` is the fraction (0–1) from `current.min` to `next.min`; at the top rank `next` is `null` and `progress` is 1.

## 6. State and persistence

Single `localStorage` key: `strive:v1`.

```ts
interface AppState {
  version: 1;
  points: number;          // settled total, >= 0
  lastSettledDate: string; // 'YYYY-MM-DD' (local), last day already scored
  completions: Record<string, Partial<Record<TaskId, number>>>;
                           // dateKey -> taskId -> count; current week only
  graceWeek: string;       // Monday of the week the app was first opened
}
```

- **First launch / missing / invalid data:** fresh state — `points: 0`, `lastSettledDate: yesterday`, `completions: {}`, `graceWeek: mondayOf(today)`. Invalid data logs a console warning.
- **Save failure** (quota, private mode): caught and logged; app continues in memory.

## 7. Settlement

`settle(state, todayKey): AppState` — pure function. For each day `d` from `lastSettledDate + 1` through `todayKey − 1`, in order:

1. Daily tasks: count ≥ 1 → +1, else −2.
2. Weekly tasks: +1 per completion on `d`, only while the week's running total (Monday through `d`) is within the target.
3. `points = max(0, points + dayNet)`.
4. If `d` is a Sunday: unless `mondayOf(d) === graceWeek`, for each weekly task, `points = max(0, points − 2 × shortfall)` (penalties summed, single clamp), then delete all completions with date keys in that Monday–Sunday week.
5. `lastSettledDate = d`.

Properties:
- **Idempotent:** `settle(settle(s, t), t)` equals `settle(s, t)`.
- **Gaps:** long absences settle every missed day as failed, including Sunday penalties for each spanned week.
- Today is never settled; it remains editable.

**Triggers:** on app load, on window `focus`/`visibilitychange` to visible, and every 60 seconds while open (catches midnight rollover).

## 8. Actions

Pure functions, applied to **today only**:

- `complete(state, taskId, todayKey)`: increments today's count unless `maxPerDay` is reached (no-op otherwise).
- `undo(state, taskId, todayKey)`: decrements today's count, never below 0.

## 9. Selectors

- `weekCount(state, taskId, todayKey)`: completions Monday→today for the current week.
- `remainingThisWeek(...)`: `max(0, target − weekCount)`.
- `isAtRisk(...)`: weekly task with `maxPerDay === 1` where `remaining > availableDays`. `availableDays` = days left in the week after today, plus 1 if the task is not yet done today. E.g. Saturday, 3 left, not done today → available 2 → at risk. Tasks with unlimited `maxPerDay` (chores) are never at risk.
- `pendingToday(state, todayKey)`: points today's completions would earn if settled now (daily +1 each; weekly +1 each within the cap). Display only; excludes penalties.

## 10. UI

Single screen, retro old-school video game / terminal aesthetic.

**Visual language**
- Background `#000`. Primary color purple `#B48CFF` for all text, borders and sprites. Dim purple `#5A3F8C` for empty bar cells, disabled controls and secondary text. No other colors.
- Font: **VT323** (Google Fonts) throughout; rank title rendered large.
- Square corners, 2px solid purple borders.
- Buttons styled `[ MARK DONE ]`; when done, inverted (purple fill, black text) `[ DONE ✓ ]`.
- Blinking `▮` cursor after the rank title.

**Header**
- Rank title, settled points (`112 PTS`).
- Text progress bar of 20 cells using `▓` (filled) and `░` (empty) proportional to `progress`, followed by `N TO <NEXT RANK>` (or `MAX RANK` at the top).
- `TODAY: +N PENDING · WEEK OF <Mon date>`.

**Task grid** — responsive: 1 column (phone), 2 (tablet), 4 (desktop).

**TaskCard** (maxPerDay = 1)
- 10×10 pixel sprite, task name, subtitle: `DAILY` or `N LEFT THIS WEEK` / `TARGET MET`, plus `AT RISK` label when applicable.
- Toggle button: `[ MARK DONE ]` ↔ `[ DONE ✓ ]` (tapping done undoes, today only).

**CounterCard** (chores)
- Sprite, name, `[-] N [+]` counter showing today's count, subtitle `N LEFT THIS WEEK` / `TARGET MET`. `[-]` disabled at 0.

**Sprites**
- Each sprite is a 10×10 `string[]` map (`#` = filled, `.` = empty), rendered by `PixelSprite` as SVG `<rect>`s with `shape-rendering: crispEdges`, scaled to ~80px (8px per pixel), single purple color.
- Eight sprites: book (reading), laptop (coding), running shoe (running), dumbbell (sport), shield (abstinence), chess knight (logic), broom (chores), speech bubble (language).

## 11. Code structure

```
src/
  domain/
    tasks.ts        # TASKS definitions
    ranks.ts        # RANKS table, getRank
    dates.ts        # toKey, addDays, mondayOf, isSunday, daysLeftInWeek
    settle.ts       # settle()
    actions.ts      # complete(), undo()
    selectors.ts    # weekCount, remainingThisWeek, isAtRisk, pendingToday
  storage/
    persist.ts      # load(), save(), freshState()
  state/
    useAppState.ts  # useReducer; settle on mount/focus/60s; save on change
  ui/
    Header.tsx
    TaskGrid.tsx
    TaskCard.tsx
    CounterCard.tsx
    PixelSprite.tsx
    sprites.ts
  App.tsx
  main.tsx
  index.css
```

Domain modules have no React or storage dependencies. `useAppState` is the only place that touches time and storage.

## 12. Testing (Vitest + React Testing Library)

- **settle:** perfect day; all daily missed; weekly cap (6 chores → +4); Sunday shortfall (1 of 4 sport → +1, −6); clamp with daily netting; multi-day and multi-week gaps; first launch; first-week grace; idempotency; week completions cleared after Sunday.
- **actions:** maxPerDay enforcement; chores accumulate; undo floor at 0.
- **ranks:** threshold boundaries, progress fraction, top rank.
- **selectors:** remaining, target met, at-risk on Saturday with 3 left, pendingToday with cap.
- **persist:** invalid JSON / wrong version → fresh state.
- **UI smoke:** marking a task done flips the button and updates pending points; chores counter increments/decrements.
