# Custom Tasks (Part 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the hard-coded task list into player-owned data that can be added, cosmetically edited and removed (with end-of-week retirement) inline on the dashboard. Each task gets an image from a 24-icon library and a description popup.

**Architecture:** `TaskDef` gains `description`, `image`, `startsOn` and `retiresAfter`, and lives in `AppState.tasks`. All scoring code reads `state.tasks` filtered by `isActive(task, day)`. Pure actions (`addTask`, `editTask`, `removeTask`, `undoRemove`) go through the existing reducer. On the UI side, a reusable `Modal` replaces `InfoDialog` and hosts the description popup and the new `TaskForm`. An `AddCard` ends each dashboard section.

**Tech Stack:** Vite, React 19, TypeScript (strict), plain CSS, Vitest + jsdom + React Testing Library (existing).

**Spec:** `docs/superpowers/specs/2026-10-05-custom-tasks-design.md`

## Global Constraints

- Task ids are strings; new ids are `'t-' + 8 hex chars`, generated in `useAppState`, never inside reducers or actions.
- Name 1–24 chars (trimmed); description ≤ 300 chars (trimmed); weekly target 1–7 (once a day) or 1–30 (no day limit); image ∈ `IMAGE_KEYS` (24 keys, fixed order).
- `startsOn` = today if today is Monday, else next Monday. `retiresAfter` = the Sunday of the removal week (started tasks only); not-started tasks are deleted immediately.
- Only active tasks are scored, tapped, counted as pending or penalised. Retired tasks are deleted right after their Sunday is settled.
- Edits never change type, target or dates.
- Migration seeds the 8 existing tasks with their old ids and `startsOn = graceWeek`. A fresh install has `tasks: []`.
- Colors `#000` / `#B48CFF` / `#5A3F8C`; VT323; ASCII-only glyphs on buttons (`[?]`, `[...]`, `[ X ]`, `+`).
- No browser `alert`/`confirm` (two-step remove instead). No manual browser testing (the user's real data lives in that browser); verify with `npm test` and `npm run build`.
- Work directly on `main`; commit messages end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`; push to `origin main` after the final task.

## Review Focus

1. **Removing a task late in the week to dodge the Sunday penalty** → the task stays scored and penalised through Sunday, then disappears. Pinned in Task 2 (settle).
2. **Typing in the add/edit form while the app re-renders** (60 s tick, other tabs) → focus stays in the field and is not pulled back to `[ X ]`. Pinned in Task 4 (Modal).
3. **Tapping a not-yet-started task, or removing one** → no completions are recorded for it, so deleting it can never leave orphaned completion ids that would invalidate saved data. Pinned in Task 2 (actions).
4. **Saving the same new task twice / id collision** → no duplicate ids (duplicates would fail validation and reset all data). Pinned in Task 3.
5. **Existing user data on first load after the update** → the 8 tasks appear with the same ids, so this week's taps and points are kept. Pinned in Task 2 (persist).

---

## File Structure

```
src/domain/imageKeys.ts        # IMAGE_KEYS (new, Task 1)
src/ui/images.ts               # IMAGE_LIBRARY (24) + CHECK (new, Task 1; replaces sprites.ts in Task 2)
src/domain/tasks.ts            # TaskDef v2, taskGroup, isActive, activeTasks, findTask, taskStatus, seedTasks, limits (Task 2)
src/domain/types.ts            # + tasks (Task 2)
src/domain/settle.ts, selectors.ts, actions.ts   # active-only scoring (Task 2); task actions (Task 3)
src/storage/persist.ts         # tasks validation + migration (Task 2)
src/state/useAppState.ts       # task action dispatchers (Task 3)
src/ui/Modal.tsx               # replaces InfoDialog.tsx (Task 4)
src/ui/TaskCard.tsx, CounterCard.tsx  # [?], statuses (Task 4); [...] (Task 5)
src/ui/TaskForm.tsx, AddCard.tsx      # (Task 5)
src/ui/TaskGrid.tsx, src/App.tsx, src/index.css
```

---

### Task 1: Image library

**Files:**
- Create: `src/domain/imageKeys.ts`, `src/ui/images.ts`
- Test: `src/ui/images.test.ts`

**Interfaces:**
- Produces: `IMAGE_KEYS: readonly string[]` (24 keys in picker order), `IMAGE_LIBRARY: Record<string, string[]>`, `CHECK: string[]` (same 7×5 map as in `sprites.ts`)

- [ ] **Step 1: Write the failing test**

`src/ui/images.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { CHECK, IMAGE_LIBRARY } from './images';
import { IMAGE_KEYS } from '../domain/imageKeys';

describe('image library', () => {
  it('has the 24 keys in picker order', () => {
    expect(IMAGE_KEYS).toHaveLength(24);
    expect(IMAGE_KEYS.slice(0, 8)).toEqual(['book', 'laptop', 'shoe', 'dumbbell', 'shield', 'knight', 'broom', 'speech']);
    expect(Object.keys(IMAGE_LIBRARY)).toEqual([...IMAGE_KEYS]);
  });

  it.each([...IMAGE_KEYS])('%s is a 10×10 map of # and .', (key) => {
    const map = IMAGE_LIBRARY[key];
    expect(map).toHaveLength(10);
    for (const row of map) expect(row).toMatch(/^[#.]{10}$/);
  });

  it('keeps the 7×5 checkmark', () => {
    expect(CHECK).toHaveLength(5);
    for (const row of CHECK) expect(row).toMatch(/^[#.]{7}$/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/ui/images.test.ts`
Expected: FAIL — cannot resolve `./images`.

- [ ] **Step 3: Create `src/domain/imageKeys.ts`**

```ts
// Keys of the built-in task images, in picker order. The maps live in ui/images.ts.
export const IMAGE_KEYS: readonly string[] = [
  'book', 'laptop', 'shoe', 'dumbbell', 'shield', 'knight', 'broom', 'speech',
  'music', 'brush', 'water', 'moon', 'apple', 'lotus', 'pen', 'coin',
  'heart', 'plant', 'sun', 'tooth', 'guitar', 'camera', 'no-phone', 'mountain',
];
```

- [ ] **Step 4: Create `src/ui/images.ts`**

The first 8 maps are today's sprites under their new keys (reading→book, coding→laptop, running→shoe, sport→dumbbell, abstinence→shield, logic→knight, chores→broom, language→speech). The other 16 were drafted and previewed during planning.

```ts
// 10x10 task images (# = filled), keyed by image name. Order = picker order (IMAGE_KEYS).

export const IMAGE_LIBRARY: Record<string, string[]> = {
  book: [
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
  laptop: [
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
  shoe: [
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
  dumbbell: [
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
  shield: [
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
  knight: [
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
  broom: [
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
  speech: [
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
  music: [
    '...######.',
    '...######.',
    '...#....#.',
    '...#....#.',
    '...#....#.',
    '...#....#.',
    '.###..###.',
    '####.####.',
    '####.####.',
    '.##...##..',
  ],
  brush: [
    '........##',
    '.......###',
    '......###.',
    '.....###..',
    '....###...',
    '...##.....',
    '..###.....',
    '.####.....',
    '####......',
    '##........',
  ],
  water: [
    '....##....',
    '....##....',
    '...####...',
    '...####...',
    '..######..',
    '.###.####.',
    '.##.#####.',
    '.########.',
    '..######..',
    '...####...',
  ],
  moon: [
    '....#.....',
    '..##......',
    '.###......',
    '.##.......',
    '###.......',
    '####......',
    '.####.....',
    '.########.',
    '..######..',
    '....##....',
  ],
  apple: [
    '.....#....',
    '....#.....',
    '..##.###..',
    '.########.',
    '##########',
    '##########',
    '##########',
    '.########.',
    '.########.',
    '..##..##..',
  ],
  lotus: [
    '....##....',
    '...####...',
    '.#.####.#.',
    '##.####.##',
    '###.##.###',
    '.###..###.',
    '..######..',
    '##########',
    '.########.',
    '..........',
  ],
  pen: [
    '....##....',
    '...####...',
    '...####...',
    '...####...',
    '...####...',
    '..######..',
    '..##..##..',
    '...#..#...',
    '....##....',
    '....##....',
  ],
  coin: [
    '..........',
    '..######..',
    '.########.',
    '..######..',
    '.########.',
    '..######..',
    '.########.',
    '..######..',
    '.########.',
    '..######..',
  ],
  heart: [
    '.##....##.',
    '####..####',
    '##########',
    '##########',
    '##########',
    '.########.',
    '..######..',
    '...####...',
    '....##....',
    '..........',
  ],
  plant: [
    '.##....##.',
    '####..####',
    '.####.###.',
    '...####...',
    '....##....',
    '....##....',
    '.########.',
    '.########.',
    '..######..',
    '..######..',
  ],
  sun: [
    '....##....',
    '....##....',
    '..#....#..',
    '...####...',
    '##.####.##',
    '##.####.##',
    '...####...',
    '..#....#..',
    '....##....',
    '....##....',
  ],
  tooth: [
    '.###..###.',
    '##########',
    '##########',
    '##########',
    '.########.',
    '.########.',
    '.###..###.',
    '.##....##.',
    '.##....##.',
    '..#....#..',
  ],
  guitar: [
    '........##',
    '.......##.',
    '......##..',
    '.....##...',
    '.##.##....',
    '#######...',
    '.####.....',
    '######....',
    '.####.....',
    '..##......',
  ],
  camera: [
    '...###....',
    '.########.',
    '##########',
    '###....###',
    '##..##..##',
    '##.####.##',
    '##..##..##',
    '###....###',
    '##########',
    '.########.',
  ],
  'no-phone': [
    '#.######..',
    '.#.....#..',
    '..#....#..',
    '...#...#..',
    '..#.#..#..',
    '..#..#.#..',
    '..#...#...',
    '..#....#..',
    '..#####.#.',
    '..######.#',
  ],
  mountain: [
    '..........',
    '...#......',
    '..###.....',
    '..###..#..',
    '.#####.##.',
    '.#########',
    '##########',
    '##########',
    '##########',
    '..........',
  ],
};

export const CHECK: string[] = [
  '......#',
  '.....#.',
  '#...#..',
  '.#.#...',
  '..#....',
];
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/ui/images.test.ts`
Expected: PASS (26 tests).

- [ ] **Step 6: Commit**

```bash
git add src/domain/imageKeys.ts src/ui/images.ts src/ui/images.test.ts
git commit -m "feat: add 24-icon task image library"
```

---

### Task 2: Tasks as saved state

Replace the hard-coded `TASKS` with `state.tasks`; score only active tasks; validate and migrate. No new UI features yet.

**Files:**
- Modify: `src/domain/tasks.ts` (rewrite), `src/domain/types.ts`, `src/domain/settle.ts`, `src/domain/actions.ts`, `src/domain/selectors.ts`, `src/storage/persist.ts`, `src/ui/TaskGrid.tsx`, `src/ui/TaskCard.tsx`, `src/ui/CounterCard.tsx`
- Delete: `src/ui/sprites.ts`, `src/ui/sprites.test.ts`
- Test: `src/domain/tasks.test.ts` (rewrite), `src/domain/settle.test.ts`, `src/domain/actions.test.ts`, `src/domain/selectors.test.ts`, `src/storage/persist.test.ts`, `src/App.test.tsx`

**Interfaces:**
- Consumes: `IMAGE_KEYS` (Task 1), `IMAGE_LIBRARY`, `CHECK` (Task 1)
- Produces (`src/domain/tasks.ts`):
  - `type TaskId = string`, `type Cadence`, `type TaskGroup = 'daily' | 'weekly' | 'weekly-unlimited'`, `type TaskStatus = 'active' | 'pending' | 'retiring'`
  - `interface TaskDef { id; name; description; image; cadence; maxPerDay: 1 | null; startsOn: DateKey; retiresAfter: DateKey | null }`
  - `MAX_TASK_NAME = 24`, `MAX_DESCRIPTION = 300`, `TARGET_LIMITS = { weekly: 7, 'weekly-unlimited': 30 }`
  - `taskGroup(task)`, `isActive(task, day)`, `activeTasks(tasks, day)`, `findTask(tasks, id)`, `taskStatus(task, today)`, `seedTasks(startsOn): TaskDef[]`
  - `AppState.tasks: TaskDef[]`

- [ ] **Step 1: Write the new `src/domain/tasks.test.ts` (replace the file)**

```ts
import { describe, expect, it } from 'vitest';
import { activeTasks, isActive, seedTasks, taskGroup, taskStatus, type TaskDef } from './tasks';

const seeds = seedTasks('2026-09-28');
const byId = (id: string) => seeds.find((t) => t.id === id)!;

describe('seedTasks', () => {
  it('recreates the original eight tasks with their ids', () => {
    expect(seeds.map((t) => t.id)).toEqual([
      'reading', 'coding', 'running', 'sport', 'abstinence', 'logic', 'chores', 'language',
    ]);
    expect(seeds.every((t) => t.startsOn === '2026-09-28' && t.retiresAfter === null)).toBe(true);
  });

  it('keeps targets, day limits, images and descriptions', () => {
    expect(byId('coding')).toMatchObject({ cadence: { kind: 'weekly', target: 5 }, maxPerDay: 1, image: 'laptop' });
    expect(byId('sport')).toMatchObject({ cadence: { kind: 'weekly', target: 4 }, maxPerDay: 1, image: 'dumbbell' });
    expect(byId('chores')).toMatchObject({ cadence: { kind: 'weekly', target: 4 }, maxPerDay: null, image: 'broom' });
    expect(byId('reading')).toMatchObject({ cadence: { kind: 'daily' }, maxPerDay: 1, image: 'book' });
    expect(byId('sport').description).toBe('Working out, swimming, skating or any other sport or physical activity.');
  });
});

describe('taskGroup', () => {
  it('derives the dashboard section', () => {
    expect(seeds.filter((t) => taskGroup(t) === 'daily').map((t) => t.id)).toEqual([
      'reading', 'running', 'abstinence', 'logic', 'language',
    ]);
    expect(seeds.filter((t) => taskGroup(t) === 'weekly').map((t) => t.id)).toEqual(['coding', 'sport']);
    expect(seeds.filter((t) => taskGroup(t) === 'weekly-unlimited').map((t) => t.id)).toEqual(['chores']);
  });
});

describe('isActive / taskStatus', () => {
  const task: TaskDef = { ...byId('reading'), startsOn: '2026-10-05', retiresAfter: '2026-10-11' };

  it('is active from startsOn through retiresAfter', () => {
    expect(isActive(task, '2026-10-04')).toBe(false);
    expect(isActive(task, '2026-10-05')).toBe(true);
    expect(isActive(task, '2026-10-11')).toBe(true);
    expect(isActive(task, '2026-10-12')).toBe(false);
    expect(isActive({ ...task, retiresAfter: null }, '2030-01-01')).toBe(true);
  });

  it('filters active tasks', () => {
    expect(activeTasks([task, byId('coding')], '2026-10-01').map((t) => t.id)).toEqual(['coding']);
  });

  it('reports pending, retiring and active', () => {
    expect(taskStatus(task, '2026-10-01')).toBe('pending');
    expect(taskStatus(task, '2026-10-06')).toBe('retiring');
    expect(taskStatus(byId('coding'), '2026-10-01')).toBe('active');
  });
});
```

- [ ] **Step 2: Update the other test helpers and add the failing scoring and persistence tests**

All the remaining scoring tests keep working on the eight seed tasks, active since a Monday long before the reference week.

`src/domain/settle.test.ts`:
- Add `import { seedTasks, type TaskDef } from './tasks';`.
- In `state()`, add `tasks: seedTasks('2026-01-05'),` before `...over`.
- Append inside `describe('settle')`:
```ts
  it('ignores a task before it starts and scores it from its first Monday', () => {
    const extra: TaskDef = { ...seedTasks('2026-10-05')[0], id: 't-new', startsOn: '2026-10-05' };
    const s = state({ tasks: [...seedTasks('2026-01-05'), extra], lastSettledDate: '2026-10-03', points: 100 });
    // Sun 10-04: t-new inactive; 8 seed tasks all missed -> -10, weekly penalty -26
    expect(settle(s, '2026-10-05').points).toBe(64);
    // Mon 10-05: t-new active and missed too -> -12
    expect(settle(s, '2026-10-06').points).toBe(52);
  });

  it('keeps a retiring task scored through its Sunday, then deletes it', () => {
    const tasks = seedTasks('2026-01-05').map((t) => (t.id === 'coding' ? { ...t, retiresAfter: '2026-10-04' } : t));
    const s = state({ tasks, lastSettledDate: '2026-10-03', points: 100, completions: { '2026-10-04': { coding: 1 } } });
    const result = settle(s, '2026-10-05');
    // Sun: -10 daily, +1 coding; penalty coding 4×2 + sport 8 + chores 8 = 24 -> 67
    expect(result.points).toBe(67);
    expect(result.tasks.map((t) => t.id)).not.toContain('coding');
    expect(result.tasks).toHaveLength(7);
  });

  it('does not delete a retiring task before its Sunday is settled', () => {
    const tasks = seedTasks('2026-01-05').map((t) => (t.id === 'coding' ? { ...t, retiresAfter: '2026-10-04' } : t));
    expect(settle(state({ tasks, lastSettledDate: '2026-10-02' }), '2026-10-04').tasks).toHaveLength(8);
  });
```

`src/domain/actions.test.ts`:
- Add `import { seedTasks } from './tasks';`.
- In `state()`, add `tasks: seedTasks('2026-01-05'),` to the returned object.
- Append:
```ts
describe('inactive tasks', () => {
  it('ignores taps on unknown and not-yet-started tasks', () => {
    const pending = { ...seedTasks('2026-10-05')[0], id: 't-later' };
    const s = { ...state(), tasks: [...state().tasks, pending] };
    expect(complete(s, 't-later', TODAY)).toBe(s);
    expect(complete(s, 'nope', TODAY)).toBe(s);
    expect(undo(s, 't-later', TODAY)).toBe(s);
  });
});
```

`src/domain/selectors.test.ts`:
- Replace `import { getTask } from './tasks';` with `import { seedTasks } from './tasks';` and add below the imports:
```ts
const getTask = (id: string) => seedTasks('2026-01-05').find((t) => t.id === id)!;
```
- In `state()`, add `tasks: seedTasks('2026-01-05'),` to the returned object.
- Append:
```ts
describe('inactive tasks in selectors', () => {
  it('leaves not-yet-started tasks out of pending points and will-miss', () => {
    const later = { ...getTask('coding'), id: 't-later', startsOn: '2026-10-05' };
    const s = { ...state({ [SAT]: { reading: 1 } }), tasks: [getTask('reading'), later] };
    expect(pendingToday(s, SAT)).toBe(1);
    expect(willMiss(s, later, SAT)).toBe(0);
  });
});
```

`src/storage/persist.test.ts`:
- Add `import { seedTasks } from '../domain/tasks';`.
- In `valid`, add `tasks: seedTasks('2026-09-28'),` after `rankDays: { Beggar: 2 },`.
- In the `freshState` expectation, change `rankDays: {},` to `rankDays: {}, tasks: [],`.
- Add these rows to the `it.each` table after `['array rank days', ...]`:
```ts
    ['duplicate task id', JSON.stringify({ ...valid, tasks: [...seedTasks('2026-09-28'), seedTasks('2026-09-28')[0]] })],
    ['empty task name', JSON.stringify({ ...valid, tasks: [{ ...seedTasks('2026-09-28')[0], name: '' }] })],
    ['task target too high', JSON.stringify({ ...valid, tasks: [{ ...seedTasks('2026-09-28')[1], cadence: { kind: 'weekly', target: 8 } }] })],
    ['unknown task image', JSON.stringify({ ...valid, tasks: [{ ...seedTasks('2026-09-28')[0], image: 'dragon' }] })],
    ['retiresAfter not a Sunday', JSON.stringify({ ...valid, tasks: [{ ...seedTasks('2026-09-28')[0], retiresAfter: '2026-10-03' }] })],
```
- Replace the body of `migrates data saved before names and week numbers existed` with:
```ts
    const { weekNumber: _w, playerName: _p, rankDays: _r, tasks: _t, ...old } = { ...valid, graceWeek: '2026-09-21' };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(old));
    expect(load(TODAY)).toEqual({
      ...old, weekNumber: 2, playerName: 'no_name', rankDays: {}, tasks: seedTasks('2026-09-21'),
    });
```
- The existing `unknown task id` row (`napping`) now fails because no task in `tasks` has that id; keep it.

`src/App.test.tsx`: a fresh install now has no tasks, so seed the eight before each test.
- Add the imports `import { STORAGE_KEY, freshState } from './storage/persist';` and `import { seedTasks } from './domain/tasks';`.
- In `beforeEach`, after `localStorage.clear();`, add:
```ts
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...freshState('2026-09-30'), tasks: seedTasks('2026-09-28') }));
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `seedTasks`/`isActive`/`activeTasks`/`taskStatus` missing; `state.tasks` ignored by `settle`/selectors; persist migration, fresh state and the new rows fail; App tests fail (the app still renders the hard-coded list, but the seeded state fails validation).

- [ ] **Step 4: Rewrite `src/domain/tasks.ts`**

```ts
import type { DateKey } from './dates';

export type TaskId = string;
export type Cadence = { kind: 'daily' } | { kind: 'weekly'; target: number };
export type TaskGroup = 'daily' | 'weekly' | 'weekly-unlimited';
export type TaskStatus = 'active' | 'pending' | 'retiring';

export interface TaskDef {
  id: TaskId;
  name: string;
  description: string;
  image: string; // key in IMAGE_KEYS
  cadence: Cadence;
  maxPerDay: 1 | null; // null = no day limit
  startsOn: DateKey; // first day scored
  retiresAfter: DateKey | null; // last day scored (a Sunday), set on removal
}

export const MAX_TASK_NAME = 24;
export const MAX_DESCRIPTION = 300;
export const TARGET_LIMITS = { weekly: 7, 'weekly-unlimited': 30 } as const;

export function taskGroup(task: Pick<TaskDef, 'cadence' | 'maxPerDay'>): TaskGroup {
  if (task.cadence.kind === 'daily') return 'daily';
  return task.maxPerDay === null ? 'weekly-unlimited' : 'weekly';
}

export function isActive(task: TaskDef, day: DateKey): boolean {
  return task.startsOn <= day && (task.retiresAfter === null || day <= task.retiresAfter);
}

export function activeTasks(tasks: TaskDef[], day: DateKey): TaskDef[] {
  return tasks.filter((task) => isActive(task, day));
}

export function findTask(tasks: TaskDef[], id: TaskId): TaskDef | undefined {
  return tasks.find((task) => task.id === id);
}

export function taskStatus(task: TaskDef, today: DateKey): TaskStatus {
  if (task.startsOn > today) return 'pending';
  return task.retiresAfter === null ? 'active' : 'retiring';
}

// The original eight tasks, used to migrate data saved before tasks were editable.
export function seedTasks(startsOn: DateKey): TaskDef[] {
  const daily: Cadence = { kind: 'daily' };
  const base = { startsOn, retiresAfter: null };
  return [
    { id: 'reading', name: 'Reading', description: 'Read every day.', image: 'book', cadence: daily, maxPerDay: 1, ...base },
    {
      id: 'coding', name: 'Coding', description: 'Write code – five sessions a week.', image: 'laptop',
      cadence: { kind: 'weekly', target: 5 }, maxPerDay: 1, ...base,
    },
    { id: 'running', name: 'Running', description: 'Go for a run every day.', image: 'shoe', cadence: daily, maxPerDay: 1, ...base },
    {
      id: 'sport', name: 'Sport & Exercise',
      description: 'Working out, swimming, skating or any other sport or physical activity.', image: 'dumbbell',
      cadence: { kind: 'weekly', target: 4 }, maxPerDay: 1, ...base,
    },
    { id: 'abstinence', name: 'Abstinence', description: 'Abstain from pornography.', image: 'shield', cadence: daily, maxPerDay: 1, ...base },
    {
      id: 'logic', name: 'Logic Workout', description: 'A game of chess, online Catan or a strategy board game with friends.',
      image: 'knight', cadence: daily, maxPerDay: 1, ...base,
    },
    {
      id: 'chores', name: 'House Chores', description: 'Any household chore – can be logged more than once a day.',
      image: 'broom', cadence: { kind: 'weekly', target: 4 }, maxPerDay: null, ...base,
    },
    {
      id: 'language', name: 'Language Learning', description: 'Practise a foreign language every day.', image: 'speech',
      cadence: daily, maxPerDay: 1, ...base,
    },
  ];
}
```

- [ ] **Step 5: Add `tasks` to `src/domain/types.ts`**

Change the import to `import type { TaskDef, TaskId } from './tasks';` and add after the `rankDays` line:
```ts
  tasks: TaskDef[]; // the player's tasks, in display order
```

- [ ] **Step 6: Score active tasks only in `src/domain/settle.ts`**

- Replace `import { TASKS } from './tasks';` with `import { activeTasks, type TaskDef } from './tasks';`.
- Change `scoreDay` and `weeklyPenalty` to take the task list first and loop over active tasks:
```ts
function scoreDay(tasks: TaskDef[], completions: Completions, day: DateKey): number {
  let net = 0;
  for (const task of activeTasks(tasks, day)) {
```
```ts
function weeklyPenalty(tasks: TaskDef[], completions: Completions, sunday: DateKey): number {
  let penalty = 0;
  for (const task of activeTasks(tasks, sunday)) {
```
- In `settle`, add `let tasks = state.tasks;` after `const rankDays = ...`. Change the two call sites to `scoreDay(tasks, completions, day)` and `weeklyPenalty(tasks, completions, day)`. Directly after `for (const d of weekDays(day)) delete completions[d];` add:
```ts
      tasks = tasks.filter((task) => task.retiresAfter !== day); // retired tasks leave after their last Sunday
```
- Change the final return to `return { ...state, points, lastSettledDate, completions, weekNumber, rankDays, tasks };`.

- [ ] **Step 7: Use `state.tasks` in `src/domain/actions.ts`**

Replace `import { getTask, type TaskId } from './tasks';` with `import { findTask, isActive, type TaskId } from './tasks';`. Replace the `complete` and `undo` functions with:
```ts
// Only tasks active today can be tapped; this also keeps completions free of
// not-yet-started tasks, which may be deleted outright.
function canTap(state: AppState, id: TaskId, today: DateKey) {
  const task = findTask(state.tasks, id);
  return !isLocked(state, today) && task !== undefined && isActive(task, today) ? task : undefined;
}

export function complete(state: AppState, id: TaskId, today: DateKey): AppState {
  const task = canTap(state, id, today);
  if (!task) return state;
  const count = countOn(state.completions, today, id);
  if (task.maxPerDay !== null && count >= task.maxPerDay) return state;
  return withCount(state, id, today, count + 1);
}

export function undo(state: AppState, id: TaskId, today: DateKey): AppState {
  if (!canTap(state, id, today)) return state;
  const count = countOn(state.completions, today, id);
  if (count === 0) return state;
  return withCount(state, id, today, count - 1);
}
```

- [ ] **Step 8: Active-only selectors in `src/domain/selectors.ts`**

- Replace `import { TASKS, type TaskDef, type TaskId } from './tasks';` with `import { activeTasks, isActive, type TaskDef, type TaskId } from './tasks';`.
- In `willMiss`, change the first line to `if (task.maxPerDay !== 1 || !isActive(task, today)) return 0;`.
- In `pendingToday`, change `for (const task of TASKS) {` to `for (const task of activeTasks(state.tasks, today)) {`.

- [ ] **Step 9: Validate and migrate tasks in `src/storage/persist.ts`**

- Replace `import { TASKS } from '../domain/tasks';` with:
```ts
import { IMAGE_KEYS } from '../domain/imageKeys';
import { MAX_DESCRIPTION, MAX_TASK_NAME, TARGET_LIMITS, seedTasks, type TaskDef } from '../domain/tasks';
```
- Change the dates import to `import { addDays, fromKey, isSunday, mondayOf, toKey, type DateKey } from '../domain/dates';`.
- Replace `const TASK_IDS = new Set<string>(TASKS.map((t) => t.id));` with `const IMAGES = new Set<string>(IMAGE_KEYS);`.
- In `freshState`, add `tasks: [],` after `rankDays: {},`.
- Add above `isValidState`:
```ts
function isTask(value: unknown): value is TaskDef {
  if (!isPlainObject(value)) return false;
  const { id, name, description, image, cadence, maxPerDay, startsOn, retiresAfter } = value;
  if (!isPlainObject(cadence)) return false;
  if (typeof id !== 'string' || id.length === 0) return false;
  if (typeof name !== 'string' || name.trim().length === 0 || name.length > MAX_TASK_NAME) return false;
  if (typeof description !== 'string' || description.length > MAX_DESCRIPTION) return false;
  if (typeof image !== 'string' || !IMAGES.has(image)) return false;
  if (!isDateKey(startsOn)) return false;
  if (retiresAfter !== null && !(isDateKey(retiresAfter) && isSunday(retiresAfter))) return false;
  if (cadence.kind === 'daily') return maxPerDay === 1;
  if (cadence.kind !== 'weekly' || (maxPerDay !== 1 && maxPerDay !== null)) return false;
  const max = maxPerDay === 1 ? TARGET_LIMITS.weekly : TARGET_LIMITS['weekly-unlimited'];
  return isCount(cadence.target) && (cadence.target as number) >= 1 && (cadence.target as number) <= max;
}
```
- In `isValidState`, replace the final `if (!isPlainObject(value.completions)) return false;` and the `return Object.entries(value.completions).every(...)` block with:
```ts
  if (!Array.isArray(value.tasks) || !value.tasks.every(isTask)) return false;
  const taskIds = new Set(value.tasks.map((task) => task.id));
  if (taskIds.size !== value.tasks.length) return false;
  if (!isPlainObject(value.completions)) return false;
  return Object.entries(value.completions).every(
    ([date, day]) =>
      DATE_RE.test(date) &&
      isPlainObject(day) &&
      Object.entries(day).every(([id, n]) => taskIds.has(id) && isCount(n)),
  );
```
- In `migrate`, after the `rankDays` default line, add:
```ts
  if (migrated.tasks === undefined) migrated.tasks = seedTasks(value.graceWeek);
```
- Change `migrate`'s leading comment to start `// Data saved before weekNumber/playerName/rankDays/tasks existed: fill them in.`.

- [ ] **Step 10: Point the UI at `state.tasks` and the image library**

`src/ui/TaskGrid.tsx`: change the tasks import to `import { taskGroup, type TaskDef, type TaskGroup, type TaskId } from '../domain/tasks';` and replace
```tsx
        const tasks = TASKS.filter((task) => taskGroup(task) === group.id);
```
with
```tsx
        const tasks = state.tasks.filter((task) => taskGroup(task) === group.id);
```
`src/ui/TaskCard.tsx`: replace `import { CHECK, SPRITES } from './sprites';` with `import { CHECK, IMAGE_LIBRARY } from './images';` and `map={SPRITES[task.id]}` with `map={IMAGE_LIBRARY[task.image]}`.
`src/ui/CounterCard.tsx`: replace `import { SPRITES } from './sprites';` with `import { IMAGE_LIBRARY } from './images';` and `map={SPRITES[task.id]}` with `map={IMAGE_LIBRARY[task.image]}`.
Delete `src/ui/sprites.ts` and `src/ui/sprites.test.ts` (`git rm`).

- [ ] **Step 11: Run the tests and typecheck**

Run: `npm test && npx tsc`
Expected: all tests PASS; `tsc` clean (no remaining `TASKS`, `getTask` or `SPRITES` references: `grep -rn "TASKS\|getTask(\|SPRITES\[" src` shows only `selectors.test.ts`'s local `getTask` helper and `RANK_SPRITES`).

- [ ] **Step 12: Commit**

```bash
git add -A src
git commit -m "feat: store tasks in state and score only active tasks"
```

---

### Task 3: Task actions (add, edit, remove, undo remove)

**Files:**
- Modify: `src/domain/actions.ts`, `src/state/useAppState.ts`
- Test: `src/domain/actions.test.ts`, `src/state/useAppState.test.ts`

**Interfaces:**
- Consumes: `TaskDef`, `TaskGroup`, `findTask`, `MAX_TASK_NAME`, `MAX_DESCRIPTION`, `TARGET_LIMITS` (Task 2); `IMAGE_KEYS` (Task 1); `addDays`, `dayOfWeek`, `mondayOf`
- Produces (`src/domain/actions.ts`):
  - `interface NewTaskInput { group: TaskGroup; name: string; description: string; image: string; target?: number }`
  - `interface TaskEdit { name: string; description: string; image: string }`
  - `firstStartDay(today: DateKey): DateKey`
  - `addTask(state, input: NewTaskInput, today, id: string): AppState`, `editTask(state, id, edit: TaskEdit): AppState`, `removeTask(state, id, today): AppState`, `undoRemove(state, id): AppState`
- Produces (`useAppState()` return value additions): `addTask(input: NewTaskInput): void`, `editTask(id: string, edit: TaskEdit): void`, `removeTask(id: string): void`, `undoRemove(id: string): void`

- [ ] **Step 1: Write the failing tests**

Append to `src/domain/actions.test.ts`, and change its import to `import { addTask, complete, editTask, firstStartDay, removeTask, rename, undo, undoRemove } from './actions';`:
```ts
describe('task management', () => {
  const input = { group: 'weekly' as const, name: '  Guitar  ', description: ' Practise chords. ', image: 'guitar', target: 3 };

  it('starts new tasks next Monday, or today on a Monday', () => {
    expect(firstStartDay('2026-09-30')).toBe('2026-10-05');
    expect(firstStartDay('2026-10-04')).toBe('2026-10-05');
    expect(firstStartDay('2026-10-05')).toBe('2026-10-05');
  });

  it('adds a cleaned-up task for its section', () => {
    const next = addTask(state(), input, TODAY, 't-1');
    expect(next.tasks.at(-1)).toEqual({
      id: 't-1', name: 'Guitar', description: 'Practise chords.', image: 'guitar',
      cadence: { kind: 'weekly', target: 3 }, maxPerDay: 1, startsOn: '2026-10-05', retiresAfter: null,
    });
    expect(addTask(state(), { ...input, group: 'daily' }, TODAY, 't-2').tasks.at(-1)).toMatchObject({
      cadence: { kind: 'daily' }, maxPerDay: 1,
    });
    expect(addTask(state(), { ...input, group: 'weekly-unlimited' }, TODAY, 't-3').tasks.at(-1)).toMatchObject({
      cadence: { kind: 'weekly', target: 3 }, maxPerDay: null,
    });
  });

  it('rejects empty names and duplicate ids, clamps targets and falls back on unknown images', () => {
    const s = state();
    expect(addTask(s, { ...input, name: '   ' }, TODAY, 't-1')).toBe(s);
    expect(addTask(s, input, TODAY, 'reading')).toBe(s);
    expect(addTask(s, { ...input, target: 99 }, TODAY, 't-1').tasks.at(-1)?.cadence).toEqual({ kind: 'weekly', target: 7 });
    expect(addTask(s, { ...input, group: 'weekly-unlimited', target: 99 }, TODAY, 't-1').tasks.at(-1)?.cadence)
      .toEqual({ kind: 'weekly', target: 30 });
    expect(addTask(s, { ...input, target: Number.NaN }, TODAY, 't-1').tasks.at(-1)?.cadence).toEqual({ kind: 'weekly', target: 3 });
    expect(addTask(s, { ...input, image: 'dragon' }, TODAY, 't-1').tasks.at(-1)?.image).toBe('book');
    expect(addTask(s, { ...input, name: 'x'.repeat(30) }, TODAY, 't-1').tasks.at(-1)?.name).toHaveLength(24);
  });

  it('edits only the name, description and image', () => {
    const next = editTask(state(), 'coding', { name: ' Deep work ', description: 'Focus.', image: 'pen' });
    expect(next.tasks.find((t) => t.id === 'coding')).toMatchObject({
      name: 'Deep work', description: 'Focus.', image: 'pen', cadence: { kind: 'weekly', target: 5 },
    });
    const s = state();
    expect(editTask(s, 'coding', { name: '', description: '', image: 'pen' })).toBe(s);
    expect(editTask(s, 'nope', { name: 'X', description: '', image: 'pen' })).toBe(s);
  });

  it('retires a started task at the end of the week and can undo it', () => {
    const removed = removeTask(state(), 'coding', TODAY);
    expect(removed.tasks.find((t) => t.id === 'coding')?.retiresAfter).toBe('2026-10-04');
    expect(undoRemove(removed, 'coding').tasks.find((t) => t.id === 'coding')?.retiresAfter).toBeNull();
  });

  it('deletes a task that has not started yet straight away', () => {
    const added = addTask(state(), input, TODAY, 't-1');
    expect(removeTask(added, 't-1', TODAY).tasks.map((t) => t.id)).not.toContain('t-1');
  });
});
```

Append to `src/state/useAppState.test.ts` (inside `describe('useAppState')`):
```ts
  it('adds, edits, removes and restores tasks with generated ids', () => {
    vi.setSystemTime(new Date(2026, 8, 30, 10, 0));
    seed({ version: 1, points: 0, graceWeek: '2026-09-28', weekNumber: 1, playerName: 'no_name', lastSettledDate: '2026-09-29', completions: {} });
    const { result } = renderHook(() => useAppState());

    act(() => result.current.addTask({ group: 'daily', name: 'Meditate', description: '', image: 'lotus' }));
    act(() => result.current.addTask({ group: 'daily', name: 'Meditate', description: '', image: 'lotus' }));
    const added = result.current.state.tasks.slice(-2);
    expect(added[0].id).toMatch(/^t-[0-9a-f]{8}$/);
    expect(added[0].id).not.toBe(added[1].id);

    act(() => result.current.editTask('reading', { name: 'Books', description: 'Read.', image: 'book' }));
    act(() => result.current.removeTask('coding'));
    expect(result.current.state.tasks.find((t) => t.id === 'reading')?.name).toBe('Books');
    expect(result.current.state.tasks.find((t) => t.id === 'coding')?.retiresAfter).toBe('2026-10-04');

    act(() => result.current.undoRemove('coding'));
    expect(result.current.state.tasks.find((t) => t.id === 'coding')?.retiresAfter).toBeNull();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).tasks).toHaveLength(10);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/domain/actions.test.ts src/state/useAppState.test.ts`
Expected: FAIL — `addTask`, `editTask`, `firstStartDay`, `removeTask`, `undoRemove` are not exported; the hook has no `addTask`.

- [ ] **Step 3: Implement the actions in `src/domain/actions.ts`**

Change the imports at the top to:
```ts
import { countOn } from './counts';
import { addDays, dayOfWeek, mondayOf, type DateKey } from './dates';
import { IMAGE_KEYS } from './imageKeys';
import {
  MAX_DESCRIPTION, MAX_TASK_NAME, TARGET_LIMITS, findTask, isActive,
  type TaskDef, type TaskGroup, type TaskId,
} from './tasks';
import type { AppState } from './types';
```
Append:
```ts
export interface NewTaskInput {
  group: TaskGroup;
  name: string;
  description: string;
  image: string;
  target?: number;
}

export interface TaskEdit {
  name: string;
  description: string;
  image: string;
}

const DEFAULT_TARGET = 3;

const cleanName = (name: string) => name.trim().slice(0, MAX_TASK_NAME).trim();
const cleanDescription = (text: string) => text.trim().slice(0, MAX_DESCRIPTION);
const cleanImage = (image: string) => (IMAGE_KEYS.includes(image) ? image : IMAGE_KEYS[0]);

function cleanTarget(group: TaskGroup, target: number | undefined): number {
  const max = group === 'weekly-unlimited' ? TARGET_LIMITS['weekly-unlimited'] : TARGET_LIMITS.weekly;
  const value = target !== undefined && Number.isFinite(target) ? Math.round(target) : DEFAULT_TARGET;
  return Math.min(max, Math.max(1, value));
}

function replaceTask(state: AppState, task: TaskDef): AppState {
  return { ...state, tasks: state.tasks.map((t) => (t.id === task.id ? task : t)) };
}

// New tasks start on a Monday so the first week is a full one.
export function firstStartDay(today: DateKey): DateKey {
  return dayOfWeek(today) === 0 ? today : addDays(mondayOf(today), 7);
}

export function addTask(state: AppState, input: NewTaskInput, today: DateKey, id: TaskId): AppState {
  const name = cleanName(input.name);
  if (!name || findTask(state.tasks, id)) return state;
  const task: TaskDef = {
    id,
    name,
    description: cleanDescription(input.description),
    image: cleanImage(input.image),
    cadence: input.group === 'daily' ? { kind: 'daily' } : { kind: 'weekly', target: cleanTarget(input.group, input.target) },
    maxPerDay: input.group === 'weekly-unlimited' ? null : 1,
    startsOn: firstStartDay(today),
    retiresAfter: null,
  };
  return { ...state, tasks: [...state.tasks, task] };
}

export function editTask(state: AppState, id: TaskId, edit: TaskEdit): AppState {
  const task = findTask(state.tasks, id);
  const name = cleanName(edit.name);
  if (!task || !name) return state;
  return replaceTask(state, { ...task, name, description: cleanDescription(edit.description), image: cleanImage(edit.image) });
}

// Started tasks retire after this Sunday (still scored, penalty included); others go now.
export function removeTask(state: AppState, id: TaskId, today: DateKey): AppState {
  const task = findTask(state.tasks, id);
  if (!task) return state;
  if (task.startsOn > today) return { ...state, tasks: state.tasks.filter((t) => t.id !== id) };
  return replaceTask(state, { ...task, retiresAfter: addDays(mondayOf(today), 6) });
}

export function undoRemove(state: AppState, id: TaskId): AppState {
  const task = findTask(state.tasks, id);
  if (!task || task.retiresAfter === null) return state;
  return replaceTask(state, { ...task, retiresAfter: null });
}
```

- [ ] **Step 4: Wire the actions into `src/state/useAppState.ts`**

- Change the actions import to:
```ts
import {
  addTask, complete, editTask, removeTask, rename, undo, undoRemove,
  type NewTaskInput, type TaskEdit,
} from '../domain/actions';
```
- Extend the `Action` union with:
```ts
  | { type: 'addTask'; input: NewTaskInput; id: TaskId; today: DateKey }
  | { type: 'editTask'; id: TaskId; edit: TaskEdit; today: DateKey }
  | { type: 'removeTask' | 'undoRemove'; id: TaskId; today: DateKey }
```
- Add these reducer cases after `case 'rename':`:
```ts
    case 'addTask':
      return addTask(settled, action.input, action.today, action.id);
    case 'editTask':
      return editTask(settled, action.id, action.edit);
    case 'removeTask':
      return removeTask(settled, action.id, action.today);
    case 'undoRemove':
      return undoRemove(settled, action.id);
```
- Below `const currentKey = ...`, add:
```ts
// Generated outside the reducer so StrictMode's double-run sees the same id.
const newTaskId = () => `t-${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
```
- Before the `return` of `useAppState`, add:
```ts
  const addNewTask = useCallback(
    (input: NewTaskInput) => dispatch({ type: 'addTask', input, id: newTaskId(), today: currentKey() }),
    [],
  );
  const editExistingTask = useCallback(
    (id: TaskId, edit: TaskEdit) => dispatch({ type: 'editTask', id, edit, today: currentKey() }),
    [],
  );
  const removeExistingTask = useCallback((id: TaskId) => dispatch({ type: 'removeTask', id, today: currentKey() }), []);
  const undoTaskRemoval = useCallback((id: TaskId) => dispatch({ type: 'undoRemove', id, today: currentKey() }), []);
```
- Extend the returned object with `addTask: addNewTask, editTask: editExistingTask, removeTask: removeExistingTask, undoRemove: undoTaskRemoval`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test && npx tsc`
Expected: PASS; `tsc` clean.

- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "feat: add, edit, remove and restore tasks"
```

---

### Task 4: Modal, card descriptions and task statuses

**Files:**
- Create: `src/ui/Modal.tsx`
- Delete: `src/ui/InfoDialog.tsx`
- Modify: `src/ui/TaskGrid.tsx`, `src/ui/TaskCard.tsx`, `src/ui/CounterCard.tsx`, `src/index.css`
- Test: `src/ui/Modal.test.tsx`, `src/App.test.tsx`

**Interfaces:**
- Consumes: `taskStatus`, `TaskStatus`, `TaskDef` (Task 2)
- Produces:
  - `Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode })`: `role="dialog"`, labelled by its title, close button labelled `Close`
  - `CardProps` gains `status: TaskStatus` and `onInfo: (event: React.MouseEvent<HTMLButtonElement>) => void`
  - Card `[?]` button labelled `About <task name>`

- [ ] **Step 1: Write the failing tests**

`src/ui/Modal.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

describe('Modal', () => {
  it('is a labelled dialog that focuses its close button and closes on Escape, backdrop or X', () => {
    const onClose = vi.fn();
    render(<Modal title="HELLO" onClose={onClose}><p>Body</p></Modal>);
    const dialog = screen.getByRole('dialog', { name: 'HELLO' });
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();

    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(dialog.parentElement!);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('does not steal focus back from a field when re-rendered', () => {
    const { rerender } = render(<Modal title="FORM" onClose={() => {}}><input aria-label="Field" /></Modal>);
    const field = screen.getByRole('textbox', { name: 'Field' });
    field.focus();
    rerender(<Modal title="FORM" onClose={() => {}}><input aria-label="Field" /></Modal>);
    expect(field).toHaveFocus();
  });
});
```

Append to `src/App.test.tsx` (inside `describe('App')`), and add `type TaskDef` to its `./domain/tasks` import:
```tsx
  it('shows a task description from the card [?] and returns focus', () => {
    render(<App />);
    const info = screen.getByRole('button', { name: 'About Sport & Exercise' });
    fireEvent.click(info);
    const dialog = screen.getByRole('dialog', { name: 'SPORT & EXERCISE' });
    expect(within(dialog).getByText(/swimming, skating/)).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(info).toHaveFocus();
  });

  it('falls back when a task has no description', () => {
    const tasks = seedTasks('2026-09-28').map((t) => (t.id === 'reading' ? { ...t, description: '' } : t));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...freshState('2026-09-30'), tasks }));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'About Reading' }));
    expect(within(screen.getByRole('dialog', { name: 'READING' })).getByText('No description yet.')).toBeInTheDocument();
  });

  it('marks not-started tasks as STARTS MON and removed ones as RETIRES SUNDAY', () => {
    const seeds = seedTasks('2026-09-28');
    const tasks: TaskDef[] = [
      ...seeds.map((t) => (t.id === 'coding' ? { ...t, retiresAfter: '2026-10-04' } : t)),
      { ...seeds[0], id: 't-later', name: 'Meditate', startsOn: '2026-10-05' },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...freshState('2026-09-30'), tasks }));
    render(<App />);

    const later = screen.getByRole('article', { name: 'Meditate' });
    expect(within(later).getByText('STARTS MON')).toBeInTheDocument();
    expect(within(later).queryByRole('button', { name: '[ MARK DONE ]' })).not.toBeInTheDocument();

    const coding = screen.getByRole('article', { name: 'Coding' });
    expect(within(coding).getByText(/RETIRES SUNDAY/)).toBeInTheDocument();
    expect(within(coding).getByRole('button', { name: '[ MARK DONE ]' })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ui/Modal.test.tsx src/App.test.tsx`
Expected: FAIL — cannot resolve `./Modal`; no `About Sport & Exercise` button; no `STARTS MON`/`RETIRES SUNDAY`.

- [ ] **Step 3: Create `src/ui/Modal.tsx` and delete `src/ui/InfoDialog.tsx`**

```tsx
import { useEffect, useId, useRef, type ReactNode } from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ title, onClose, children }: ModalProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Mount-only: focusing again on every render would pull focus out of form fields.
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="backdrop" onClick={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-top">
          <h2 id={titleId} className="dialog-title">
            {title}
          </h2>
          <button ref={closeRef} type="button" className="btn" aria-label="Close" onClick={onClose}>
            [ X ]
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
```
Run `git rm src/ui/InfoDialog.tsx`.

- [ ] **Step 4: Replace `src/ui/TaskCard.tsx`**

```tsx
import type { MouseEvent } from 'react';
import type { TaskDef, TaskStatus } from '../domain/tasks';
import { cadenceLabel } from './format';
import { CHECK, IMAGE_LIBRARY } from './images';
import { PixelSprite } from './PixelSprite';

export interface CardProps {
  task: TaskDef;
  status: TaskStatus;
  todayCount: number;
  remaining: number | null;
  willMiss: number;
  onComplete: () => void;
  onUndo: () => void;
  onInfo: (event: MouseEvent<HTMLButtonElement>) => void;
}

export function CardTop({ task, onInfo }: Pick<CardProps, 'task' | 'onInfo'>) {
  return (
    <div className="card-tools">
      <button type="button" className="btn tool-btn" aria-label={`About ${task.name}`} onClick={onInfo}>
        [?]
      </button>
    </div>
  );
}

export function CardSubtitle({ status, remaining, willMiss }: Pick<CardProps, 'status' | 'remaining' | 'willMiss'>) {
  const parts: string[] = [];
  if (remaining !== null) parts.push(cadenceLabel(remaining));
  if (status === 'retiring') parts.push('RETIRES SUNDAY');
  return (
    <p className="sub">
      {parts.join(' · ')}
      {willMiss > 0 && <span className="risk"> · WILL MISS {willMiss}</span>}
    </p>
  );
}

export function TaskCard({ task, status, todayCount, remaining, willMiss, onComplete, onUndo, onInfo }: CardProps) {
  const done = todayCount > 0;
  return (
    <article className={status === 'pending' ? 'card card-pending' : 'card'} aria-label={task.name}>
      <CardTop task={task} onInfo={onInfo} />
      <PixelSprite map={IMAGE_LIBRARY[task.image]} title={task.name} />
      <h3>{task.name.toUpperCase()}</h3>
      <CardSubtitle status={status} remaining={remaining} willMiss={willMiss} />
      {status === 'pending' ? (
        <p className="starts">STARTS MON</p>
      ) : (
        <button
          type="button"
          className={done ? 'btn btn-done' : 'btn'}
          aria-pressed={done}
          onClick={done ? onUndo : onComplete}
        >
          {done ? (
            <>
              [ DONE <PixelSprite map={CHECK} size={21} className="check" /> ]
            </>
          ) : (
            '[ MARK DONE ]'
          )}
        </button>
      )}
    </article>
  );
}
```

- [ ] **Step 5: Replace `src/ui/CounterCard.tsx`**

```tsx
import { IMAGE_LIBRARY } from './images';
import { PixelSprite } from './PixelSprite';
import { CardSubtitle, CardTop, type CardProps } from './TaskCard';

export function CounterCard({ task, status, todayCount, remaining, willMiss, onComplete, onUndo, onInfo }: CardProps) {
  return (
    <article className={status === 'pending' ? 'card card-pending' : 'card'} aria-label={task.name}>
      <CardTop task={task} onInfo={onInfo} />
      <PixelSprite map={IMAGE_LIBRARY[task.image]} title={task.name} />
      <h3>{task.name.toUpperCase()}</h3>
      <CardSubtitle status={status} remaining={remaining} willMiss={willMiss} />
      {status === 'pending' ? (
        <p className="starts">STARTS MON</p>
      ) : (
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
      )}
    </article>
  );
}
```

- [ ] **Step 6: Use `Modal` and the new card props in `src/ui/TaskGrid.tsx`**

Replace the whole file with:
```tsx
import { useRef, useState, type MouseEvent } from 'react';
import type { DateKey } from '../domain/dates';
import { remainingThisWeek, todayCount, willMiss } from '../domain/selectors';
import { findTask, taskGroup, taskStatus, type TaskDef, type TaskGroup, type TaskId } from '../domain/tasks';
import type { AppState } from '../domain/types';
import { CounterCard } from './CounterCard';
import { Modal } from './Modal';
import { TaskCard, type CardProps } from './TaskCard';

interface TaskGridProps {
  state: AppState;
  today: DateKey;
  onComplete: (id: TaskId) => void;
  onUndo: (id: TaskId) => void;
}

const GROUPS: { id: TaskGroup; title: string; info: string }[] = [
  {
    id: 'daily',
    title: 'DAILY',
    info: 'Do each of these once every day. Done: +1 point at midnight. Missed: -2 points at midnight.',
  },
  {
    id: 'weekly',
    title: 'WEEKLY',
    info:
      'Each has a weekly target (e.g. Coding 5×) and counts at most once per day. +1 point per session at midnight. ' +
      'On Sunday night, -2 for every session short of the target.',
  },
  {
    id: 'weekly-unlimited',
    title: 'WEEKLY · NO DAY LIMIT',
    info:
      'A weekly target you can log several times a day (e.g. 3 chores today). +1 point per session up to the target; ' +
      'extras earn nothing. On Sunday night, -2 for every session short of the target.',
  },
];

type OpenModal = { kind: 'group'; group: TaskGroup } | { kind: 'task'; id: TaskId };

export function TaskGrid({ state, today, onComplete, onUndo }: TaskGridProps) {
  const [modal, setModal] = useState<OpenModal | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  const open = (next: OpenModal) => (event: MouseEvent<HTMLButtonElement>) => {
    opener.current = event.currentTarget;
    setModal(next);
  };
  const close = () => {
    setModal(null);
    opener.current?.focus();
  };

  const renderCard = (task: TaskDef) => {
    const status = taskStatus(task, today);
    const props: CardProps = {
      task,
      status,
      todayCount: todayCount(state, task.id, today),
      remaining: status === 'pending' ? null : remainingThisWeek(state, task, today),
      willMiss: willMiss(state, task, today),
      onComplete: () => onComplete(task.id),
      onUndo: () => onUndo(task.id),
      onInfo: open({ kind: 'task', id: task.id }),
    };
    return task.maxPerDay === null ? (
      <CounterCard key={task.id} {...props} />
    ) : (
      <TaskCard key={task.id} {...props} />
    );
  };

  const renderModal = () => {
    if (!modal) return null;
    if (modal.kind === 'group') {
      const group = GROUPS.find((g) => g.id === modal.group)!;
      return (
        <Modal title={group.title} onClose={close}>
          <p>{group.info}</p>
        </Modal>
      );
    }
    const task = findTask(state.tasks, modal.id);
    if (!task) return null;
    return (
      <Modal title={task.name.toUpperCase()} onClose={close}>
        <p>{task.description || 'No description yet.'}</p>
      </Modal>
    );
  };

  return (
    <>
      {GROUPS.map((group) => {
        const tasks = state.tasks.filter((task) => taskGroup(task) === group.id);
        if (tasks.length === 0) return null;
        return (
          <section key={group.id} className="task-group" aria-labelledby={`group-${group.id}`}>
            <div className="group-head">
              <h2 id={`group-${group.id}`} className="group-title">
                {group.title}
              </h2>
              <button
                type="button"
                className="btn info-btn"
                aria-label={`About ${group.title} tasks`}
                onClick={open({ kind: 'group', group: group.id })}
              >
                [?]
              </button>
            </div>
            <div className="grid">{tasks.map(renderCard)}</div>
          </section>
        );
      })}
      {renderModal()}
    </>
  );
}
```

- [ ] **Step 7: Add card styles to `src/index.css`**

In the existing `.card { ... }` rule add `position: relative;`, and append at the end of the file:
```css
.card-tools {
  position: absolute;
  top: 8px;
  left: 8px;
  right: 8px;
  display: flex;
  justify-content: space-between;
  pointer-events: none;
}

.tool-btn {
  padding: 0 4px;
  pointer-events: auto;
}

.tool-btn:only-child {
  margin-right: auto;
}

.card-pending {
  border-color: var(--dim);
  color: var(--dim);
}

.card-pending .sprite {
  fill: var(--dim);
}

.starts {
  margin-top: auto;
  letter-spacing: 2px;
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm test && npx tsc`
Expected: PASS (including the existing section-popup tests, now served by `Modal`); `tsc` clean.

- [ ] **Step 9: Commit**

```bash
git add -A src
git commit -m "feat: task description popups and starting/retiring card states"
```

---

### Task 5: Add card, task form, edit and remove

**Files:**
- Create: `src/ui/TaskForm.tsx`, `src/ui/AddCard.tsx`
- Modify: `src/ui/TaskGrid.tsx`, `src/ui/TaskCard.tsx`, `src/ui/CounterCard.tsx`, `src/App.tsx`, `src/index.css`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: `NewTaskInput`, `TaskEdit` (Task 3); hook `addTask`/`editTask`/`removeTask`/`undoRemove` (Task 3); `Modal`, `CardProps`, `CardTop` (Task 4); `IMAGE_KEYS`, `IMAGE_LIBRARY` (Task 1); `taskStatus`, `TARGET_LIMITS`, `MAX_TASK_NAME`, `MAX_DESCRIPTION`, `dayOfWeek`
- Produces:
  - `TaskForm({ group, today, task?, onSubmit, onRemove?, onUndoRemove? })` with `TaskFormValues = { name; description; image; target }`
  - `AddCard({ group, onClick })`, `ADD_LABELS`, `NEW_TITLES: Record<TaskGroup, string>`
  - `CardProps.onEdit: (event: MouseEvent<HTMLButtonElement>) => void`; card `[...]` button labelled `Edit <task name>`
  - `TaskGridProps` gains `onAddTask(input: NewTaskInput)`, `onEditTask(id, edit: TaskEdit)`, `onRemoveTask(id)`, `onUndoRemove(id)`

- [ ] **Step 1: Write the failing tests**

Append to `src/App.test.tsx` (inside `describe('App')`):
```tsx
  it('adds a weekly task that starts next Monday', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'ADD WEEKLY TASK' }));
    const dialog = screen.getByRole('dialog', { name: 'NEW WEEKLY TASK' });
    const save = within(dialog).getByRole('button', { name: '[ SAVE ]' });
    expect(save).toBeDisabled();
    expect(within(dialog).getByText('STARTS NEXT MONDAY')).toBeInTheDocument();

    fireEvent.change(within(dialog).getByRole('textbox', { name: 'NAME' }), { target: { value: 'Guitar practice' } });
    const spin = within(dialog).getByRole('spinbutton');
    expect(spin).toHaveAttribute('max', '7');
    fireEvent.change(spin, { target: { value: '99' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'guitar' }));
    expect(within(dialog).getByRole('button', { name: 'guitar' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'DESCRIPTION' }), { target: { value: 'Chords and scales.' } });
    fireEvent.click(save);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const card = within(screen.getByRole('region', { name: 'WEEKLY' })).getByRole('article', { name: 'Guitar practice' });
    expect(within(card).getByText('STARTS MON')).toBeInTheDocument();
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!).tasks.at(-1);
    expect(saved).toMatchObject({ name: 'Guitar practice', image: 'guitar', cadence: { kind: 'weekly', target: 7 } });
  });

  it('starts a task added on a Monday right away', () => {
    vi.setSystemTime(new Date(2026, 9, 5, 10, 0)); // Monday
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'ADD DAILY TASK' }));
    const dialog = screen.getByRole('dialog', { name: 'NEW DAILY TASK' });
    expect(within(dialog).getByText('STARTS TODAY')).toBeInTheDocument();
    expect(within(dialog).queryByRole('spinbutton')).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'NAME' }), { target: { value: 'Meditate' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '[ SAVE ]' }));
    const card = screen.getByRole('article', { name: 'Meditate' });
    expect(within(card).getByRole('button', { name: '[ MARK DONE ]' })).toBeInTheDocument();
  });

  it('edits a task name, image and description but not its target', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Coding' }));
    const dialog = screen.getByRole('dialog', { name: 'EDIT TASK' });
    expect(within(dialog).getByRole('textbox', { name: 'NAME' })).toHaveValue('Coding');
    expect(within(dialog).queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(within(dialog).getByText('5 PER WEEK')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'NAME' }), { target: { value: 'Deep work' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '[ SAVE ]' }));
    expect(screen.getByRole('article', { name: 'Deep work' })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Coding' })).not.toBeInTheDocument();
  });

  it('removes a started task at the end of the week in two steps, and can undo it', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Coding' }));
    let dialog = screen.getByRole('dialog', { name: 'EDIT TASK' });
    fireEvent.click(within(dialog).getByRole('button', { name: '[ REMOVE ]' }));
    expect(within(dialog).getByText('STAYS UNTIL SUNDAY NIGHT AND IS SCORED AS USUAL')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: '[ CONFIRM REMOVE ]' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(within(screen.getByRole('article', { name: 'Coding' })).getByText(/RETIRES SUNDAY/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Coding' }));
    dialog = screen.getByRole('dialog', { name: 'EDIT TASK' });
    fireEvent.click(within(dialog).getByRole('button', { name: '[ UNDO REMOVE ]' }));
    expect(within(screen.getByRole('article', { name: 'Coding' })).queryByText(/RETIRES SUNDAY/)).not.toBeInTheDocument();
  });

  it('removes a not-yet-started task immediately', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'ADD DAILY TASK' }));
    let dialog = screen.getByRole('dialog', { name: 'NEW DAILY TASK' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'NAME' }), { target: { value: 'Meditate' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '[ SAVE ]' }));

    fireEvent.click(screen.getByRole('button', { name: 'Edit Meditate' }));
    dialog = screen.getByRole('dialog', { name: 'EDIT TASK' });
    fireEvent.click(within(dialog).getByRole('button', { name: '[ REMOVE ]' }));
    expect(within(dialog).getByText('REMOVED NOW')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: '[ CONFIRM REMOVE ]' }));
    expect(screen.queryByRole('article', { name: 'Meditate' })).not.toBeInTheDocument();
  });

  it('shows every section with its add card even when it has no tasks', () => {
    const tasks = seedTasks('2026-09-28').filter((t) => t.cadence.kind === 'daily');
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...freshState('2026-09-30'), tasks }));
    render(<App />);
    const weekly = screen.getByRole('region', { name: 'WEEKLY' });
    expect(within(weekly).queryAllByRole('article')).toHaveLength(0);
    expect(within(weekly).getByRole('button', { name: 'ADD WEEKLY TASK' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ADD NO-LIMIT TASK' })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL — no `ADD WEEKLY TASK` / `Edit Coding` buttons.

- [ ] **Step 3: Create `src/ui/AddCard.tsx`**

```tsx
import type { MouseEvent } from 'react';
import type { TaskGroup } from '../domain/tasks';

export const ADD_LABELS: Record<TaskGroup, string> = {
  daily: 'ADD DAILY TASK',
  weekly: 'ADD WEEKLY TASK',
  'weekly-unlimited': 'ADD NO-LIMIT TASK',
};

export const NEW_TITLES: Record<TaskGroup, string> = {
  daily: 'NEW DAILY TASK',
  weekly: 'NEW WEEKLY TASK',
  'weekly-unlimited': 'NEW NO-LIMIT TASK',
};

interface AddCardProps {
  group: TaskGroup;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}

export function AddCard({ group, onClick }: AddCardProps) {
  return (
    <button type="button" className="card add-card" onClick={onClick}>
      <span className="add-plus" aria-hidden="true">
        +
      </span>
      <span>{ADD_LABELS[group]}</span>
    </button>
  );
}
```

- [ ] **Step 4: Create `src/ui/TaskForm.tsx`**

```tsx
import { useState } from 'react';
import { dayOfWeek, type DateKey } from '../domain/dates';
import { IMAGE_KEYS } from '../domain/imageKeys';
import { MAX_DESCRIPTION, MAX_TASK_NAME, TARGET_LIMITS, taskStatus, type TaskDef, type TaskGroup } from '../domain/tasks';
import { IMAGE_LIBRARY } from './images';
import { PixelSprite } from './PixelSprite';

export interface TaskFormValues {
  name: string;
  description: string;
  image: string;
  target: number;
}

interface TaskFormProps {
  group: TaskGroup;
  today: DateKey;
  task?: TaskDef; // present when editing
  onSubmit: (values: TaskFormValues) => void;
  onRemove?: () => void;
  onUndoRemove?: () => void;
}

export function TaskForm({ group, today, task, onSubmit, onRemove, onUndoRemove }: TaskFormProps) {
  const [name, setName] = useState(task?.name ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [image, setImage] = useState(task?.image ?? IMAGE_KEYS[0]);
  const [target, setTarget] = useState(task && task.cadence.kind === 'weekly' ? task.cadence.target : 3);
  const [confirming, setConfirming] = useState(false);

  const status = task ? taskStatus(task, today) : null;
  const maxTarget = group === 'weekly-unlimited' ? TARGET_LIMITS['weekly-unlimited'] : TARGET_LIMITS.weekly;
  const canSave = name.trim().length > 0;

  return (
    <form
      className="task-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSave) onSubmit({ name, description, image, target });
      }}
    >
      <label className="field">
        <span>NAME</span>
        <input value={name} maxLength={MAX_TASK_NAME} onChange={(e) => setName(e.target.value)} />
      </label>

      {group !== 'daily' &&
        (task ? (
          <p className="field">
            <span>TARGET</span>
            {target} PER WEEK
          </p>
        ) : (
          <label className="field">
            <span>TARGET</span>
            <span className="target">
              <input
                type="number"
                min={1}
                max={maxTarget}
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
              />{' '}
              PER WEEK
            </span>
          </label>
        ))}

      <fieldset className="field">
        <legend>IMAGE</legend>
        <div className="image-picker">
          {IMAGE_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className={key === image ? 'btn image-option selected' : 'btn image-option'}
              aria-label={key}
              aria-pressed={key === image}
              onClick={() => setImage(key)}
            >
              <PixelSprite map={IMAGE_LIBRARY[key]} size={30} className="option-sprite" />
            </button>
          ))}
        </div>
      </fieldset>

      <label className="field">
        <span>DESCRIPTION</span>
        <textarea
          value={description}
          maxLength={MAX_DESCRIPTION}
          rows={3}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>

      {!task && <p className="note">{dayOfWeek(today) === 0 ? 'STARTS TODAY' : 'STARTS NEXT MONDAY'}</p>}
      {confirming && (
        <p className="note">
          {status === 'pending' ? 'REMOVED NOW' : 'STAYS UNTIL SUNDAY NIGHT AND IS SCORED AS USUAL'}
        </p>
      )}

      <div className="form-actions">
        <button type="submit" className="btn" disabled={!canSave}>
          [ SAVE ]
        </button>
        {task &&
          (status === 'retiring' ? (
            <button type="button" className="btn" onClick={onUndoRemove}>
              [ UNDO REMOVE ]
            </button>
          ) : (
            <button type="button" className="btn" onClick={() => (confirming ? onRemove?.() : setConfirming(true))}>
              {confirming ? '[ CONFIRM REMOVE ]' : '[ REMOVE ]'}
            </button>
          ))}
      </div>
    </form>
  );
}
```

- [ ] **Step 5: Add the `[...]` edit button to the cards**

In `src/ui/TaskCard.tsx`:
- Add to `CardProps`: `onEdit: (event: MouseEvent<HTMLButtonElement>) => void;`
- Replace `CardTop` with:
```tsx
export function CardTop({ task, onInfo, onEdit }: Pick<CardProps, 'task' | 'onInfo' | 'onEdit'>) {
  return (
    <div className="card-tools">
      <button type="button" className="btn tool-btn" aria-label={`About ${task.name}`} onClick={onInfo}>
        [?]
      </button>
      <button type="button" className="btn tool-btn" aria-label={`Edit ${task.name}`} onClick={onEdit}>
        [...]
      </button>
    </div>
  );
}
```
- In `TaskCard`, add `onEdit` to the destructured props and render `<CardTop task={task} onInfo={onInfo} onEdit={onEdit} />`.

In `src/ui/CounterCard.tsx`, add `onEdit` to the destructured props and render `<CardTop task={task} onInfo={onInfo} onEdit={onEdit} />`.

In `src/index.css`, delete the `.tool-btn:only-child { ... }` rule.

- [ ] **Step 6: Add the add/edit modals to `src/ui/TaskGrid.tsx`**

- Add the imports:
```tsx
import type { NewTaskInput, TaskEdit } from '../domain/actions';
import { AddCard, NEW_TITLES } from './AddCard';
import { TaskForm } from './TaskForm';
```
- Extend `TaskGridProps` with:
```ts
  onAddTask: (input: NewTaskInput) => void;
  onEditTask: (id: TaskId, edit: TaskEdit) => void;
  onRemoveTask: (id: TaskId) => void;
  onUndoRemove: (id: TaskId) => void;
```
  and destructure them in the component signature.
- Change `OpenModal` to:
```ts
type OpenModal =
  | { kind: 'group'; group: TaskGroup }
  | { kind: 'task'; id: TaskId }
  | { kind: 'add'; group: TaskGroup }
  | { kind: 'edit'; id: TaskId };
```
- In `renderCard`'s props, add `onEdit: open({ kind: 'edit', id: task.id }),`.
- In `renderModal`, after the `group` branch, add:
```tsx
    if (modal.kind === 'add') {
      const group = modal.group;
      return (
        <Modal title={NEW_TITLES[group]} onClose={close}>
          <TaskForm
            group={group}
            today={today}
            onSubmit={(values) => {
              onAddTask({ group, ...values });
              close();
            }}
          />
        </Modal>
      );
    }
```
  and replace the remaining task branch with:
```tsx
    const task = findTask(state.tasks, modal.id);
    if (!task) return null;
    if (modal.kind === 'task') {
      return (
        <Modal title={task.name.toUpperCase()} onClose={close}>
          <p>{task.description || 'No description yet.'}</p>
        </Modal>
      );
    }
    return (
      <Modal title="EDIT TASK" onClose={close}>
        <TaskForm
          group={taskGroup(task)}
          today={today}
          task={task}
          onSubmit={({ name, description, image }) => {
            onEditTask(task.id, { name, description, image });
            close();
          }}
          onRemove={() => {
            onRemoveTask(task.id);
            close();
          }}
          onUndoRemove={() => {
            onUndoRemove(task.id);
            close();
          }}
        />
      </Modal>
    );
```
- In the sections map, delete `if (tasks.length === 0) return null;` and change the grid line to:
```tsx
            <div className="grid">
              {tasks.map(renderCard)}
              <AddCard group={group.id} onClick={open({ kind: 'add', group: group.id })} />
            </div>
```

- [ ] **Step 7: Pass the task actions from `src/App.tsx`**

Change the hook destructuring to:
```tsx
  const { state, today, complete, undo, rename, addTask, editTask, removeTask, undoRemove } = useAppState();
```
and the `TaskGrid` element to:
```tsx
      <TaskGrid
        state={state}
        today={today}
        onComplete={complete}
        onUndo={undo}
        onAddTask={addTask}
        onEditTask={editTask}
        onRemoveTask={removeTask}
        onUndoRemove={undoRemove}
      />
```

- [ ] **Step 8: Add form and add-card styles to `src/index.css`**

Append:
```css
.add-card {
  font: inherit;
  color: var(--dim);
  background: var(--bg);
  border: 2px dashed var(--dim);
  justify-content: center;
  cursor: pointer;
  min-height: 200px;
}

.add-card:hover,
.add-card:focus-visible {
  color: var(--fg);
  border-color: var(--fg);
  outline: none;
}

.add-plus {
  font-size: 64px;
  line-height: 1;
}

.task-form {
  display: grid;
  gap: 12px;
}

.field {
  display: grid;
  gap: 4px;
  border: none;
}

.field > span:first-child,
.field > legend {
  color: var(--dim);
}

.field input,
.field textarea {
  font: inherit;
  color: var(--fg);
  background: var(--bg);
  border: var(--border);
  padding: 4px 8px;
}

.field textarea {
  resize: vertical;
}

.target input {
  width: 4em;
}

.image-picker {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
  gap: 6px;
}

.image-option {
  display: grid;
  place-items: center;
  padding: 4px;
}

.option-sprite {
  fill: currentColor;
}

.image-option.selected {
  background: var(--fg);
  color: var(--bg);
}

.note {
  color: var(--dim);
}

.form-actions {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.dialog {
  max-height: calc(100vh - 32px);
  overflow-y: auto;
}
```

- [ ] **Step 9: Run the full suite and build**

Run: `npm test && npm run build`
Expected: all tests PASS; `tsc` clean; Vite build succeeds.

- [ ] **Step 10: Commit and push**

```bash
git add -A src
git commit -m "feat: add, edit and remove tasks from the dashboard"
git push origin main
```
