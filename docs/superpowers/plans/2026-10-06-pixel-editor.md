# Pixel Editor (Custom Tasks Part 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the player draw 10×10 task images in an editor inside the task form popup. Drawings are saved in a shared custom library (editable; deletable only while unused) and appear in the image picker.

**Architecture:** `AppState.customImages` holds `{ key, map }` entries, managed by pure actions in `domain/images.ts` and validated in `persist.ts`. Cards and pickers resolve keys through `imageMap(customImages, key)`. The editor is a self-contained `PixelEditor` built on pure helpers in `ui/pixelGrid.ts` (cells, hit-testing, undo history). A `TaskFormDialog` owns the popup: it switches between the (hidden but mounted) `TaskForm` and the `PixelEditor`, and holds the selected image.

**Tech Stack:** Vite, React 19, TypeScript (strict), plain CSS, Vitest + jsdom (has `PointerEvent` with coordinates, no `setPointerCapture`) + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-06-pixel-editor-design.md`

## Global Constraints

- Custom image key: `'c-' + 8 hex chars` (`/^c-[0-9a-f]{8}$/`), generated in `useAppState` with `crypto.getRandomValues`, never in reducers.
- Map: 10 strings matching `/^[#.]{10}$/` with at least one `#`. At most 100 custom images.
- A custom image used by any task (active, pending or retiring) can't be deleted.
- Undo history: up to 50 steps each way. One step = one stroke, one clear, one keyboard toggle, or one copy. Strokes are recorded with pure state updaters (StrictMode-safe).
- In the editor view, Esc, the backdrop and `[ X ]` return to the task form. The form stays mounted (hidden), so typed values survive.
- Colors `#000` / `#B48CFF` / `#5A3F8C`; VT323; ASCII-only button glyphs.
- No manual browser testing; verify with `npm test` and `npm run build`. Work on `main`; commit messages end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`; push after the final task.

## Review Focus

1. **Painting by dragging a finger or mouse across cells** → every cell under the pointer is painted, not just the first one. Pinned in Task 3 (drag test with a mocked grid rect).
2. **Deleting a custom image a task uses** → blocked. A task pointing at a missing image would invalidate saved data and reset everything. Pinned in Task 1 (domain) and Task 4 (UI).
3. **Leaving the editor (save, cancel, Esc)** → back on the task form with the typed name and description intact. Pinned in Task 4.
4. **Keyboard users** → can reach, move between and toggle pixels without a mouse. Pinned in Task 3.
5. **Existing saved data** → loads with `customImages: []`, and data containing custom images round-trips unchanged. Pinned in Task 1.

---

## File Structure

```
src/domain/images.ts (+ test)      # CustomImage, MAX_CUSTOM_IMAGES, isValidMap, isImageKey, add/update/deleteImage, imageUsers
src/domain/types.ts                # + customImages
src/domain/actions.ts              # cleanImage accepts custom keys
src/storage/persist.ts             # customImages validation + migration
src/state/useAppState.ts           # addImage (returns key), updateImage, deleteImage
src/ui/pixelGrid.ts (+ test)       # grid + history helpers, cellFromPoint
src/ui/images.ts                   # + imageMap
src/ui/PixelEditor.tsx (+ test)
src/ui/TaskFormDialog.tsx
src/ui/TaskForm.tsx, TaskGrid.tsx, TaskCard.tsx, CounterCard.tsx, App.tsx, index.css
```

---

### Task 1: Custom image data, actions and persistence

**Files:**
- Create: `src/domain/images.ts`
- Modify: `src/domain/types.ts`, `src/domain/actions.ts`, `src/storage/persist.ts`, `src/state/useAppState.ts`
- Test: `src/domain/images.test.ts` (new), `src/domain/actions.test.ts`, `src/storage/persist.test.ts`, `src/state/useAppState.test.ts`, plus `customImages: []` in the `state()` helpers of `src/domain/settle.test.ts`, `src/domain/selectors.test.ts` and `src/ui/RankPage.test.tsx`

**Interfaces:**
- Produces (`src/domain/images.ts`): `interface CustomImage { key: string; map: string[] }`, `MAX_CUSTOM_IMAGES = 100`, `CUSTOM_KEY_RE`, `isValidMap(map: unknown): map is string[]`, `isImageKey(state, key): boolean`, `addImage(state, map, key)`, `updateImage(state, key, map)`, `deleteImage(state, key)`, `imageUsers(state, key): string[]`
- Produces: `AppState.customImages: CustomImage[]`; `useAppState()` adds `addImage(map: string[]): string`, `updateImage(key: string, map: string[]): void`, `deleteImage(key: string): void`

- [ ] **Step 1: Add the field to every test helper**

Add `customImages: [],` next to `tasks` in the `state()` helpers of `src/domain/settle.test.ts`, `src/domain/actions.test.ts`, `src/domain/selectors.test.ts` and `src/ui/RankPage.test.tsx`. In `src/storage/persist.test.ts`, add `customImages: [{ key: 'c-0000000a', map: BLOCK }],` to `valid` after `tasks: ...`, and define above `valid`:
```ts
const BLOCK = ['##########', ...Array.from({ length: 9 }, () => '..........')];
```

- [ ] **Step 2: Write the failing tests**

`src/domain/images.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { MAX_CUSTOM_IMAGES, addImage, deleteImage, imageUsers, isImageKey, isValidMap, updateImage } from './images';
import { seedTasks } from './tasks';
import type { AppState } from './types';

const BLOCK = ['##########', ...Array.from({ length: 9 }, () => '..........')];
const DOT = ['#.........', ...Array.from({ length: 9 }, () => '..........')];
const BLANK = Array.from({ length: 10 }, () => '..........');

function state(over: Partial<AppState> = {}): AppState {
  return {
    version: 1, points: 0, lastSettledDate: '2026-10-05', completions: {}, graceWeek: '2026-09-28',
    weekNumber: 1, playerName: 'no_name', rankDays: {}, tasks: seedTasks('2026-09-28'), customImages: [], ...over,
  };
}

describe('isValidMap', () => {
  it('accepts a 10×10 map with at least one filled pixel', () => {
    expect(isValidMap(BLOCK)).toBe(true);
    expect(isValidMap(BLANK)).toBe(false);
    expect(isValidMap(BLOCK.slice(1))).toBe(false);
    expect(isValidMap([...BLOCK.slice(1), '#########x'])).toBe(false);
    expect(isValidMap('##########')).toBe(false);
  });
});

describe('custom image actions', () => {
  it('adds an image and recognises its key', () => {
    const next = addImage(state(), BLOCK, 'c-0000000a');
    expect(next.customImages).toEqual([{ key: 'c-0000000a', map: BLOCK }]);
    expect(isImageKey(next, 'c-0000000a')).toBe(true);
    expect(isImageKey(next, 'book')).toBe(true);
    expect(isImageKey(next, 'c-ffffffff')).toBe(false);
  });

  it('rejects blank maps, bad or duplicate keys, and more than 100 images', () => {
    const s = state();
    expect(addImage(s, BLANK, 'c-0000000a')).toBe(s);
    expect(addImage(s, BLOCK, 'book')).toBe(s);
    const one = addImage(s, BLOCK, 'c-0000000a');
    expect(addImage(one, DOT, 'c-0000000a')).toBe(one);
    const full = state({
      customImages: Array.from({ length: MAX_CUSTOM_IMAGES }, (_, i) => ({ key: `c-${i.toString(16).padStart(8, '0')}`, map: BLOCK })),
    });
    expect(addImage(full, BLOCK, 'c-ffffffff')).toBe(full);
  });

  it('updates an existing image only', () => {
    const one = addImage(state(), BLOCK, 'c-0000000a');
    expect(updateImage(one, 'c-0000000a', DOT).customImages[0].map).toEqual(DOT);
    expect(updateImage(one, 'c-0000000a', BLANK)).toBe(one);
    expect(updateImage(one, 'c-ffffffff', DOT)).toBe(one);
  });

  it('lists users and blocks deleting an image any task uses', () => {
    const one = addImage(state(), BLOCK, 'c-0000000a');
    expect(deleteImage(one, 'c-0000000a').customImages).toEqual([]);

    const used = {
      ...one,
      tasks: one.tasks.map((t) =>
        t.id === 'reading' ? { ...t, image: 'c-0000000a' } :
        t.id === 'coding' ? { ...t, image: 'c-0000000a', retiresAfter: '2026-10-11' } : t),
    };
    expect(imageUsers(used, 'c-0000000a')).toEqual(['Reading', 'Coding']);
    expect(deleteImage(used, 'c-0000000a')).toBe(used);

    const pendingUser = { ...one, tasks: [{ ...one.tasks[0], image: 'c-0000000a', startsOn: '2026-10-12' }] };
    expect(deleteImage(pendingUser, 'c-0000000a')).toBe(pendingUser);
  });
});
```

Append to `src/domain/actions.test.ts` (inside `describe('task management')`):
```ts
  it('accepts custom image keys', () => {
    const s = { ...state(), customImages: [{ key: 'c-0000000a', map: ['##########', ...Array(9).fill('..........')] }] };
    expect(addTask(s, { ...input, image: 'c-0000000a' }, TODAY, 't-1').tasks.at(-1)?.image).toBe('c-0000000a');
    expect(editTask(s, 'reading', { name: 'Reading', description: '', image: 'c-0000000a' }).tasks[0].image).toBe('c-0000000a');
    expect(addTask(s, { ...input, image: 'c-ffffffff' }, TODAY, 't-2').tasks.at(-1)?.image).toBe('book');
  });
```

In `src/storage/persist.test.ts`:
- In the `freshState` expectation, change `rankDays: {}, tasks: [],` to `rankDays: {}, tasks: [], customImages: [],`.
- Add these rows to the `it.each` table after `['retiresAfter not a Sunday', ...]`:
```ts
    ['bad custom image key', JSON.stringify({ ...valid, customImages: [{ key: 'x-1', map: BLOCK }] })],
    ['blank custom image', JSON.stringify({ ...valid, customImages: [{ key: 'c-0000000a', map: Array(10).fill('..........') }] })],
    ['duplicate custom image key', JSON.stringify({ ...valid, customImages: [{ key: 'c-0000000a', map: BLOCK }, { key: 'c-0000000a', map: BLOCK }] })],
    ['too many custom images', JSON.stringify({
      ...valid,
      customImages: Array.from({ length: 101 }, (_, i) => ({ key: `c-${i.toString(16).padStart(8, '0')}`, map: BLOCK })),
    })],
    ['task using an unknown custom image', JSON.stringify({ ...valid, tasks: [{ ...seedTasks('2026-09-28')[0], image: 'c-ffffffff' }] })],
```
- Replace the destructuring line and expectation in the `migrates data saved before ...` test with:
```ts
    const { weekNumber: _w, playerName: _p, rankDays: _r, tasks: _t, customImages: _c, ...old } = { ...valid, graceWeek: '2026-09-21' };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(old));
    expect(load(TODAY)).toEqual({
      ...old, weekNumber: 2, playerName: 'no_name', rankDays: {}, tasks: seedTasks('2026-09-21'), customImages: [],
    });
