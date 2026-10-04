# Strive Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-only React + TypeScript habit tracker that scores daily/weekly tasks, settles points at day/week boundaries, and shows a medieval-fantasy rank in a retro purple-on-black pixel style.

**Architecture:** All scoring rules live in pure TypeScript modules under `src/domain/` (no React, no storage, no clock). `src/storage/persist.ts` is the only code touching `localStorage`; `src/state/useAppState.ts` is the only code reading the clock — it settles on load, focus, and every 60 s, and persists every change. The UI under `src/ui/` is presentational and reads derived values via selectors.

**Tech Stack:** Vite, React 19, TypeScript (strict), plain CSS, Vitest + jsdom + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-04-strive-tracker-design.md`

## Global Constraints

- No backend, no network calls except the Google Fonts stylesheet for **VT323**.
- State persisted under a single `localStorage` key: `strive:v1`.
- Dates are local-time keys `'YYYY-MM-DD'`; week is Monday–Sunday; a day ends at local midnight.
- First-week grace: no Sunday shortfall penalty for the week equal to `state.graceWeek` (Monday of the week the app was first opened).
- Scoring: completion **+1**; missed daily task **−2**; weekly shortfall **−2 × (target − min(count, target))** at Sunday settlement; weekly points capped at target; points clamped to ≥ 0 after each day's net and again after the Sunday penalty.
- Colors: background `#000`, primary `#B48CFF`, dim `#5A3F8C`. No other colors.
- Sprites are 10×10 `string[]` maps of `#` / `.`.
- No UI or state libraries (no Tailwind, no Zustand, no router).
- Reference test week: Mon `2026-09-28` … Sun `2026-10-04`; next Monday `2026-10-05`.
- Commit messages end with the line `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

1. **Midnight passes while the app stays open** → yesterday must be settled automatically within ~60 s without a reload. Pinned in Task 6.
2. **User taps a task just after midnight, before the 60 s tick fires** → the tap must count for the new day, and the previous day must be settled first. Pinned in Task 6.
3. **Hand-edited or corrupted `localStorage`** (bad JSON, wrong version, negative/string points, unknown task ids) → app starts fresh with a console warning instead of crashing or scoring garbage. Pinned in Task 5.
4. **Device clock moved backwards** (today ≤ `lastSettledDate`) → settlement is a no-op; no double-scoring, no crash. Pinned in Task 3.
5. **`localStorage` unavailable** (private mode / quota: `getItem` or `setItem` throws) → app keeps working in memory. Pinned in Task 5.

---

## File Structure

```
index.html                  # shell + VT323 font link
package.json, tsconfig.json, vite.config.ts, .gitignore
src/
  main.tsx                  # React root
  App.tsx                   # composes Header + TaskGrid with useAppState
  App.test.tsx              # UI smoke tests
  index.css                 # retro theme
  test/setup.ts             # jest-dom matchers
  domain/
    dates.ts (+ .test.ts)   # date-key helpers
    tasks.ts (+ .test.ts)   # TaskId, TaskDef, TASKS, getTask
    ranks.ts (+ .test.ts)   # RANKS, getRank
    types.ts                # AppState, DayCompletions
    counts.ts               # completion counting helpers shared by settle/selectors
    settle.ts (+ .test.ts)  # settle()
    actions.ts (+ .test.ts) # complete(), undo()
    selectors.ts (+ .test.ts)
  storage/
    persist.ts (+ .test.ts) # load(), save(), freshState(), isValidState()
  state/
    useAppState.ts (+ .test.ts)
  ui/
    format.ts (+ .test.ts)  # barCells, formatWeekOf, cadenceLabel
    sprites.ts (+ .test.ts) # SPRITES
    PixelSprite.tsx
    Header.tsx (+ .test.tsx)
    TaskCard.tsx            # also exports CardProps
    CounterCard.tsx
    TaskGrid.tsx
```

---

### Task 1: Project scaffold and date helpers

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/test/setup.ts`
- Create: `src/domain/dates.ts`
- Test: `src/domain/dates.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces (`src/domain/dates.ts`):
  - `type DateKey = string`
  - `toKey(date: Date): DateKey`
  - `fromKey(key: DateKey): Date` (local noon)
  - `addDays(key: DateKey, n: number): DateKey`
  - `dayOfWeek(key: DateKey): number` (0 = Monday … 6 = Sunday)
  - `mondayOf(key: DateKey): DateKey`
  - `isSunday(key: DateKey): boolean`
  - `daysLeftAfter(key: DateKey): number` (days remaining in the week after `key`)
  - `weekDays(key: DateKey): DateKey[]` (Mon…Sun of `key`'s week)

- [ ] **Step 1: Create config files**

`package.json`:
```json
{
  "name": "strive",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["src", "vite.config.ts"]
}
```

`vite.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