```
- Append inside `describe('persist')`:
```ts
  it('keeps a task that uses a custom image', () => {
    const withCustom = { ...valid, tasks: [{ ...seedTasks('2026-09-28')[0], image: 'c-0000000a' }], completions: {} };
    save(withCustom);
    expect(load(TODAY)).toEqual(withCustom);
  });
```

Append to `src/state/useAppState.test.ts` (inside `describe('useAppState')`):
```ts
  it('adds, updates and deletes custom images', () => {
    vi.setSystemTime(new Date(2026, 8, 30, 10, 0));
    seed({ version: 1, points: 0, graceWeek: '2026-09-28', weekNumber: 1, playerName: 'no_name', lastSettledDate: '2026-09-29', completions: {} });
    const { result } = renderHook(() => useAppState());
    const map = ['##########', ...Array(9).fill('..........')];
    let key = '';
    act(() => {
      key = result.current.addImage(map);
    });
    expect(key).toMatch(/^c-[0-9a-f]{8}$/);
    expect(result.current.state.customImages).toEqual([{ key, map }]);

    const dot = ['#.........', ...Array(9).fill('..........')];
    act(() => result.current.updateImage(key, dot));
    expect(result.current.state.customImages[0].map).toEqual(dot);

    act(() => result.current.editTask('reading', { name: 'Reading', description: '', image: key }));
    act(() => result.current.deleteImage(key));
    expect(result.current.state.customImages).toHaveLength(1);
    act(() => result.current.editTask('reading', { name: 'Reading', description: '', image: 'book' }));
    act(() => result.current.deleteImage(key));
    expect(result.current.state.customImages).toEqual([]);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).customImages).toEqual([]);
  });
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `./images` (domain) missing; custom keys rejected by actions; persist rows and migration fail; the hook has no `addImage`.

- [ ] **Step 4: Create `src/domain/images.ts`**