`.gitignore`:
```
node_modules
dist
*.log
.DS_Store
```

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Strive</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=VT323&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/App.tsx` (placeholder, replaced in Task 8):
```tsx
export default function App() {
  return <main className="app">STRIVE</main>;
}
```

`src/index.css` (placeholder, replaced in Task 7):
```css
body { background: #000; color: #b48cff; }
```

`src/test/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 2: Install dependencies**

Run:
```bash
npm install react react-dom
npm install -D vite @vitejs/plugin-react typescript vitest jsdom @testing-library/react @testing-library/dom @testing-library/jest-dom @types/react @types/react-dom
```
Expected: installs complete without errors.

- [ ] **Step 3: Write the failing date tests**

`src/domain/dates.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { addDays, dayOfWeek, daysLeftAfter, fromKey, isSunday, mondayOf, toKey, weekDays } from './dates';

describe('dates', () => {
  it('formats a local date as YYYY-MM-DD', () => {
    expect(toKey(new Date(2026, 8, 28, 23, 59))).toBe('2026-09-28');
    expect(toKey(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05');
  });

  it('round-trips keys through fromKey', () => {
    expect(toKey(fromKey('2026-10-04'))).toBe('2026-10-04');
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30');
  });

  it('adds days across a DST change', () => {
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
  });

  it('numbers weekdays Monday=0 to Sunday=6', () => {
    expect(dayOfWeek('2026-09-28')).toBe(0);
    expect(dayOfWeek('2026-10-03')).toBe(5);
    expect(dayOfWeek('2026-10-04')).toBe(6);
  });

  it('finds the Monday of a week', () => {
    expect(mondayOf('2026-09-28')).toBe('2026-09-28');
    expect(mondayOf('2026-10-04')).toBe('2026-09-28');
    expect(mondayOf('2026-10-05')).toBe('2026-10-05');
  });

  it('detects Sundays', () => {
    expect(isSunday('2026-10-04')).toBe(true);
    expect(isSunday('2026-10-03')).toBe(false);
  });

  it('counts days left in the week after a date', () => {
    expect(daysLeftAfter('2026-09-28')).toBe(6);
    expect(daysLeftAfter('2026-10-03')).toBe(1);
    expect(daysLeftAfter('2026-10-04')).toBe(0);
  });

  it('lists the seven days of a week', () => {
    expect(weekDays('2026-10-01')).toEqual([
      '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01',
      '2026-10-02', '2026-10-03', '2026-10-04',
    ]);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run src/domain/dates.test.ts`
Expected: FAIL — cannot resolve `./dates`.

- [ ] **Step 5: Implement `src/domain/dates.ts`**

```ts
export type DateKey = string;

export function toKey(date: Date): DateKey {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Noon avoids DST edge cases when shifting by whole days.
export function fromKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function addDays(key: DateKey, n: number): DateKey {
  const date = fromKey(key);
  date.setDate(date.getDate() + n);
  return toKey(date);
}

export function dayOfWeek(key: DateKey): number {
  return (fromKey(key).getDay() + 6) % 7;
}

export function mondayOf(key: DateKey): DateKey {
  return addDays(key, -dayOfWeek(key));
}

export function isSunday(key: DateKey): boolean {
  return dayOfWeek(key) === 6;
}

export function daysLeftAfter(key: DateKey): number {
  return 6 - dayOfWeek(key);
}

export function weekDays(key: DateKey): DateKey[] {
  const monday = mondayOf(key);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}
```

- [ ] **Step 6: Run tests and build**

Run: `npx vitest run src/domain/dates.test.ts && npm run build`
Expected: all date tests PASS; build succeeds and writes `dist/`.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "chore: scaffold Vite React TS app with date helpers"
```

---

### Task 2: Task definitions and ranks

**Files:**
- Create: `src/domain/tasks.ts`, `src/domain/ranks.ts`
- Test: `src/domain/tasks.test.ts`, `src/domain/ranks.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces (`src/domain/tasks.ts`):
  - `type TaskId = 'reading' | 'coding' | 'running' | 'sport' | 'abstinence' | 'logic' | 'chores' | 'language'`
  - `type Cadence = { kind: 'daily' } | { kind: 'weekly'; target: number }`
  - `interface TaskDef { id: TaskId; name: string; cadence: Cadence; maxPerDay: number | null }`
  - `const TASKS: TaskDef[]` (display order)
  - `getTask(id: TaskId): TaskDef`
- Produces (`src/domain/ranks.ts`):
  - `interface Rank { title: string; min: number }`
  - `const RANKS: Rank[]`
  - `interface RankInfo { current: Rank; next: Rank | null; progress: number; toNext: number }`
  - `getRank(points: number): RankInfo`

- [ ] **Step 1: Write the failing tests**

`src/domain/tasks.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { TASKS, getTask } from './tasks';

describe('tasks', () => {
  it('defines the eight tasks in display order', () => {
    expect(TASKS.map((t) => t.id)).toEqual([
      'reading', 'coding', 'running', 'sport', 'abstinence', 'logic', 'chores', 'language',
    ]);
  });

  it('sets weekly targets', () => {
    expect(getTask('coding').cadence).toEqual({ kind: 'weekly', target: 5 });
    expect(getTask('sport').cadence).toEqual({ kind: 'weekly', target: 4 });
    expect(getTask('chores').cadence).toEqual({ kind: 'weekly', target: 4 });
  });

  it('makes the remaining tasks daily', () => {
    const daily = TASKS.filter((t) => t.cadence.kind === 'daily').map((t) => t.id);
    expect(daily).toEqual(['reading', 'running', 'abstinence', 'logic', 'language']);
  });

  it('allows only chores more than once per day', () => {
    for (const task of TASKS) {
      expect(task.maxPerDay).toBe(task.id === 'chores' ? null : 1);
    }
  });
});
```

`src/domain/ranks.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { RANKS, getRank } from './ranks';

describe('ranks', () => {
  it('has 15 ascending ranks from Beggar at 0 to Legend of the Realm at 550', () => {
    expect(RANKS).toHaveLength(15);
    expect(RANKS[0]).toEqual({ title: 'Beggar', min: 0 });
    expect(RANKS[14]).toEqual({ title: 'Legend of the Realm', min: 550 });
    for (let i = 1; i < RANKS.length; i++) {
      expect(RANKS[i].min).toBeGreaterThan(RANKS[i - 1].min);
    }
  });

  it('starts at Beggar', () => {
    expect(getRank(0)).toEqual({ current: RANKS[0], next: RANKS[1], progress: 0, toNext: 5 });
  });

  it('promotes exactly at the threshold', () => {
    expect(getRank(4).current.title).toBe('Beggar');
    expect(getRank(5).current.title).toBe('Peasant');
  });

  it('computes progress toward the next rank', () => {
    const info = getRank(80);
    expect(info.current.title).toBe('Knight');
    expect(info.next?.title).toBe('Ranger');
    expect(info.toNext).toBe(25);
    expect(info.progress).toBeCloseTo(5 / 30);
  });

  it('caps at the top rank', () => {
    for (const points of [550, 9999]) {
      const info = getRank(points);
      expect(info.current.title).toBe('Legend of the Realm');
      expect(info.next).toBeNull();
      expect(info.progress).toBe(1);
      expect(info.toNext).toBe(0);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/domain/tasks.test.ts src/domain/ranks.test.ts`
Expected: FAIL — cannot resolve `./tasks` / `./ranks`.

- [ ] **Step 3: Implement `src/domain/tasks.ts`**

```ts
export type TaskId =
  | 'reading' | 'coding' | 'running' | 'sport'
  | 'abstinence' | 'logic' | 'chores' | 'language';

export type Cadence = { kind: 'daily' } | { kind: 'weekly'; target: number };

export interface TaskDef {
  id: TaskId;
  name: string;
  cadence: Cadence;
  maxPerDay: number | null; // null = unlimited
}

const daily: Cadence = { kind: 'daily' };

export const TASKS: TaskDef[] = [
  { id: 'reading', name: 'Reading', cadence: daily, maxPerDay: 1 },
  { id: 'coding', name: 'Coding', cadence: { kind: 'weekly', target: 5 }, maxPerDay: 1 },
  { id: 'running', name: 'Running', cadence: daily, maxPerDay: 1 },
  { id: 'sport', name: 'Sport & Exercise', cadence: { kind: 'weekly', target: 4 }, maxPerDay: 1 },
  { id: 'abstinence', name: 'Abstinence', cadence: daily, maxPerDay: 1 },
  { id: 'logic', name: 'Logic Workout', cadence: daily, maxPerDay: 1 },
  { id: 'chores', name: 'House Chores', cadence: { kind: 'weekly', target: 4 }, maxPerDay: null },
  { id: 'language', name: 'Language Learning', cadence: daily, maxPerDay: 1 },
];

export function getTask(id: TaskId): TaskDef {
  const task = TASKS.find((t) => t.id === id);
  if (!task) throw new Error(`Unknown task: ${id}`);
  return task;
}
```

- [ ] **Step 4: Implement `src/domain/ranks.ts`**

```ts
export interface Rank {
  title: string;
  min: number;
}

export const RANKS: Rank[] = [
  { title: 'Beggar', min: 0 },
  { title: 'Peasant', min: 5 },
  { title: 'Stable Hand', min: 15 },
  { title: 'Squire', min: 30 },
  { title: 'Man-at-Arms', min: 50 },
  { title: 'Knight', min: 75 },
  { title: 'Ranger', min: 105 },
  { title: 'Battlemage', min: 140 },
  { title: 'Lord', min: 180 },
  { title: 'Paladin', min: 225 },
  { title: 'Archmage', min: 275 },
  { title: 'Dragon Slayer', min: 330 },
  { title: 'King', min: 390 },
  { title: 'Wizard of the White Order', min: 460 },
  { title: 'Legend of the Realm', min: 550 },
];

export interface RankInfo {
  current: Rank;
  next: Rank | null;
  progress: number; // 0..1 from current.min to next.min
  toNext: number;
}

export function getRank(points: number): RankInfo {
  let index = 0;
  for (let i = 0; i < RANKS.length; i++) {
    if (points >= RANKS[i].min) index = i;
  }
  const current = RANKS[index];
  const next = RANKS[index + 1] ?? null;
  if (!next) return { current, next: null, progress: 1, toNext: 0 };
  return {
    current,
    next,
    progress: (points - current.min) / (next.min - current.min),
    toNext: next.min - points,
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/domain/tasks.test.ts src/domain/ranks.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/tasks.ts src/domain/ranks.ts src/domain/tasks.test.ts src/domain/ranks.test.ts
git commit -m "feat: add task definitions and rank ladder"
```

---

### Task 3: State type, counting helpers and settlement

**Files:**
- Create: `src/domain/types.ts`, `src/domain/counts.ts`, `src/domain/settle.ts`
- Test: `src/domain/settle.test.ts`

**Interfaces:**
- Consumes: `DateKey`, `addDays`, `isSunday`, `mondayOf`, `weekDays` from `dates.ts`; `TaskId`, `TaskDef`, `TASKS` from `tasks.ts`
- Produces (`src/domain/types.ts`):
  - `type DayCompletions = Partial<Record<TaskId, number>>`
  - `interface AppState { version: 1; points: number; lastSettledDate: DateKey; completions: Record<DateKey, DayCompletions>; graceWeek: DateKey }`
- Produces (`src/domain/counts.ts`):
  - `countOn(completions: AppState['completions'], day: DateKey, id: TaskId): number`
  - `weekCountBefore(completions, day: DateKey, id: TaskId): number` (same week, strictly before `day`)
  - `weekCountThrough(completions, day: DateKey, id: TaskId): number` (same week, up to and including `day`)
  - `weeklyAwarded(completions, day: DateKey, task: TaskDef): number` (completions on `day` that earn points under the cap; 0 for daily tasks)
- Produces (`src/domain/settle.ts`):
  - `const COMPLETE_POINTS = 1`, `const FAIL_PENALTY = 2`
  - `settle(state: AppState, today: DateKey): AppState` (returns the same object if nothing to settle)

- [ ] **Step 1: Create `src/domain/types.ts`**

```ts
import type { DateKey } from './dates';
import type { TaskId } from './tasks';

export type DayCompletions = Partial<Record<TaskId, number>>;

export interface AppState {
  version: 1;
  points: number;
  lastSettledDate: DateKey;
  completions: Record<DateKey, DayCompletions>; // current week only
  graceWeek: DateKey; // Monday of the first week; no shortfall penalty that week
}
```

- [ ] **Step 2: Write the failing settlement tests**

`src/domain/settle.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { settle } from './settle';
import type { AppState, DayCompletions } from './types';
import { weekDays } from './dates';

const ALL_DAILY: DayCompletions = { reading: 1, running: 1, abstinence: 1, logic: 1, language: 1 };

function state(over: Partial<AppState> = {}): AppState {
  return { version: 1, points: 100, lastSettledDate: '2026-09-27', completions: {}, graceWeek: '2026-09-21', ...over };
}

describe('settle', () => {
  it('awards +1 per daily task on a perfect day', () => {
    const result = settle(state({ completions: { '2026-09-28': ALL_DAILY } }), '2026-09-29');
    expect(result.points).toBe(105);
    expect(result.lastSettledDate).toBe('2026-09-28');
  });

  it('charges -2 per missed daily task', () => {
    expect(settle(state(), '2026-09-29').points).toBe(90);
  });

  it('never settles today', () => {
    const s = state();
    expect(settle(s, '2026-09-28')).toBe(s);
  });

  it('is a no-op when the clock moves backwards', () => {
    const s = state({ lastSettledDate: '2026-09-30' });
    expect(settle(s, '2026-09-29')).toBe(s);
    expect(settle(s, '2026-09-30')).toBe(s);
  });

  it('caps weekly points at the target', () => {
    const s = state({
      completions: {
        '2026-09-28': { ...ALL_DAILY, chores: 3 },
        '2026-09-29': { ...ALL_DAILY, chores: 3 },
      },
    });
    // Mon: 5 + 3 = 8; Tue: 5 + 1 (only 1 left under target 4) = 6
    expect(settle(s, '2026-09-30').points).toBe(114);
  });

  it('applies -2 per missing weekly session on Sunday and clears the week', () => {
    const completions: AppState['completions'] = {};
    weekDays('2026-09-28').forEach((day, i) => {
      completions[day] = {
        ...ALL_DAILY,
        ...(i < 5 ? { coding: 1 } : {}),
        ...(i === 0 ? { sport: 1 } : {}),
        ...(i === 5 ? { chores: 4 } : {}),
      };
    });
    const result = settle(state({ completions }), '2026-10-05');
    // daily 35 + coding 5 + chores 4 + sport 1 = 45; sport shortfall 3 × 2 = 6
    expect(result.points).toBe(139);
    expect(result.lastSettledDate).toBe('2026-10-04');
    expect(result.completions).toEqual({});
  });

  it('clamps at zero after each day so a bad day does not eat into the next', () => {
    const s = state({ points: 0, completions: { '2026-09-29': ALL_DAILY } });
    // Mon: 0 - 10 -> 0; Tue: +5
    expect(settle(s, '2026-09-30').points).toBe(5);
  });

  it('nets a day before clamping', () => {
    const s = state({ points: 1, completions: { '2026-09-28': { reading: 1, chores: 3 } } });
    // +1 reading +3 chores -8 missed daily = -4 -> 1 - 4 -> 0
    expect(settle(s, '2026-09-29').points).toBe(0);
  });

  it('clamps the Sunday penalty at zero', () => {
    const s = state({ points: 5, lastSettledDate: '2026-10-03', completions: { '2026-10-04': ALL_DAILY } });
    // Sun: 5 + 5 = 10; weekly penalty (5 + 4 + 4) × 2 = 26 -> 0
    expect(settle(s, '2026-10-05').points).toBe(0);
  });

  it('settles a multi-week absence day by day', () => {
    const result = settle(state({ points: 1000 }), '2026-10-12');
    // 14 days × -10 = -140; two Sundays × -26 = -52
    expect(result.points).toBe(808);
    expect(result.lastSettledDate).toBe('2026-10-11');
  });

  it('skips the shortfall penalty in the grace week but still clears it', () => {
    const s = state({ graceWeek: '2026-09-28', lastSettledDate: '2026-10-03', completions: { '2026-10-04': ALL_DAILY } });
    const result = settle(s, '2026-10-05');
    expect(result.points).toBe(105);
    expect(result.completions).toEqual({});
  });

  it('applies the shortfall penalty in the week after the grace week', () => {
    const s = state({ graceWeek: '2026-09-28', points: 100, lastSettledDate: '2026-10-10', completions: { '2026-10-11': ALL_DAILY } });
    // Sun 2026-10-11: +5, then -26
    expect(settle(s, '2026-10-12').points).toBe(79);
  });

  it('keeps completions from the new week when settling Sunday', () => {
    const s = state({ lastSettledDate: '2026-10-03', completions: { '2026-10-05': { reading: 1 } } });
    expect(settle(s, '2026-10-05').completions).toEqual({ '2026-10-05': { reading: 1 } });
  });

  it('is idempotent', () => {
    const s = state({ completions: { '2026-09-28': { ...ALL_DAILY, chores: 6 } } });
    const once = settle(s, '2026-10-01');
    expect(settle(once, '2026-10-01')).toEqual(once);
  });

  it('does not mutate its input', () => {
    const s = state({ lastSettledDate: '2026-10-03', completions: { '2026-10-04': ALL_DAILY } });
    const copy = structuredClone(s);
    settle(s, '2026-10-05');
    expect(s).toEqual(copy);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/domain/settle.test.ts`
Expected: FAIL — cannot resolve `./settle`.

- [ ] **Step 4: Implement `src/domain/counts.ts`**

```ts
import { weekDays, type DateKey } from './dates';
import type { TaskDef, TaskId } from './tasks';
import type { AppState } from './types';

type Completions = AppState['completions'];

export function countOn(completions: Completions, day: DateKey, id: TaskId): number {
  return completions[day]?.[id] ?? 0;
}

export function weekCountBefore(completions: Completions, day: DateKey, id: TaskId): number {
  return weekDays(day)
    .filter((d) => d < day)
    .reduce((sum, d) => sum + countOn(completions, d, id), 0);
}

export function weekCountThrough(completions: Completions, day: DateKey, id: TaskId): number {
  return weekCountBefore(completions, day, id) + countOn(completions, day, id);
}

export function weeklyAwarded(completions: Completions, day: DateKey, task: TaskDef): number {
  if (task.cadence.kind !== 'weekly') return 0;
  const room = task.cadence.target - weekCountBefore(completions, day, task.id);
  return Math.max(0, Math.min(countOn(completions, day, task.id), room));
}
```

- [ ] **Step 5: Implement `src/domain/settle.ts`**

```ts
import { countOn, weekCountThrough, weeklyAwarded } from './counts';
import { addDays, isSunday, mondayOf, weekDays, type DateKey } from './dates';
import { TASKS } from './tasks';
import type { AppState } from './types';

export const COMPLETE_POINTS = 1;
export const FAIL_PENALTY = 2;

type Completions = AppState['completions'];

function scoreDay(completions: Completions, day: DateKey): number {
  let net = 0;
  for (const task of TASKS) {
    if (task.cadence.kind === 'daily') {
      net += countOn(completions, day, task.id) > 0 ? COMPLETE_POINTS : -FAIL_PENALTY;
    } else {
      net += weeklyAwarded(completions, day, task) * COMPLETE_POINTS;
    }
  }
  return net;
}

function weeklyPenalty(completions: Completions, sunday: DateKey): number {
  let penalty = 0;
  for (const task of TASKS) {
    if (task.cadence.kind !== 'weekly') continue;
    const done = weekCountThrough(completions, sunday, task.id);
    penalty += FAIL_PENALTY * Math.max(0, task.cadence.target - done);
  }
  return penalty;
}

export function settle(state: AppState, today: DateKey): AppState {
  let { points, lastSettledDate } = state;
  const completions = { ...state.completions };

  for (let day = addDays(lastSettledDate, 1); day < today; day = addDays(day, 1)) {
    points = Math.max(0, points + scoreDay(completions, day));
    if (isSunday(day)) {
      if (mondayOf(day) !== state.graceWeek) {
        points = Math.max(0, points - weeklyPenalty(completions, day));
      }
      for (const d of weekDays(day)) delete completions[d];
    }
    lastSettledDate = day;
  }

  if (lastSettledDate === state.lastSettledDate) return state;
  return { ...state, points, lastSettledDate, completions };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/domain/settle.test.ts`
Expected: PASS (15 tests).

- [ ] **Step 7: Commit**

```bash
git add src/domain/types.ts src/domain/counts.ts src/domain/settle.ts src/domain/settle.test.ts
git commit -m "feat: add day and week settlement engine"
```

---

### Task 4: Actions and selectors

**Files:**
- Create: `src/domain/actions.ts`, `src/domain/selectors.ts`
- Test: `src/domain/actions.test.ts`, `src/domain/selectors.test.ts`

**Interfaces:**
- Consumes: `AppState` (`types.ts`); `TaskId`, `TaskDef`, `TASKS`, `getTask` (`tasks.ts`); `countOn`, `weekCountThrough`, `weeklyAwarded` (`counts.ts`); `daysLeftAfter`, `DateKey` (`dates.ts`); `COMPLETE_POINTS` (`settle.ts`)
- Produces (`src/domain/actions.ts`):
  - `complete(state: AppState, id: TaskId, today: DateKey): AppState`
  - `undo(state: AppState, id: TaskId, today: DateKey): AppState`
- Produces (`src/domain/selectors.ts`):
  - `todayCount(state: AppState, id: TaskId, today: DateKey): number`
  - `weekCount(state: AppState, id: TaskId, today: DateKey): number`
  - `remainingThisWeek(state: AppState, task: TaskDef, today: DateKey): number | null` (`null` for daily tasks)
  - `isAtRisk(state: AppState, task: TaskDef, today: DateKey): boolean`
  - `pendingToday(state: AppState, today: DateKey): number`

- [ ] **Step 1: Write the failing tests**

`src/domain/actions.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { complete, undo } from './actions';
import type { AppState } from './types';

const TODAY = '2026-09-30';

function state(completions: AppState['completions'] = {}): AppState {
  return { version: 1, points: 10, lastSettledDate: '2026-09-29', completions, graceWeek: '2026-09-21' };
}

describe('complete', () => {
  it('marks a once-per-day task done', () => {
    expect(complete(state(), 'reading', TODAY).completions[TODAY]).toEqual({ reading: 1 });
  });

  it('ignores a second completion of a once-per-day task', () => {
    const s = state({ [TODAY]: { sport: 1 } });
    expect(complete(s, 'sport', TODAY)).toBe(s);
  });

  it('lets chores accumulate', () => {
    let s = state();
    for (let i = 0; i < 3; i++) s = complete(s, 'chores', TODAY);
    expect(s.completions[TODAY]).toEqual({ chores: 3 });
  });

  it('keeps other tasks and days intact and does not mutate', () => {
    const s = state({ '2026-09-29': { reading: 1 }, [TODAY]: { coding: 1 } });
    const copy = structuredClone(s);
    const next = complete(s, 'reading', TODAY);
    expect(next.completions).toEqual({ '2026-09-29': { reading: 1 }, [TODAY]: { coding: 1, reading: 1 } });
    expect(s).toEqual(copy);
  });
});

describe('undo', () => {
  it('decrements today', () => {
    const s = state({ [TODAY]: { chores: 2 } });
    expect(undo(s, 'chores', TODAY).completions[TODAY]).toEqual({ chores: 1 });
  });

  it('is a no-op at zero', () => {
    const s = state();
    expect(undo(s, 'reading', TODAY)).toBe(s);
  });
});
```

`src/domain/selectors.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { isAtRisk, pendingToday, remainingThisWeek, todayCount, weekCount } from './selectors';
import { getTask } from './tasks';
import type { AppState } from './types';

const SAT = '2026-10-03';

function state(completions: AppState['completions'] = {}): AppState {
  return { version: 1, points: 0, lastSettledDate: '2026-10-02', completions, graceWeek: '2026-09-21' };
}

describe('counts', () => {
  it('reads today and the week so far', () => {
    const s = state({ '2026-09-28': { sport: 1 }, '2026-10-01': { sport: 1 }, [SAT]: { sport: 1 } });
    expect(todayCount(s, 'sport', SAT)).toBe(1);
    expect(weekCount(s, 'sport', SAT)).toBe(3);
  });
});

describe('remainingThisWeek', () => {
  it('is null for daily tasks', () => {
    expect(remainingThisWeek(state(), getTask('reading'), SAT)).toBeNull();
  });

  it('counts sessions left and floors at zero', () => {
    expect(remainingThisWeek(state({ '2026-09-28': { sport: 1 } }), getTask('sport'), SAT)).toBe(3);
    expect(remainingThisWeek(state({ '2026-09-28': { chores: 6 } }), getTask('chores'), SAT)).toBe(0);
  });
});

describe('isAtRisk', () => {
  const sport = getTask('sport');

  it('flags Saturday with 3 left and not done today', () => {
    expect(isAtRisk(state({ '2026-09-28': { sport: 1 } }), sport, SAT)).toBe(true);
  });

  it('does not flag Saturday with 2 left and not done today', () => {
    expect(isAtRisk(state({ '2026-09-28': { sport: 2 } }), sport, SAT)).toBe(false);
  });

  it('flags Saturday with 2 left when already done today', () => {
    const s = state({ '2026-09-28': { sport: 1 }, [SAT]: { sport: 1 } });
    expect(isAtRisk(s, sport, SAT)).toBe(true);
  });

  it('never flags daily tasks or chores', () => {
    expect(isAtRisk(state(), getTask('reading'), SAT)).toBe(false);
    expect(isAtRisk(state(), getTask('chores'), '2026-10-04')).toBe(false);
  });
});

describe('pendingToday', () => {
  it('counts daily completions', () => {
    expect(pendingToday(state({ [SAT]: { reading: 1, running: 1 } }), SAT)).toBe(2);
  });

  it('caps weekly completions at the remaining target', () => {
    expect(pendingToday(state({ [SAT]: { chores: 6 } }), SAT)).toBe(4);
    expect(pendingToday(state({ '2026-09-29': { chores: 3 }, [SAT]: { chores: 3 } }), SAT)).toBe(1);
  });

  it('is zero with nothing done', () => {
    expect(pendingToday(state(), SAT)).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/domain/actions.test.ts src/domain/selectors.test.ts`
Expected: FAIL — cannot resolve `./actions` / `./selectors`.

- [ ] **Step 3: Implement `src/domain/actions.ts`**

```ts
import { countOn } from './counts';
import type { DateKey } from './dates';
import { getTask, type TaskId } from './tasks';
import type { AppState } from './types';

function withCount(state: AppState, id: TaskId, today: DateKey, count: number): AppState {
  return {
    ...state,
    completions: {
      ...state.completions,
      [today]: { ...state.completions[today], [id]: count },
    },
  };
}

export function complete(state: AppState, id: TaskId, today: DateKey): AppState {
  const { maxPerDay } = getTask(id);
  const count = countOn(state.completions, today, id);
  if (maxPerDay !== null && count >= maxPerDay) return state;
  return withCount(state, id, today, count + 1);
}

export function undo(state: AppState, id: TaskId, today: DateKey): AppState {
  const count = countOn(state.completions, today, id);
  if (count === 0) return state;
  return withCount(state, id, today, count - 1);
}
```

- [ ] **Step 4: Implement `src/domain/selectors.ts`**

```ts
import { countOn, weekCountThrough, weeklyAwarded } from './counts';
import { daysLeftAfter, type DateKey } from './dates';
import { COMPLETE_POINTS } from './settle';
import { TASKS, type TaskDef, type TaskId } from './tasks';
import type { AppState } from './types';

export function todayCount(state: AppState, id: TaskId, today: DateKey): number {
  return countOn(state.completions, today, id);
}

export function weekCount(state: AppState, id: TaskId, today: DateKey): number {
  return weekCountThrough(state.completions, today, id);
}

export function remainingThisWeek(state: AppState, task: TaskDef, today: DateKey): number | null {
  if (task.cadence.kind !== 'weekly') return null;
  return Math.max(0, task.cadence.target - weekCount(state, task.id, today));
}

export function isAtRisk(state: AppState, task: TaskDef, today: DateKey): boolean {
  if (task.maxPerDay !== 1) return false;
  const remaining = remainingThisWeek(state, task, today);
  if (remaining === null) return false;
  const availableDays = daysLeftAfter(today) + (todayCount(state, task.id, today) === 0 ? 1 : 0);
  return remaining > availableDays;
}

export function pendingToday(state: AppState, today: DateKey): number {
  let points = 0;
  for (const task of TASKS) {
    if (task.cadence.kind === 'daily') {
      if (todayCount(state, task.id, today) > 0) points += COMPLETE_POINTS;
    } else {
      points += weeklyAwarded(state.completions, today, task) * COMPLETE_POINTS;
    }
  }
  return points;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/domain`
Expected: PASS (all domain tests).

- [ ] **Step 6: Commit**

```bash
git add src/domain/actions.ts src/domain/selectors.ts src/domain/actions.test.ts src/domain/selectors.test.ts
git commit -m "feat: add complete/undo actions and display selectors"
```

---

### Task 5: Persistence

**Files:**
- Create: `src/storage/persist.ts`
- Test: `src/storage/persist.test.ts`

**Interfaces:**
- Consumes: `AppState` (`domain/types.ts`); `TASKS` (`domain/tasks.ts`); `addDays`, `mondayOf`, `DateKey` (`domain/dates.ts`)
- Produces (`src/storage/persist.ts`):
  - `const STORAGE_KEY = 'strive:v1'`
  - `freshState(today: DateKey): AppState`
  - `isValidState(value: unknown): value is AppState`
  - `load(today: DateKey, storage?: Storage): AppState` (default `localStorage`)
  - `save(state: AppState, storage?: Storage): void` (default `localStorage`)

- [ ] **Step 1: Write the failing tests**

`src/storage/persist.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { STORAGE_KEY, freshState, load, save } from './persist';
import type { AppState } from '../domain/types';

const TODAY = '2026-09-30';

const valid: AppState = {
  version: 1,
  points: 42,
  lastSettledDate: '2026-09-29',
  completions: { '2026-09-30': { reading: 1, chores: 3 } },
  graceWeek: '2026-09-28',
};

describe('persist', () => {
  let warn: MockInstance<typeof console.warn>;

  beforeEach(() => {
    localStorage.clear();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => warn.mockRestore());

  it('creates a fresh state whose first scored day is today', () => {
    expect(freshState(TODAY)).toEqual({
      version: 1, points: 0, lastSettledDate: '2026-09-29', completions: {}, graceWeek: '2026-09-28',
    });
  });

  it('returns a fresh state when nothing is stored', () => {
    expect(load(TODAY)).toEqual(freshState(TODAY));
    expect(warn).not.toHaveBeenCalled();
  });

  it('round-trips a saved state', () => {
    save(valid);
    expect(load(TODAY)).toEqual(valid);
  });

  it.each([
    ['invalid JSON', '{not json'],
    ['wrong version', JSON.stringify({ ...valid, version: 2 })],
    ['negative points', JSON.stringify({ ...valid, points: -3 })],
    ['string points', JSON.stringify({ ...valid, points: '42' })],
    ['bad date key', JSON.stringify({ ...valid, lastSettledDate: 'yesterday' })],
    ['missing graceWeek', JSON.stringify({ ...valid, graceWeek: undefined })],
    ['unknown task id', JSON.stringify({ ...valid, completions: { '2026-09-30': { napping: 1 } } })],
    ['fractional count', JSON.stringify({ ...valid, completions: { '2026-09-30': { reading: 0.5 } } })],
    ['array completions', JSON.stringify({ ...valid, completions: [] })],
  ])('falls back to a fresh state on %s', (_label, raw) => {
    localStorage.setItem(STORAGE_KEY, raw);
    expect(load(TODAY)).toEqual(freshState(TODAY));
    expect(warn).toHaveBeenCalled();
  });

  it('survives storage that throws on read', () => {
    const broken = { getItem: () => { throw new Error('denied'); } } as unknown as Storage;
    expect(load(TODAY, broken)).toEqual(freshState(TODAY));
  });

  it('survives storage that throws on write', () => {
    const broken = { setItem: () => { throw new Error('quota'); } } as unknown as Storage;
    expect(() => save(valid, broken)).not.toThrow();
    expect(warn).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/storage/persist.test.ts`
Expected: FAIL — cannot resolve `./persist`.

- [ ] **Step 3: Implement `src/storage/persist.ts`**

```ts
import { addDays, mondayOf, type DateKey } from '../domain/dates';
import { TASKS } from '../domain/tasks';
import type { AppState } from '../domain/types';

export const STORAGE_KEY = 'strive:v1';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TASK_IDS = new Set<string>(TASKS.map((t) => t.id));

export function freshState(today: DateKey): AppState {
  return { version: 1, points: 0, lastSettledDate: addDays(today, -1), completions: {}, graceWeek: mondayOf(today) };
}

function isCount(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && DATE_RE.test(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isValidState(value: unknown): value is AppState {
  if (!isPlainObject(value)) return false;
  if (value.version !== 1 || !isCount(value.points)) return false;
  if (!isDateKey(value.lastSettledDate) || !isDateKey(value.graceWeek)) return false;
  if (!isPlainObject(value.completions)) return false;
  return Object.entries(value.completions).every(
    ([date, day]) =>
      DATE_RE.test(date) &&
      isPlainObject(day) &&
      Object.entries(day).every(([id, n]) => TASK_IDS.has(id) && isCount(n)),
  );
}

export function load(today: DateKey, storage: Storage = localStorage): AppState {
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Strive: storage unavailable, starting fresh', error);
    return freshState(today);
  }
  if (raw === null) return freshState(today);

  try {
    const parsed: unknown = JSON.parse(raw);
    if (isValidState(parsed)) return parsed;
  } catch {
    // fall through to the warning below
  }
  console.warn('Strive: stored data is invalid, starting fresh');
  return freshState(today);
}

export function save(state: AppState, storage: Storage = localStorage): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Strive: could not save progress', error);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/storage/persist.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/storage
git commit -m "feat: add validated localStorage persistence"
```

---

### Task 6: `useAppState` hook

**Files:**
- Create: `src/state/useAppState.ts`
- Test: `src/state/useAppState.test.ts`

**Interfaces:**
- Consumes: `settle` (`domain/settle.ts`); `complete`, `undo` (`domain/actions.ts`); `load`, `save`, `STORAGE_KEY` (`storage/persist.ts`); `toKey`, `DateKey` (`domain/dates.ts`); `TaskId`; `AppState`
- Produces (`src/state/useAppState.ts`):
  - `useAppState(): { state: AppState; today: DateKey; complete: (id: TaskId) => void; undo: (id: TaskId) => void }`
  - Every dispatch settles with the *current* clock before applying the action.

- [ ] **Step 1: Write the failing tests**

`src/state/useAppState.test.ts`:
```ts
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppState } from './useAppState';
import { STORAGE_KEY } from '../storage/persist';

function seed(state: object) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

describe('useAppState', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => vi.useRealTimers());

  it('starts fresh and records completions for today', () => {
    vi.setSystemTime(new Date(2026, 8, 30, 10, 0));
    const { result } = renderHook(() => useAppState());
    expect(result.current.today).toBe('2026-09-30');
    expect(result.current.state.points).toBe(0);

    act(() => result.current.complete('reading'));
    expect(result.current.state.completions['2026-09-30']).toEqual({ reading: 1 });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).completions['2026-09-30']).toEqual({ reading: 1 });

    act(() => result.current.undo('reading'));
    expect(result.current.state.completions['2026-09-30']).toEqual({ reading: 0 });
  });

  it('settles days missed while the app was closed', () => {
    seed({ version: 1, points: 50, graceWeek: '2026-09-21', lastSettledDate: '2026-09-28', completions: { '2026-09-29': { reading: 1 } } });
    vi.setSystemTime(new Date(2026, 8, 30, 10, 0));
    const { result } = renderHook(() => useAppState());
    // Tue: +1 reading, -8 for four missed daily tasks
    expect(result.current.state.points).toBe(43);
    expect(result.current.state.lastSettledDate).toBe('2026-09-29');
  });

  it('settles at midnight while the app stays open', () => {
    seed({ version: 1, points: 50, graceWeek: '2026-09-21', lastSettledDate: '2026-09-28', completions: {} });
    vi.setSystemTime(new Date(2026, 8, 29, 23, 59, 30));
    const { result } = renderHook(() => useAppState());
    act(() => result.current.complete('reading'));

    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current.state.points).toBe(43);
    expect(result.current.state.lastSettledDate).toBe('2026-09-29');
  });

  it('counts a tap after midnight for the new day even before the timer fires', () => {
    seed({ version: 1, points: 50, graceWeek: '2026-09-21', lastSettledDate: '2026-09-28', completions: {} });
    vi.setSystemTime(new Date(2026, 8, 29, 23, 59, 50));
    const { result } = renderHook(() => useAppState());

    vi.setSystemTime(new Date(2026, 8, 30, 0, 0, 10));
    act(() => result.current.complete('reading'));
    expect(result.current.state.lastSettledDate).toBe('2026-09-29');
    expect(result.current.state.points).toBe(40);
    expect(result.current.state.completions['2026-09-30']).toEqual({ reading: 1 });
  });

  it('settles when the window regains focus', () => {
    seed({ version: 1, points: 50, graceWeek: '2026-09-21', lastSettledDate: '2026-09-28', completions: {} });
    vi.setSystemTime(new Date(2026, 8, 29, 23, 59, 50));
    const { result } = renderHook(() => useAppState());

    vi.setSystemTime(new Date(2026, 8, 30, 8, 0));
    act(() => { window.dispatchEvent(new Event('focus')); });
    expect(result.current.state.lastSettledDate).toBe('2026-09-29');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/state/useAppState.test.ts`
Expected: FAIL — cannot resolve `./useAppState`.

- [ ] **Step 3: Implement `src/state/useAppState.ts`**

```ts
import { useCallback, useEffect, useReducer } from 'react';
import { complete, undo } from '../domain/actions';
import { toKey, type DateKey } from '../domain/dates';
import { settle } from '../domain/settle';
import type { TaskId } from '../domain/tasks';
import type { AppState } from '../domain/types';
import { load, save } from '../storage/persist';

type Action =
  | { type: 'settle'; today: DateKey }
  | { type: 'complete' | 'undo'; id: TaskId; today: DateKey };

function reducer(state: AppState, action: Action): AppState {
  const settled = settle(state, action.today);
  switch (action.type) {
    case 'settle':
      return settled;
    case 'complete':
      return complete(settled, action.id, action.today);
    case 'undo':
      return undo(settled, action.id, action.today);
  }
}

const currentKey = () => toKey(new Date());

function init(): AppState {
  const today = currentKey();
  return settle(load(today), today);
}

export function useAppState() {
  const [state, dispatch] = useReducer(reducer, undefined, init);

  useEffect(() => {
    save(state);
  }, [state]);

  useEffect(() => {
    const tick = () => dispatch({ type: 'settle', today: currentKey() });
    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick();
    };
    const interval = setInterval(tick, 60_000);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const completeTask = useCallback((id: TaskId) => dispatch({ type: 'complete', id, today: currentKey() }), []);
  const undoTask = useCallback((id: TaskId) => dispatch({ type: 'undo', id, today: currentKey() }), []);

  return { state, today: currentKey(), complete: completeTask, undo: undoTask };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/state/useAppState.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/state
git commit -m "feat: add useAppState hook with live settlement"
```

---

### Task 7: Retro theme, sprites and header

**Files:**
- Create: `src/ui/format.ts`, `src/ui/sprites.ts`, `src/ui/PixelSprite.tsx`, `src/ui/Header.tsx`
- Modify: `src/index.css` (replace placeholder entirely)
- Test: `src/ui/format.test.ts`, `src/ui/sprites.test.ts`, `src/ui/Header.test.tsx`

**Interfaces:**
- Consumes: `getRank` (`domain/ranks.ts`); `fromKey`, `DateKey` (`domain/dates.ts`); `TASKS`, `TaskId` (`domain/tasks.ts`)
- Produces:
  - `src/ui/format.ts`: `barCells(progress: number, cells?: number): { filled: number; empty: number }`, `formatWeekOf(key: DateKey): string` (e.g. `'SEP 28'`), `cadenceLabel(remaining: number | null): string`
  - `src/ui/sprites.ts`: `const SPRITES: Record<TaskId, string[]>`
  - `src/ui/PixelSprite.tsx`: `PixelSprite({ map, title, size? }: { map: string[]; title: string; size?: number })`
  - `src/ui/Header.tsx`: `Header({ points, pending, weekStart }: { points: number; pending: number; weekStart: DateKey })`

- [ ] **Step 1: Write the failing tests**

`src/ui/format.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { barCells, cadenceLabel, formatWeekOf } from './format';

describe('barCells', () => {
  it('fills proportionally, rounding down', () => {
    expect(barCells(0)).toEqual({ filled: 0, empty: 20 });
    expect(barCells(5 / 30)).toEqual({ filled: 3, empty: 17 });
    expect(barCells(0.99)).toEqual({ filled: 19, empty: 1 });
    expect(barCells(1)).toEqual({ filled: 20, empty: 0 });
  });

  it('clamps out-of-range progress', () => {
    expect(barCells(-1)).toEqual({ filled: 0, empty: 20 });
    expect(barCells(2)).toEqual({ filled: 20, empty: 0 });
  });
});

describe('formatWeekOf', () => {
  it('formats as MON D', () => {
    expect(formatWeekOf('2026-09-28')).toBe('SEP 28');
    expect(formatWeekOf('2026-10-05')).toBe('OCT 5');
  });
});

describe('cadenceLabel', () => {
  it('labels daily and weekly tasks', () => {
    expect(cadenceLabel(null)).toBe('DAILY');
    expect(cadenceLabel(3)).toBe('3 LEFT THIS WEEK');
    expect(cadenceLabel(0)).toBe('TARGET MET');
  });
});
```

`src/ui/sprites.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { SPRITES } from './sprites';
import { TASKS } from '../domain/tasks';

describe('SPRITES', () => {
  it.each(TASKS.map((t) => t.id))('%s is a 10×10 map of # and .', (id) => {
    const map = SPRITES[id];
    expect(map).toHaveLength(10);
    for (const row of map) expect(row).toMatch(/^[#.]{10}$/);
  });
});
```

`src/ui/Header.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Header } from './Header';

describe('Header', () => {
  it('shows rank, points, progress and pending', () => {
    render(<Header points={80} pending={4} weekStart="2026-09-28" />);
    expect(screen.getByRole('heading', { name: 'KNIGHT' })).toBeInTheDocument();
    expect(screen.getByText('80 PTS')).toBeInTheDocument();
    expect(screen.getByText('25 TO RANGER')).toBeInTheDocument();
    expect(screen.getByText('▓▓▓')).toBeInTheDocument();
    expect(screen.getByText(/TODAY: \+4 PENDING · WEEK OF SEP 28/)).toBeInTheDocument();
  });

  it('shows MAX RANK at the top', () => {
    render(<Header points={600} pending={0} weekStart="2026-09-28" />);
    expect(screen.getByRole('heading', { name: 'LEGEND OF THE REALM' })).toBeInTheDocument();
    expect(screen.getByText('MAX RANK')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/ui`
Expected: FAIL — cannot resolve `./format`, `./sprites`, `./Header`.

- [ ] **Step 3: Implement `src/ui/format.ts`**

```ts
import { fromKey, type DateKey } from '../domain/dates';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function barCells(progress: number, cells = 20): { filled: number; empty: number } {
  const filled = Math.min(cells, Math.max(0, Math.floor(progress * cells)));
  return { filled, empty: cells - filled };
}

export function formatWeekOf(key: DateKey): string {
  const date = fromKey(key);
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

export function cadenceLabel(remaining: number | null): string {
  if (remaining === null) return 'DAILY';
  return remaining === 0 ? 'TARGET MET' : `${remaining} LEFT THIS WEEK`;
}
```

- [ ] **Step 4: Implement `src/ui/sprites.ts`**

```ts
import type { TaskId } from '../domain/tasks';

export const SPRITES: Record<TaskId, string[]> = {
  reading: [
    '..........',
    '.###..###.',
    '#...##...#',
    '#.#.##.#.#',
    '#...##...#',
    '#.#.##.#.#',
    '#...##...#',
    '####..####',
    '...####...',
    '..........',
  ],
  coding: [
    '..........',
    '.########.',
    '.#......#.',
    '.#.##...#.',
    '.#......#.',
    '.#.###..#.',
    '.########.',
    '##########',
    '.########.',
    '..........',
  ],
  running: [
    '..........',
    '..........',
    '.....##...',
    '.....###..',
    '....#####.',
    '...######.',
    '.#########',
    '##########',
    '#.#.#.#.#.',
    '..........',
  ],
  sport: [
    '..........',
    '.#......#.',
    '##......##',
    '##......##',
    '##########',
    '##########',
    '##......##',
    '##......##',
    '.#......#.',
    '..........',
  ],
  abstinence: [
    '..........',
    '##########',
    '#...##...#',
    '#...##...#',
    '##########',
    '#...##...#',
    '.#..##..#.',
    '..#.##.#..',
    '...####...',
    '....##....',
  ],
  logic: [
    '..........',
    '...##.....',
    '..####....',
    '.######...',
    '.##.####..',
    '....####..',
    '...#####..',
    '..######..',
    '.########.',
    '.########.',
  ],
  chores: [
    '........##',
    '.......##.',
    '......##..',
    '.....##...',
    '....##....',
    '..####....',
    '.######...',
    '########..',
    '#.#.#.#...',
    '..........',
  ],
  language: [
    '..........',
    '##########',
    '#........#',
    '#.##.###.#',
    '#........#',
    '#.###.##.#',
    '#........#',
    '##########',
    '..##......',
    '.#........',
  ],
};
```

- [ ] **Step 5: Implement `src/ui/PixelSprite.tsx`**

```tsx
interface PixelSpriteProps {
  map: string[];
  title: string;
  size?: number;
}

export function PixelSprite({ map, title, size = 80 }: PixelSpriteProps) {
  const rows = map.length;
  const cols = map[0]?.length ?? 0;
  return (
    <svg
      className="sprite"
      width={size}
      height={(size * rows) / cols}
      viewBox={`0 0 ${cols} ${rows}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={title}
    >
      {map.flatMap((row, y) =>
        [...row].map((cell, x) =>
          cell === '#' ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} /> : null,
        ),
      )}
    </svg>
  );
}
```

- [ ] **Step 6: Implement `src/ui/Header.tsx`**

```tsx
import type { DateKey } from '../domain/dates';
import { getRank } from '../domain/ranks';
import { barCells, formatWeekOf } from './format';