```ts
import { IMAGE_KEYS } from './imageKeys';
import type { AppState } from './types';

export interface CustomImage {
  key: string; // 'c-' + 8 hex chars
  map: string[]; // 10 rows of 10 '#'/'.'
}

export const MAX_CUSTOM_IMAGES = 100;
export const CUSTOM_KEY_RE = /^c-[0-9a-f]{8}$/;
const ROW_RE = /^[#.]{10}$/;

export function isValidMap(map: unknown): map is string[] {
  return (
    Array.isArray(map) &&
    map.length === 10 &&
    map.every((row) => typeof row === 'string' && ROW_RE.test(row)) &&
    map.some((row: string) => row.includes('#'))
  );
}

export function isImageKey(state: Pick<AppState, 'customImages'>, key: string): boolean {
  return IMAGE_KEYS.includes(key) || state.customImages.some((image) => image.key === key);
}

export function addImage(state: AppState, map: string[], key: string): AppState {
  if (!isValidMap(map) || !CUSTOM_KEY_RE.test(key) || isImageKey(state, key)) return state;
  if (state.customImages.length >= MAX_CUSTOM_IMAGES) return state;
  return { ...state, customImages: [...state.customImages, { key, map: [...map] }] };
}

// Shared library: every task using the image changes with it.
export function updateImage(state: AppState, key: string, map: string[]): AppState {
  if (!isValidMap(map) || !state.customImages.some((image) => image.key === key)) return state;
  return {
    ...state,
    customImages: state.customImages.map((image) => (image.key === key ? { key, map: [...map] } : image)),
  };
}

export function imageUsers(state: AppState, key: string): string[] {
  return state.tasks.filter((task) => task.image === key).map((task) => task.name);
}

// Blocked while any task (active, pending or retiring) uses it: a task pointing at a
// missing image would make saved data invalid.
export function deleteImage(state: AppState, key: string): AppState {
  if (!state.customImages.some((image) => image.key === key) || imageUsers(state, key).length > 0) return state;
  return { ...state, customImages: state.customImages.filter((image) => image.key !== key) };
}
```

- [ ] **Step 5: Add `customImages` to `src/domain/types.ts`**

Add `import type { CustomImage } from './images';` and, after the `tasks` line:
```ts
  customImages: CustomImage[]; // the player's drawn images, in creation order
```

- [ ] **Step 6: Accept custom keys in `src/domain/actions.ts`**

- Add `import { isImageKey } from './images';`.
- Replace `const cleanImage = (image: string) => (IMAGE_KEYS.includes(image) ? image : IMAGE_KEYS[0]);` with:
```ts
const cleanImage = (state: AppState, image: string) => (isImageKey(state, image) ? image : IMAGE_KEYS[0]);
```
- Change the two call sites to `cleanImage(state, input.image)` and `cleanImage(state, edit.image)`.

- [ ] **Step 7: Validate and migrate in `src/storage/persist.ts`**

- Add `import { CUSTOM_KEY_RE, MAX_CUSTOM_IMAGES, isValidMap } from '../domain/images';`.
- In `freshState`, add `customImages: [],` after `tasks: [],`.
- Change `function isTask(value: unknown): value is TaskDef {` to `function isTask(value: unknown, imageKeys: Set<string>): value is TaskDef {`, and inside it replace `!IMAGES.has(image)` with `!imageKeys.has(image)`.
- Add above `isValidState`:
```ts
// The set of custom image keys, or null if the list is invalid.
function customImageKeys(value: unknown): Set<string> | null {
  if (!Array.isArray(value) || value.length > MAX_CUSTOM_IMAGES) return null;
  const keys = new Set<string>();
  for (const image of value) {
    if (!isPlainObject(image) || typeof image.key !== 'string' || !CUSTOM_KEY_RE.test(image.key)) return null;
    if (keys.has(image.key) || !isValidMap(image.map)) return null;
    keys.add(image.key);
  }
  return keys;
}
```
- In `isValidState`, replace `if (!Array.isArray(value.tasks) || !value.tasks.every(isTask)) return false;` with:
```ts
  const customKeys = customImageKeys(value.customImages);
  if (!customKeys) return false;
  const imageKeys = new Set([...IMAGES, ...customKeys]);
  if (!Array.isArray(value.tasks) || !value.tasks.every((task) => isTask(task, imageKeys))) return false;
```
- In `migrate`, after the `tasks` default line, add `if (migrated.customImages === undefined) migrated.customImages = [];` and update its leading comment to list `/customImages`.

- [ ] **Step 8: Hook functions in `src/state/useAppState.ts`**

- Add `import { addImage, deleteImage, updateImage } from '../domain/images';`.
- Extend `Action` with:
```ts
  | { type: 'addImage'; map: string[]; key: string; today: DateKey }
  | { type: 'updateImage'; key: string; map: string[]; today: DateKey }
  | { type: 'deleteImage'; key: string; today: DateKey }
```
- Add reducer cases:
```ts
    case 'addImage':
      return addImage(settled, action.map, action.key);
    case 'updateImage':
      return updateImage(settled, action.key, action.map);
    case 'deleteImage':
      return deleteImage(settled, action.key);
```
- Replace the `newTaskId` definition (and its two comment lines) with:
```ts
// Ids are generated outside the reducer so StrictMode's double-run sees the same one.
// getRandomValues (unlike randomUUID) also works on plain-HTTP pages, e.g. the dev server opened from a phone.
const randomHex = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, '0')).join('');
const newTaskId = () => `t-${randomHex()}`;
const newImageKey = () => `c-${randomHex()}`;
```
- Before the hook's `return`, add:
```ts
  const addNewImage = useCallback((map: string[]) => {
    const key = newImageKey();
    dispatch({ type: 'addImage', map, key, today: currentKey() });
    return key;
  }, []);
  const updateExistingImage = useCallback(
    (key: string, map: string[]) => dispatch({ type: 'updateImage', key, map, today: currentKey() }),
    [],
  );
  const deleteExistingImage = useCallback((key: string) => dispatch({ type: 'deleteImage', key, today: currentKey() }), []);
```
- Add `addImage: addNewImage, updateImage: updateExistingImage, deleteImage: deleteExistingImage,` to the returned object.

- [ ] **Step 9: Run the tests and typecheck**

Run: `npm test && npx tsc`
Expected: PASS; `tsc` clean.

- [ ] **Step 10: Commit**

```bash
git add src
git commit -m "feat: custom image library data, actions and persistence"
```

---

### Task 2: Grid helpers and custom images on cards

**Files:**
- Create: `src/ui/pixelGrid.ts`
- Modify: `src/ui/images.ts`, `src/ui/TaskCard.tsx`, `src/ui/CounterCard.tsx`, `src/ui/TaskGrid.tsx`
- Test: `src/ui/pixelGrid.test.ts` (new), `src/ui/images.test.ts`, `src/App.test.tsx`

**Interfaces:**
- Consumes: `CustomImage` (Task 1)
- Produces:
  - `src/ui/pixelGrid.ts`: `type Grid = string[]`, `GRID_SIZE = 10`, `HISTORY_LIMIT = 50`, `blankGrid()`, `isFilled(grid, row, col)`, `setCell(grid, row, col, filled)`, `isBlank(grid)`, `sameGrid(a, b)`, `cellFromPoint(rect, x, y): { row; col } | null`, `interface History { past: Grid[]; future: Grid[] }`, `emptyHistory()`, `pushHistory(history, before)`, `undoGrid(history, current)`, `redoGrid(history, current)` (each returns `{ grid; history } | null`)
  - `src/ui/images.ts`: `imageMap(customImages: CustomImage[], key: string): string[]`
  - `CardProps.sprite: string[]` (the resolved map)