interface HeaderProps {
  points: number;
  pending: number;
  weekStart: DateKey;
}

export function Header({ points, pending, weekStart }: HeaderProps) {
  const { current, next, progress, toNext } = getRank(points);
  const { filled, empty } = barCells(progress);

  return (
    <header className="header">
      <div className="header-top">
        <h1 className="rank">
          {current.title.toUpperCase()}
          <span className="cursor" aria-hidden="true">▮</span>
        </h1>
        <div className="points">{points} PTS</div>
      </div>
      <div className="bar">
        <span className="bar-cells" aria-hidden="true">
          <span className="bar-fill">{'▓'.repeat(filled)}</span>
          <span className="bar-empty">{'░'.repeat(empty)}</span>
        </span>
        <span>{next ? `${toNext} TO ${next.title.toUpperCase()}` : 'MAX RANK'}</span>
      </div>
      <div className="meta">
        TODAY: +{pending} PENDING · WEEK OF {formatWeekOf(weekStart)}
      </div>
    </header>
  );
}
```

- [ ] **Step 7: Replace `src/index.css`**

```css
:root {
  --bg: #000;
  --fg: #b48cff;
  --dim: #5a3f8c;
  --border: 2px solid var(--fg);
  color-scheme: dark;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body {
  background: var(--bg);
  color: var(--fg);
}

body {
  font-family: 'VT323', ui-monospace, monospace;
  font-size: 22px;
  line-height: 1.2;
  -webkit-font-smoothing: none;
}

.app {
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px 16px 48px;
}

.header {
  border: var(--border);
  padding: 16px 20px;
  margin-bottom: 24px;
  display: grid;
  gap: 6px;
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 16px;
}

.rank {
  font-size: 48px;
  font-weight: normal;
  letter-spacing: 2px;
}

.cursor,
.risk {
  animation: blink 1s steps(1) infinite;
}

.cursor {
  margin-left: 4px;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

.points {
  font-size: 32px;
}

.bar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
}

.bar-cells {
  white-space: nowrap;
}

.bar-empty,
.meta,
.sub {
  color: var(--dim);
}

.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

@media (min-width: 600px) {
  .grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1000px) {
  .grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.card {
  border: var(--border);
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
}

.card h2 {
  font-size: 28px;
  font-weight: normal;
}

.sprite {
  fill: var(--fg);
}

.sub {
  min-height: 1.2em;
}

.risk {
  color: var(--fg);
}

.btn {
  font: inherit;
  background: var(--bg);
  color: var(--fg);
  border: var(--border);
  padding: 6px 12px;
  cursor: pointer;
}

.btn:hover:not(:disabled) {
  box-shadow: 4px 4px 0 var(--dim);
}

.btn:focus-visible {
  outline: 2px dashed var(--fg);
  outline-offset: 3px;
}

.btn-done {
  background: var(--fg);
  color: var(--bg);
}

.btn:disabled {
  color: var(--dim);
  border-color: var(--dim);
  cursor: default;
}

.card > .btn,
.counter {
  margin-top: auto;
}

.counter {
  display: flex;
  align-items: center;
  gap: 12px;
}

.count {
  font-size: 32px;
  min-width: 2ch;
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run src/ui`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/ui src/index.css
git commit -m "feat: add retro theme, pixel sprites and rank header"
```

---

### Task 8: Task cards, grid and App wiring

**Files:**
- Create: `src/ui/TaskCard.tsx`, `src/ui/CounterCard.tsx`, `src/ui/TaskGrid.tsx`
- Modify: `src/App.tsx` (replace placeholder entirely)
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: `useAppState` (`state/useAppState.ts`); `pendingToday`, `todayCount`, `remainingThisWeek`, `isAtRisk` (`domain/selectors.ts`); `TASKS`, `TaskDef`, `TaskId`; `mondayOf`, `DateKey`; `AppState`; `Header`, `PixelSprite`, `SPRITES`, `cadenceLabel`
- Produces:
  - `src/ui/TaskCard.tsx`: `interface CardProps { task: TaskDef; todayCount: number; remaining: number | null; atRisk: boolean; onComplete: () => void; onUndo: () => void }`, `TaskCard(props: CardProps)`
  - `src/ui/CounterCard.tsx`: `CounterCard(props: CardProps)`
  - `src/ui/TaskGrid.tsx`: `TaskGrid({ state, today, onComplete, onUndo }: { state: AppState; today: DateKey; onComplete: (id: TaskId) => void; onUndo: (id: TaskId) => void })`
  - `src/App.tsx`: default export `App`

- [ ] **Step 1: Write the failing UI smoke tests**

`src/App.test.tsx`:
```tsx
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 30, 10, 0)); // Wednesday
  });

  afterEach(() => vi.useRealTimers());

  it('renders the starting rank and all eight tasks', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'BEGGAR' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(8);
    expect(screen.getByText(/WEEK OF SEP 28/)).toBeInTheDocument();
  });

  it('marks a daily task done and undoes it', () => {
    render(<App />);
    const card = screen.getByRole('article', { name: 'Reading' });
    fireEvent.click(within(card).getByRole('button', { name: '[ MARK DONE ]' }));
    expect(within(card).getByRole('button', { name: '[ DONE ✓ ]' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/TODAY: \+1 PENDING/)).toBeInTheDocument();

    fireEvent.click(within(card).getByRole('button', { name: '[ DONE ✓ ]' }));
    expect(within(card).getByRole('button', { name: '[ MARK DONE ]' })).toBeInTheDocument();
    expect(screen.getByText(/TODAY: \+0 PENDING/)).toBeInTheDocument();
  });

  it('shows weekly remaining counts', () => {
    render(<App />);
    const coding = screen.getByRole('article', { name: 'Coding' });
    expect(within(coding).getByText('5 LEFT THIS WEEK')).toBeInTheDocument();
    fireEvent.click(within(coding).getByRole('button', { name: '[ MARK DONE ]' }));
    expect(within(coding).getByText('4 LEFT THIS WEEK')).toBeInTheDocument();
  });

  it('counts chores up and down', () => {
    render(<App />);
    const chores = screen.getByRole('article', { name: 'House Chores' });
    const minus = within(chores).getByRole('button', { name: 'Remove one House Chores' });
    const plus = within(chores).getByRole('button', { name: 'Add one House Chores' });
    expect(minus).toBeDisabled();

    fireEvent.click(plus);
    fireEvent.click(plus);
    expect(within(chores).getByText('2')).toBeInTheDocument();
    expect(within(chores).getByText('2 LEFT THIS WEEK')).toBeInTheDocument();
    expect(screen.getByText(/TODAY: \+2 PENDING/)).toBeInTheDocument();

    fireEvent.click(minus);
    expect(within(chores).getByText('1')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL — `BEGGAR` heading not found (placeholder App).

- [ ] **Step 3: Implement `src/ui/TaskCard.tsx`**

```tsx
import type { TaskDef } from '../domain/tasks';
import { cadenceLabel } from './format';
import { PixelSprite } from './PixelSprite';
import { SPRITES } from './sprites';

export interface CardProps {
  task: TaskDef;
  todayCount: number;
  remaining: number | null;
  atRisk: boolean;
  onComplete: () => void;
  onUndo: () => void;
}

export function TaskCard({ task, todayCount, remaining, atRisk, onComplete, onUndo }: CardProps) {
  const done = todayCount > 0;
  return (
    <article className="card" aria-label={task.name}>
      <PixelSprite map={SPRITES[task.id]} title={task.name} />
      <h2>{task.name.toUpperCase()}</h2>
      <p className="sub">
        {cadenceLabel(remaining)}
        {atRisk && <span className="risk"> · AT RISK</span>}
      </p>
      <button
        type="button"
        className={done ? 'btn btn-done' : 'btn'}
        aria-pressed={done}
        onClick={done ? onUndo : onComplete}
      >
        {done ? '[ DONE ✓ ]' : '[ MARK DONE ]'}
      </button>
    </article>
  );
}
```

- [ ] **Step 4: Implement `src/ui/CounterCard.tsx`**

```tsx
import { cadenceLabel } from './format';
import { PixelSprite } from './PixelSprite';
import { SPRITES } from './sprites';
import type { CardProps } from './TaskCard';

export function CounterCard({ task, todayCount, remaining, onComplete, onUndo }: CardProps) {
  return (
    <article className="card" aria-label={task.name}>
      <PixelSprite map={SPRITES[task.id]} title={task.name} />
      <h2>{task.name.toUpperCase()}</h2>
      <p className="sub">{cadenceLabel(remaining)}</p>
      <div className="counter">
        <button
          type="button"
          className="btn"
          aria-label={`Remove one ${task.name}`}
          disabled={todayCount === 0}
          onClick={onUndo}
        >
          [-]
        </button>
        <span className="count">{todayCount}</span>
        <button type="button" className="btn" aria-label={`Add one ${task.name}`} onClick={onComplete}>
          [+]
        </button>
      </div>
    </article>
  );
}
```

- [ ] **Step 5: Implement `src/ui/TaskGrid.tsx`**

```tsx
import type { DateKey } from '../domain/dates';
import { isAtRisk, remainingThisWeek, todayCount } from '../domain/selectors';
import { TASKS, type TaskId } from '../domain/tasks';
import type { AppState } from '../domain/types';
import { CounterCard } from './CounterCard';
import { TaskCard, type CardProps } from './TaskCard';

interface TaskGridProps {
  state: AppState;
  today: DateKey;
  onComplete: (id: TaskId) => void;
  onUndo: (id: TaskId) => void;
}

export function TaskGrid({ state, today, onComplete, onUndo }: TaskGridProps) {
  return (
    <section className="grid">
      {TASKS.map((task) => {
        const props: CardProps = {
          task,
          todayCount: todayCount(state, task.id, today),
          remaining: remainingThisWeek(state, task, today),
          atRisk: isAtRisk(state, task, today),
          onComplete: () => onComplete(task.id),
          onUndo: () => onUndo(task.id),
        };
        return task.maxPerDay === null ? (
          <CounterCard key={task.id} {...props} />
        ) : (
          <TaskCard key={task.id} {...props} />
        );
      })}
    </section>
  );
}
```

- [ ] **Step 6: Replace `src/App.tsx`**

```tsx
import { mondayOf } from './domain/dates';
import { pendingToday } from './domain/selectors';
import { useAppState } from './state/useAppState';
import { Header } from './ui/Header';
import { TaskGrid } from './ui/TaskGrid';

export default function App() {
  const { state, today, complete, undo } = useAppState();
  return (
    <main className="app">
      <Header points={state.points} pending={pendingToday(state, today)} weekStart={mondayOf(today)} />
      <TaskGrid state={state} today={today} onComplete={complete} onUndo={undo} />
    </main>
  );
}
```

- [ ] **Step 7: Run the full suite and build**

Run: `npm test && npm run build`
Expected: all tests PASS; `tsc` reports no errors; Vite build succeeds.

- [ ] **Step 8: Manual check in the browser**

Run: `npm run dev` and open the printed URL.
Verify:
- Black background, purple VT323 text, `BEGGAR▮` with blinking cursor, `0 PTS`, 20-cell `░` bar with `5 TO PEASANT`.
- Eight cards with crisp 10×10 pixel sprites; grid is 4 columns on desktop, 2 at ~800px, 1 at ~400px with no horizontal scroll.
- `[ MARK DONE ]` inverts to `[ DONE ✓ ]` and updates `TODAY: +N PENDING`; refreshing the page keeps the state.
- Chores `[-] N [+]` works; `[-]` disabled at 0.

- [ ] **Step 9: Commit**

```bash
git add src
git commit -m "feat: add task cards, grid and wire up the app"
```