- [ ] **Step 1: Write the failing tests**

`src/ui/pixelGrid.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  HISTORY_LIMIT, blankGrid, cellFromPoint, emptyHistory, isBlank, isFilled, pushHistory, redoGrid, sameGrid, setCell, undoGrid,
} from './pixelGrid';

describe('grid cells', () => {
  it('sets and clears cells without mutating', () => {
    const blank = blankGrid();
    const one = setCell(blank, 2, 3, true);
    expect(isFilled(one, 2, 3)).toBe(true);
    expect(one[2]).toBe('...#......');
    expect(isBlank(blank)).toBe(true);
    expect(isBlank(one)).toBe(false);
    expect(setCell(one, 2, 3, true)).toBe(one);
    expect(sameGrid(setCell(one, 2, 3, false), blank)).toBe(true);
  });
});

describe('cellFromPoint', () => {
  const rect = { left: 100, top: 50, width: 200, height: 200 };
  it('maps a point to a cell', () => {
    expect(cellFromPoint(rect, 100, 50)).toEqual({ row: 0, col: 0 });
    expect(cellFromPoint(rect, 299, 249)).toEqual({ row: 9, col: 9 });
    expect(cellFromPoint(rect, 165, 71)).toEqual({ row: 1, col: 3 });
  });
  it('returns null outside the grid or for an empty rect', () => {
    expect(cellFromPoint(rect, 99, 60)).toBeNull();
    expect(cellFromPoint(rect, 300, 60)).toBeNull();
    expect(cellFromPoint({ left: 0, top: 0, width: 0, height: 0 }, 0, 0)).toBeNull();
  });
});

describe('history', () => {
  it('undoes and redoes', () => {
    const a = blankGrid();
    const b = setCell(a, 0, 0, true);
    const h1 = pushHistory(emptyHistory(), a);
    const undone = undoGrid(h1, b)!;
    expect(undone.grid).toBe(a);
    const redone = redoGrid(undone.history, undone.grid)!;
    expect(redone.grid).toBe(b);
    expect(undoGrid(emptyHistory(), a)).toBeNull();
    expect(redoGrid(emptyHistory(), a)).toBeNull();
  });

  it('clears redo on a new step and caps at the limit', () => {
    const a = blankGrid();
    const undone = undoGrid(pushHistory(emptyHistory(), a), setCell(a, 0, 0, true))!;
    expect(pushHistory(undone.history, a).future).toEqual([]);
    let h = emptyHistory();
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) h = pushHistory(h, a);
    expect(h.past).toHaveLength(HISTORY_LIMIT);
  });
});
```

Append to `src/ui/images.test.ts`, and change its import to `import { CHECK, IMAGE_LIBRARY, imageMap } from './images';`:
```ts
describe('imageMap', () => {
  const custom = [{ key: 'c-0000000a', map: ['##########', ...Array(9).fill('..........')] }];
  it('resolves built-in and custom keys, falling back to the book', () => {
    expect(imageMap(custom, 'guitar')).toBe(IMAGE_LIBRARY.guitar);
    expect(imageMap(custom, 'c-0000000a')).toBe(custom[0].map);
    expect(imageMap(custom, 'c-ffffffff')).toBe(IMAGE_LIBRARY.book);
  });
});
```

Append to `src/App.test.tsx` (inside `describe('App')`):
```tsx
  it('shows a custom image on a task card', () => {
    const map = ['##########', ...Array(9).fill('..........')];
    const tasks = seedTasks('2026-09-28').map((t) => (t.id === 'reading' ? { ...t, image: 'c-0000000a' } : t));
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...freshState('2026-09-30'), tasks, customImages: [{ key: 'c-0000000a', map }] }),
    );
    render(<App />);
    const card = screen.getByRole('article', { name: 'Reading' });
    expect(within(card).getByRole('img', { name: 'Reading' }).querySelectorAll('rect')).toHaveLength(10);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ui/pixelGrid.test.ts src/ui/images.test.ts src/App.test.tsx`
Expected: FAIL — `./pixelGrid` missing, `imageMap` missing, the card renders nothing for the custom key.

- [ ] **Step 3: Create `src/ui/pixelGrid.ts`**

```ts
export type Grid = string[];

export const GRID_SIZE = 10;
export const HISTORY_LIMIT = 50;

export function blankGrid(): Grid {
  return Array.from({ length: GRID_SIZE }, () => '.'.repeat(GRID_SIZE));
}

export function isFilled(grid: Grid, row: number, col: number): boolean {
  return grid[row][col] === '#';
}

export function setCell(grid: Grid, row: number, col: number, filled: boolean): Grid {
  if (isFilled(grid, row, col) === filled) return grid;
  const next = [...grid];
  const line = grid[row];
  next[row] = line.slice(0, col) + (filled ? '#' : '.') + line.slice(col + 1);
  return next;
}

export function isBlank(grid: Grid): boolean {
  return grid.every((row) => !row.includes('#'));
}

export function sameGrid(a: Grid, b: Grid): boolean {
  return a.every((row, i) => row === b[i]);
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

// Which cell a pointer is over; used during drags, where touch events keep targeting the first cell.
export function cellFromPoint(rect: Rect, x: number, y: number): { row: number; col: number } | null {
  if (rect.width === 0 || rect.height === 0) return null;
  if (x < rect.left || y < rect.top || x >= rect.left + rect.width || y >= rect.top + rect.height) return null;
  return {
    row: Math.floor(((y - rect.top) / rect.height) * GRID_SIZE),
    col: Math.floor(((x - rect.left) / rect.width) * GRID_SIZE),
  };
}

export interface History {
  past: Grid[];
  future: Grid[];
}

export const emptyHistory = (): History => ({ past: [], future: [] });

// Records `before` as an undo step; a new step discards the redo stack.
export function pushHistory(history: History, before: Grid): History {
  return { past: [...history.past, before].slice(-HISTORY_LIMIT), future: [] };
}

export function undoGrid(history: History, current: Grid): { grid: Grid; history: History } | null {
  if (history.past.length === 0) return null;
  return {
    grid: history.past[history.past.length - 1],
    history: { past: history.past.slice(0, -1), future: [current, ...history.future].slice(0, HISTORY_LIMIT) },
  };
}

export function redoGrid(history: History, current: Grid): { grid: Grid; history: History } | null {
  if (history.future.length === 0) return null;
  const [grid, ...future] = history.future;
  return { grid, history: { past: [...history.past, current].slice(-HISTORY_LIMIT), future } };
}
```

- [ ] **Step 4: Add `imageMap` to `src/ui/images.ts`**

Add at the top `import type { CustomImage } from '../domain/images';` and append:
```ts
export function imageMap(customImages: CustomImage[], key: string): string[] {
  return IMAGE_LIBRARY[key] ?? customImages.find((image) => image.key === key)?.map ?? IMAGE_LIBRARY.book;
}
```

- [ ] **Step 5: Pass resolved sprites to the cards**

`src/ui/TaskCard.tsx`:
- Change `import { CHECK, IMAGE_LIBRARY } from './images';` to `import { CHECK } from './images';`.
- Add `sprite: string[]; // resolved image map` to `CardProps` after `task: TaskDef;`.
- Add `sprite` to `TaskCard`'s destructured props and replace `map={IMAGE_LIBRARY[task.image]}` with `map={sprite}`.

`src/ui/CounterCard.tsx`: remove `import { IMAGE_LIBRARY } from './images';`, add `sprite` to the destructured props, and replace `map={IMAGE_LIBRARY[task.image]}` with `map={sprite}`.

`src/ui/TaskGrid.tsx`: add `import { imageMap } from './images';` and, in `renderCard`'s `props`, add `sprite: imageMap(state.customImages, task.image),` after `task,`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test && npx tsc`
Expected: PASS; `tsc` clean.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "feat: grid helpers and custom images on task cards"
```

---

### Task 3: PixelEditor component

**Files:**
- Create: `src/ui/PixelEditor.tsx`
- Modify: `src/index.css`
- Test: `src/ui/PixelEditor.test.tsx`

**Interfaces:**
- Consumes: everything in `pixelGrid.ts` (Task 2); `PixelSprite`
- Produces: `PixelEditor({ initial?, images, usedBy?, onSave, onCancel, onDelete? })`
  - `images: { key: string; label: string; map: string[] }[]` (the copy-from sources)
  - `usedBy` / `onDelete` present only in edit mode
  - `onSave(map: string[])`

- [ ] **Step 1: Write the failing tests**

`src/ui/PixelEditor.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PixelEditor } from './PixelEditor';

const BOOK = ['..........', '.###..###.', '#...##...#', '#.#.##.#.#', '#...##...#', '#.#.##.#.#', '#...##...#', '####..####', '...####...', '..........'];
const cell = (row: number, col: number) => screen.getByRole('button', { name: new RegExp(`^Pixel row ${row}, column ${col},`) });
const paint = (row: number, col: number) => {
  fireEvent.pointerDown(cell(row, col));
  fireEvent.pointerUp(cell(row, col));
};

function renderEditor(props: Partial<Parameters<typeof PixelEditor>[0]> = {}) {
  const handlers = { onSave: vi.fn(), onCancel: vi.fn() };
  render(<PixelEditor images={[{ key: 'book', label: 'book', map: BOOK }]} {...handlers} {...props} />);
  return handlers;
}

describe('PixelEditor', () => {
  it('paints with a stroke, previews it and saves only when not blank', () => {
    const { onSave } = renderEditor();
    const save = screen.getByRole('button', { name: '[ SAVE IMAGE ]' });
    expect(save).toBeDisabled();
    paint(1, 1);
    expect(cell(1, 1)).toHaveAccessibleName('Pixel row 1, column 1, filled');
    expect(screen.getByRole('img', { name: 'Preview' }).querySelectorAll('rect')).toHaveLength(1);
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledWith(['#.........', ...Array(9).fill('..........')]);
  });

  it('erases when a stroke starts on a filled pixel', () => {
    renderEditor();
    paint(1, 1);
    paint(1, 1);
    expect(cell(1, 1)).toHaveAccessibleName('Pixel row 1, column 1, empty');
  });

  it('paints every cell a drag passes over', () => {
    renderEditor();
    const grid = screen.getByRole('group', { name: 'Pixel grid' });
    grid.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON: () => ({}) });
    fireEvent.pointerDown(cell(1, 1));
    fireEvent.pointerMove(grid, { clientX: 15, clientY: 5 });
    fireEvent.pointerMove(grid, { clientX: 25, clientY: 5 });
    fireEvent.pointerUp(grid);
    expect(cell(1, 2)).toHaveAccessibleName('Pixel row 1, column 2, filled');
    expect(cell(1, 3)).toHaveAccessibleName('Pixel row 1, column 3, filled');
    fireEvent.click(screen.getByRole('button', { name: '[ UNDO ]' }));
    expect(cell(1, 1)).toHaveAccessibleName('Pixel row 1, column 1, empty');
    expect(cell(1, 3)).toHaveAccessibleName('Pixel row 1, column 3, empty');
  });

  it('undoes and redoes with buttons and Ctrl/Cmd+Z', () => {
    renderEditor();
    const undo = screen.getByRole('button', { name: '[ UNDO ]' });
    const redo = screen.getByRole('button', { name: '[ REDO ]' });
    expect(undo).toBeDisabled();
    paint(1, 1);
    paint(2, 2);
    fireEvent.click(undo);
    expect(cell(2, 2)).toHaveAccessibleName(/empty/);
    expect(cell(1, 1)).toHaveAccessibleName(/filled/);
    fireEvent.click(redo);
    expect(cell(2, 2)).toHaveAccessibleName(/filled/);
    fireEvent.keyDown(window, { key: 'z', metaKey: true });
    expect(cell(2, 2)).toHaveAccessibleName(/empty/);
    fireEvent.keyDown(window, { key: 'Z', ctrlKey: true, shiftKey: true });
    expect(cell(2, 2)).toHaveAccessibleName(/filled/);
    expect(redo).toBeDisabled();
  });

  it('clears as one undoable step', () => {
    renderEditor({ initial: BOOK });
    const clear = screen.getByRole('button', { name: '[ CLEAR ]' });
    fireEvent.click(clear);
    expect(screen.getByRole('button', { name: '[ SAVE IMAGE ]' })).toBeDisabled();
    expect(clear).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '[ UNDO ]' }));
    expect(cell(3, 1)).toHaveAccessibleName(/filled/);
  });

  it('copies an existing image into the grid', () => {
    const { onSave } = renderEditor();
    fireEvent.click(screen.getByRole('button', { name: '[ COPY FROM... ]' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy book' }));
    expect(screen.queryByRole('button', { name: 'Copy book' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '[ SAVE IMAGE ]' }));
    expect(onSave).toHaveBeenCalledWith(BOOK);
  });

  it('moves between pixels with arrow keys and toggles with Space or Enter', () => {
    renderEditor();
    const first = cell(1, 1);
    expect(first).toHaveAttribute('tabindex', '0');
    expect(cell(1, 2)).toHaveAttribute('tabindex', '-1');
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(cell(1, 2)).toHaveFocus();
    fireEvent.keyDown(cell(1, 2), { key: 'ArrowDown' });
    expect(cell(2, 2)).toHaveFocus();
    fireEvent.keyDown(cell(2, 2), { key: ' ' });
    expect(cell(2, 2)).toHaveAccessibleName(/filled/);
    fireEvent.keyDown(cell(2, 2), { key: 'Enter' });
    expect(cell(2, 2)).toHaveAccessibleName(/empty/);
    fireEvent.keyDown(cell(2, 2), { key: 'ArrowLeft' });
    fireEvent.keyDown(cell(2, 1), { key: 'ArrowLeft' });
    expect(cell(2, 1)).toHaveFocus();
  });

  it('in edit mode shows users and only allows deleting an unused image', () => {
    const onDelete = vi.fn();
    const { onCancel } = renderEditor({ initial: BOOK, usedBy: ['Coding', 'Reading'], onDelete });
    expect(screen.getByText('USED BY: CODING, READING')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '[ DELETE ]' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '[ CANCEL ]' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('deletes an unused image', () => {
    const onDelete = vi.fn();
    renderEditor({ initial: BOOK, usedBy: [], onDelete });
    expect(screen.getByText('NOT USED BY ANY TASK')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '[ DELETE ]' }));
    expect(onDelete).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/ui/PixelEditor.test.tsx`
Expected: FAIL — cannot resolve `./PixelEditor`.

- [ ] **Step 3: Create `src/ui/PixelEditor.tsx`**

```tsx
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  GRID_SIZE, blankGrid, cellFromPoint, emptyHistory, isBlank, isFilled, pushHistory, redoGrid, sameGrid, setCell, undoGrid,
  type Grid, type History,
} from './pixelGrid';
import { PixelSprite } from './PixelSprite';

interface PixelEditorProps {
  initial?: string[]; // edit mode starts from the image's current map
  images: { key: string; label: string; map: string[] }[]; // "copy from" sources
  usedBy?: string[]; // edit mode only
  onSave: (map: string[]) => void;
  onCancel: () => void;
  onDelete?: () => void; // edit mode only
}

interface Doc {
  grid: Grid;
  history: History;
}

const ARROWS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

function cellOf(target: EventTarget): { row: number; col: number } | null {
  const el = (target as HTMLElement).closest?.('[data-row]') as HTMLElement | null;
  return el ? { row: Number(el.dataset.row), col: Number(el.dataset.col) } : null;
}

export function PixelEditor({ initial, images, usedBy, onSave, onCancel, onDelete }: PixelEditorProps) {
  const [doc, setDoc] = useState<Doc>(() => ({ grid: initial ? [...initial] : blankGrid(), history: emptyHistory() }));
  const [copying, setCopying] = useState(false);
  const [focus, setFocus] = useState({ row: 0, col: 0 });
  const stroke = useRef<{ filled: boolean; before: Grid } | null>(null);
  const cells = useRef<(HTMLButtonElement | null)[]>([]);
  const keyboardMove = useRef(false);

  // All edits go through pure updaters, so StrictMode's double-run can't record a step twice.
  const step = (change: (grid: Grid) => Grid) =>
    setDoc((d) => {
      const next = change(d.grid);
      return sameGrid(next, d.grid) ? d : { grid: next, history: pushHistory(d.history, d.grid) };
    });
  const undo = () => setDoc((d) => undoGrid(d.history, d.grid) ?? d);
  const redo = () => setDoc((d) => redoGrid(d.history, d.grid) ?? d);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!keyboardMove.current) return;
    keyboardMove.current = false;
    cells.current[focus.row * GRID_SIZE + focus.col]?.focus();
  }, [focus]);

  const paintAt = (row: number, col: number, filled: boolean) =>
    setDoc((d) => ({ ...d, grid: setCell(d.grid, row, col, filled) }));

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const cell = cellOf(event.target);
    if (!cell) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const filled = !isFilled(doc.grid, cell.row, cell.col);
    stroke.current = { filled, before: doc.grid };
    setFocus(cell);
    paintAt(cell.row, cell.col, filled);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!stroke.current) return;
    const cell = cellFromPoint(event.currentTarget.getBoundingClientRect(), event.clientX, event.clientY);
    if (cell) paintAt(cell.row, cell.col, stroke.current.filled);
  };

  const endStroke = () => {
    const current = stroke.current;
    if (!current) return;
    stroke.current = null;
    setDoc((d) => (sameGrid(current.before, d.grid) ? d : { ...d, history: pushHistory(d.history, current.before) }));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const move = ARROWS[event.key];
    if (move) {
      event.preventDefault();
      keyboardMove.current = true;
      setFocus((f) => ({
        row: Math.min(GRID_SIZE - 1, Math.max(0, f.row + move[0])),
        col: Math.min(GRID_SIZE - 1, Math.max(0, f.col + move[1])),
      }));
    } else if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      const { row, col } = focus;
      step((grid) => setCell(grid, row, col, !isFilled(grid, row, col)));
    }
  };

  const blank = isBlank(doc.grid);

  return (
    <div className="pixel-editor">
      <div className="editor-main">
        <div
          className="pixel-grid"
          role="group"
          aria-label="Pixel grid"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
          onKeyDown={onKeyDown}
        >
          {doc.grid.flatMap((line, row) =>
            [...line].map((ch, col) => (
              <button
                key={`${row}-${col}`}
                ref={(el) => {
                  cells.current[row * GRID_SIZE + col] = el;
                }}
                type="button"
                className={ch === '#' ? 'pixel filled' : 'pixel'}
                data-row={row}
                data-col={col}
                tabIndex={focus.row === row && focus.col === col ? 0 : -1}
                aria-label={`Pixel row ${row + 1}, column ${col + 1}, ${ch === '#' ? 'filled' : 'empty'}`}
              />
            )),
          )}
        </div>
        <div className="editor-preview">
          <span className="meta">PREVIEW</span>
          <PixelSprite map={doc.grid} title="Preview" size={80} />
        </div>
      </div>

      <div className="editor-tools">
        <button type="button" className="btn" disabled={doc.history.past.length === 0} onClick={undo}>
          [ UNDO ]
        </button>
        <button type="button" className="btn" disabled={doc.history.future.length === 0} onClick={redo}>
          [ REDO ]
        </button>
        <button type="button" className="btn" disabled={blank} onClick={() => step(() => blankGrid())}>
          [ CLEAR ]
        </button>
        <button type="button" className="btn" aria-expanded={copying} onClick={() => setCopying((c) => !c)}>
          [ COPY FROM... ]
        </button>
      </div>

      {copying && (
        <div className="copy-row">
          {images.map((image) => (
            <button
              key={image.key}
              type="button"
              className="btn image-option"
              aria-label={`Copy ${image.label}`}
              onClick={() => {
                step(() => [...image.map]);
                setCopying(false);
              }}
            >
              <PixelSprite map={image.map} size={30} className="option-sprite" />
            </button>
          ))}
        </div>
      )}

      {usedBy && (
        <p className="note">{usedBy.length > 0 ? `USED BY: ${usedBy.join(', ').toUpperCase()}` : 'NOT USED BY ANY TASK'}</p>
      )}

      <div className="form-actions">
        <div className="action-group">
          <button type="button" className="btn" disabled={blank} onClick={() => onSave(doc.grid)}>
            [ SAVE IMAGE ]
          </button>
          <button type="button" className="btn" onClick={onCancel}>
            [ CANCEL ]
          </button>
        </div>
        {onDelete && (
          <button type="button" className="btn" disabled={(usedBy?.length ?? 0) > 0} onClick={onDelete}>
            [ DELETE ]
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add editor styles to `src/index.css`**

Append:
```css
.pixel-editor {
  display: grid;
  gap: 12px;
}

.editor-main {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 16px;
}

.pixel-grid {
  display: grid;
  grid-template-columns: repeat(10, 28px);
  grid-template-rows: repeat(10, 28px);
  width: max-content;
  border: var(--border);
  touch-action: none;
  user-select: none;
}

.pixel {
  width: 28px;
  height: 28px;
  padding: 0;
  background: var(--bg);
  border: 1px solid var(--dim);
  cursor: crosshair;
}

.pixel.filled {
  background: var(--fg);
}

.pixel:focus-visible {
  outline: 2px dashed var(--fg);
  outline-offset: -4px;
}

.pixel.filled:focus-visible {
  outline-color: var(--bg);
}

.editor-preview {
  display: grid;
  justify-items: center;
  gap: 4px;
}

.editor-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.copy-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
  gap: 6px;
  max-height: 160px;
  overflow-y: auto;
}

.action-group {
  display: flex;
  gap: 12px;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/ui/PixelEditor.test.tsx && npx tsc`
Expected: PASS (9 tests); `tsc` clean.

- [ ] **Step 6: Commit**

```bash
git add src/ui/PixelEditor.tsx src/ui/PixelEditor.test.tsx src/index.css
git commit -m "feat: pixel editor with drag painting, undo/redo, clear and copy"
```

---

### Task 4: Editor inside the task form popup

**Files:**
- Create: `src/ui/TaskFormDialog.tsx`
- Modify: `src/ui/TaskForm.tsx`, `src/ui/TaskGrid.tsx`, `src/App.tsx`, `src/index.css`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: `PixelEditor` (Task 3); `imageMap`, `IMAGE_LIBRARY` (Task 2); `CustomImage`, `imageUsers` (Task 1); hook `addImage`/`updateImage`/`deleteImage` (Task 1); `Modal`
- Produces:
  - `TaskForm` props gain `image`, `onImageChange(key)`, `customImages`, `onDraw()`, `onEditImage(key)`; its internal image state is removed
  - `TaskFormDialog({ title, group, today, task?, customImages, usersOf, onSubmit, onRemove?, onUndoRemove?, onAddImage, onUpdateImage, onDeleteImage, onClose })`
  - `TaskGridProps` gains `onAddImage(map): string`, `onUpdateImage(key, map)`, `onDeleteImage(key)`

- [ ] **Step 1: Write the failing tests**

Append to `src/App.test.tsx` (inside `describe('App')`):
```tsx
  it('draws a new image for a new task without losing what was typed', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'ADD DAILY TASK' }));
    let dialog = screen.getByRole('dialog', { name: 'NEW DAILY TASK' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'NAME' }), { target: { value: 'Meditate' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Draw a new image' }));

    dialog = screen.getByRole('dialog', { name: 'NEW IMAGE' });
    expect(within(dialog).queryByRole('textbox', { name: 'NAME' })).not.toBeInTheDocument();
    const pixel = within(dialog).getByRole('button', { name: 'Pixel row 2, column 2, empty' });
    fireEvent.pointerDown(pixel);
    fireEvent.pointerUp(pixel);
    fireEvent.click(within(dialog).getByRole('button', { name: '[ SAVE IMAGE ]' }));

    dialog = screen.getByRole('dialog', { name: 'NEW DAILY TASK' });
    expect(within(dialog).getByRole('textbox', { name: 'NAME' })).toHaveValue('Meditate');
    expect(within(dialog).getByRole('button', { name: 'Custom image 1' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(dialog).getByRole('button', { name: '[ EDIT IMAGE ]' })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: '[ SAVE ]' }));

    const card = screen.getByRole('article', { name: 'Meditate' });
    expect(within(card).getByRole('img', { name: 'Meditate' }).querySelectorAll('rect')).toHaveLength(1);
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.customImages).toHaveLength(1);
    expect(saved.tasks.at(-1).image).toBe(saved.customImages[0].key);
  });

  it('returns from the editor to the form on Escape', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'ADD DAILY TASK' }));
    fireEvent.click(screen.getByRole('button', { name: 'Draw a new image' }));
    expect(screen.getByRole('dialog', { name: 'NEW IMAGE' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: 'NEW DAILY TASK' })).toBeInTheDocument();
  });

  it('edits a custom image a task uses, and blocks deleting it', () => {
    const map = ['##########', ...Array(9).fill('..........')];
    const tasks = seedTasks('2026-09-28').map((t) => (t.id === 'reading' ? { ...t, image: 'c-0000000a' } : t));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...freshState('2026-09-30'), tasks, customImages: [{ key: 'c-0000000a', map }] }));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Reading' }));
    fireEvent.click(screen.getByRole('button', { name: '[ EDIT IMAGE ]' }));
    const dialog = screen.getByRole('dialog', { name: 'EDIT IMAGE' });
    expect(within(dialog).getByText('USED BY: READING')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '[ DELETE ]' })).toBeDisabled();
    const pixel = within(dialog).getByRole('button', { name: 'Pixel row 6, column 6, empty' });
    fireEvent.pointerDown(pixel);
    fireEvent.pointerUp(pixel);
    fireEvent.click(within(dialog).getByRole('button', { name: '[ SAVE IMAGE ]' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'EDIT TASK' })).getByRole('button', { name: '[ SAVE ]' }));
    const card = screen.getByRole('article', { name: 'Reading' });
    expect(within(card).getByRole('img', { name: 'Reading' }).querySelectorAll('rect')).toHaveLength(11);
  });

  it('deletes an unused custom image and falls back to the first built-in image', () => {
    const map = ['##########', ...Array(9).fill('..........')];
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...freshState('2026-09-30'), tasks: seedTasks('2026-09-28'), customImages: [{ key: 'c-0000000a', map }] }),
    );
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'ADD DAILY TASK' }));
    fireEvent.click(screen.getByRole('button', { name: 'Custom image 1' }));
    fireEvent.click(screen.getByRole('button', { name: '[ EDIT IMAGE ]' }));
    const editor = screen.getByRole('dialog', { name: 'EDIT IMAGE' });
    expect(within(editor).getByText('NOT USED BY ANY TASK')).toBeInTheDocument();
    fireEvent.click(within(editor).getByRole('button', { name: '[ DELETE ]' }));

    const form = screen.getByRole('dialog', { name: 'NEW DAILY TASK' });
    expect(within(form).queryByRole('button', { name: 'Custom image 1' })).not.toBeInTheDocument();
    expect(within(form).getByRole('button', { name: 'book' })).toHaveAttribute('aria-pressed', 'true');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).customImages).toEqual([]);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL — no `Draw a new image` / `Custom image 1` / `[ EDIT IMAGE ]` buttons.

- [ ] **Step 3: Update `src/ui/TaskForm.tsx`**

- Replace `import { IMAGE_LIBRARY } from './images';` with `import { IMAGE_LIBRARY } from './images';\nimport type { CustomImage } from '../domain/images';`.
- Add to `TaskFormProps`:
```ts
  image: string; // controlled by TaskFormDialog
  onImageChange: (key: string) => void;
  customImages: CustomImage[];
  onDraw: () => void;
  onEditImage: (key: string) => void;
```
- Add `image, onImageChange, customImages, onDraw, onEditImage` to the destructured props and delete the line `const [image, setImage] = useState(task?.image ?? IMAGE_KEYS[0]);`.
- In the built-in picker buttons, replace `onClick={() => setImage(key)}` with `onClick={() => onImageChange(key)}`.
- Directly after the built-in `IMAGE_KEYS.map(...)` inside `.image-picker`, add:
```tsx
          {customImages.map((custom, i) => (
            <button
              key={custom.key}
              type="button"
              className={custom.key === image ? 'btn image-option selected' : 'btn image-option'}
              aria-label={`Custom image ${i + 1}`}
              aria-pressed={custom.key === image}
              onClick={() => onImageChange(custom.key)}
            >
              <PixelSprite map={custom.map} size={30} className="option-sprite" />
            </button>
          ))}
          <button type="button" className="btn image-option draw-option" aria-label="Draw a new image" onClick={onDraw}>
            + DRAW
          </button>
```
- Directly after the closing `</div>` of `.image-picker` (still inside the fieldset), add:
```tsx
        {customImages.some((custom) => custom.key === image) && (
          <button type="button" className="btn edit-image" onClick={() => onEditImage(image)}>
            [ EDIT IMAGE ]
          </button>
        )}
```

- [ ] **Step 4: Create `src/ui/TaskFormDialog.tsx`**

```tsx
import { useState } from 'react';
import type { DateKey } from '../domain/dates';
import { IMAGE_KEYS } from '../domain/imageKeys';
import type { CustomImage } from '../domain/images';
import type { TaskDef, TaskGroup } from '../domain/tasks';
import { IMAGE_LIBRARY } from './images';
import { Modal } from './Modal';
import { PixelEditor } from './PixelEditor';
import { TaskForm, type TaskFormValues } from './TaskForm';

interface TaskFormDialogProps {
  title: string;
  group: TaskGroup;
  today: DateKey;
  task?: TaskDef;
  customImages: CustomImage[];
  usersOf: (key: string) => string[];
  onSubmit: (values: TaskFormValues) => void;
  onRemove?: () => void;
  onUndoRemove?: () => void;
  onAddImage: (map: string[]) => string;
  onUpdateImage: (key: string, map: string[]) => void;
  onDeleteImage: (key: string) => void;
  onClose: () => void;
}

export function TaskFormDialog({
  title, group, today, task, customImages, usersOf, onSubmit, onRemove, onUndoRemove,
  onAddImage, onUpdateImage, onDeleteImage, onClose,
}: TaskFormDialogProps) {
  const [image, setImage] = useState(task?.image ?? IMAGE_KEYS[0]);
  const [editor, setEditor] = useState<{ key?: string } | null>(null);
  const backToForm = () => setEditor(null);
  const editing = editor?.key ? customImages.find((custom) => custom.key === editor.key) : undefined;
  const sources = [
    ...IMAGE_KEYS.map((key) => ({ key, label: key, map: IMAGE_LIBRARY[key] })),
    ...customImages.map((custom, i) => ({ key: custom.key, label: `custom image ${i + 1}`, map: custom.map })),
  ];

  return (
    <Modal title={editor ? (editor.key ? 'EDIT IMAGE' : 'NEW IMAGE') : title} onClose={editor ? backToForm : onClose}>
      {/* Hidden, not unmounted, so typed values survive a trip to the editor. */}
      <div hidden={editor !== null}>
        <TaskForm
          group={group}
          today={today}
          task={task}
          image={image}
          onImageChange={setImage}
          customImages={customImages}
          onDraw={() => setEditor({})}
          onEditImage={(key) => setEditor({ key })}
          onSubmit={onSubmit}
          onRemove={onRemove}
          onUndoRemove={onUndoRemove}
        />
      </div>
      {editor && (
        <PixelEditor
          key={editor.key ?? 'new'}
          initial={editing?.map}
          images={sources}
          usedBy={editor.key ? usersOf(editor.key) : undefined}
          onSave={(map) => {
            if (editor.key) onUpdateImage(editor.key, map);
            else setImage(onAddImage(map));
            backToForm();
          }}
          onCancel={backToForm}
          onDelete={
            editor.key
              ? () => {
                  onDeleteImage(editor.key!);
                  if (image === editor.key) setImage(IMAGE_KEYS[0]);
                  backToForm();
                }
              : undefined
          }
        />
      )}
    </Modal>
  );
}
```

- [ ] **Step 5: Use `TaskFormDialog` in `src/ui/TaskGrid.tsx`**

- Replace `import { TaskForm } from './TaskForm';` with `import { TaskFormDialog } from './TaskFormDialog';` and add `import { imageUsers } from '../domain/images';`.
- Extend `TaskGridProps` with:
```ts
  onAddImage: (map: string[]) => string;
  onUpdateImage: (key: string, map: string[]) => void;
  onDeleteImage: (key: string) => void;
```
  and destructure them in the component signature.
- Inside `TaskGrid`, before `renderModal`, add:
```tsx
  const imageProps = {
    customImages: state.customImages,
    usersOf: (key: string) => imageUsers(state, key),
    onAddImage,
    onUpdateImage,
    onDeleteImage,
    onClose: close,
  };
```
- Replace the `add` branch's return with:
```tsx
      return (
        <TaskFormDialog
          {...imageProps}
          title={NEW_TITLES[group]}
          group={group}
          today={today}
          onSubmit={(values) => {
            onAddTask({ group, ...values });
            close();
          }}
        />
      );
```
- Replace the final edit `return (...)` with:
```tsx
    return (
      <TaskFormDialog
        {...imageProps}
        title="EDIT TASK"
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
    );
```

- [ ] **Step 6: Pass the image functions from `src/App.tsx`**

Extend the hook destructuring with `addImage, updateImage, deleteImage`, and add to the `TaskGrid` element:
```tsx
        onAddImage={addImage}
        onUpdateImage={updateImage}
        onDeleteImage={deleteImage}
```

- [ ] **Step 7: Add picker styles to `src/index.css`**

Append:
```css
.draw-option {
  font-size: 16px;
  line-height: 1;
  border-style: dashed;
}

.edit-image {
  justify-self: start;
  margin-top: 8px;
}
```

- [ ] **Step 8: Run the full suite and build**

Run: `npm test && npm run build`
Expected: all tests PASS; `tsc` clean; Vite build succeeds.

- [ ] **Step 9: Commit and push**

```bash
git add src
git commit -m "feat: draw and edit custom images from the task form"
git push origin main
```
