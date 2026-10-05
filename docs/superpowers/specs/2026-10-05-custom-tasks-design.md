# Strive — Custom Tasks (Part 1 of 2): Design Spec

Date: 2026-10-05
Status: Approved in brainstorming, pending written-spec review
Extends: `docs/superpowers/specs/2026-10-04-strive-tracker-design.md` and `docs/superpowers/specs/2026-10-05-rank-page-design.md` (their rules still apply unless replaced here)
Part 2 (separate spec, later): a pixel-art editor whose images join the image library defined here.

## 1. Purpose

Tasks are the player's own choice, not part of the game. The player can add, edit and remove tasks from the dashboard. Each task has an image (picked from a built-in library) and a description shown in a popup.

## 2. Scope

**In scope:** tasks stored as data; add (inline "add" card per section), cosmetic edit, remove with end-of-week retirement and undo; a 24-icon image library; a description popup per card; migration of the current 8 tasks; a reusable modal.

**Out of scope:** the pixel editor (Part 2); changing a task's type or target after creation; reordering tasks; task history or statistics.

## 3. Data

`AppState` gains `tasks: TaskDef[]` (display order = array order), still under the `strive:v1` key. The hard-coded `TASKS` list and the `TaskId` union are removed; task ids are strings.

```ts
interface TaskDef {
  id: string;                    // unique; generated as 't-' + 8 random hex chars
  name: string;                  // 1–24 chars, trimmed
  description: string;           // 0–300 chars, trimmed
  image: string;                 // key in IMAGE_LIBRARY
  cadence: { kind: 'daily' } | { kind: 'weekly'; target: number };
  maxPerDay: 1 | null;           // daily tasks: 1; weekly: 1 or null (no day limit)
  startsOn: DateKey;             // first day the task is scored
  retiresAfter: DateKey | null;  // last day scored (a Sunday), set on removal
}
```

- **Types (from the section):** `daily` = `{kind:'daily'}`, `maxPerDay: 1`; `weekly` = `{kind:'weekly', target 1–7}`, `maxPerDay: 1`; `weekly-unlimited` = `{kind:'weekly', target 1–30}`, `maxPerDay: null`.
- **Active:** `isActive(task, day)` = `task.startsOn <= day && (task.retiresAfter === null || day <= task.retiresAfter)`.

## 4. Rules

- **Scoring:** settlement, pending points, `willMiss`, `remainingThisWeek` and the Sunday shortfall penalty consider only tasks active on the day in question. The scoring values are unchanged.
- **Taps:** `complete` and `undo` are no-ops for a task that isn't active today (in addition to the existing locked-day rule).
- **Add:** `addTask(state, input, today, id)`, where `input = { group, name, description, image, target? }`. `startsOn` = today if today is Monday, otherwise next Monday. The task is appended to `tasks`.
- **Edit:** `editTask(state, id, { name, description, image })`. Type, target and dates never change.
- **Remove:** `removeTask(state, id, today)`:
  - Not started (`startsOn > today`): deleted from `tasks` immediately.
  - Started: `retiresAfter` = the Sunday of today's week. The task stays active and fully scored through that Sunday, Sunday penalty included.
- **Undo remove:** `undoRemove(state, id)` sets `retiresAfter` back to `null`. It is available until that Sunday is settled.
- **Retirement:** when settlement finishes a Sunday (after its penalty), every task with `retiresAfter` equal to that Sunday is deleted from `tasks`. That week's completions are cleared as before.
- **Validation of inputs:** names are trimmed, and an empty name is rejected (the action returns the state unchanged). Descriptions are trimmed and cut to 300 chars. Targets outside the allowed range are clamped to it. An unknown image key falls back to the first library image.

## 5. Persistence

- **Fresh state:** `tasks: []`.
- **Migration** (stored data without `tasks`): seed the 8 current tasks with their existing ids (so this week's completions stay attached), `startsOn` = `graceWeek`, `retiresAfter: null`, and these images and descriptions:

| id | name | type / target | image | description |
|---|---|---|---|---|
| reading | Reading | daily | book | Read every day. |
| coding | Coding | weekly 5 | laptop | Write code – five sessions a week. |
| running | Running | daily | shoe | Go for a run every day. |
| sport | Sport & Exercise | weekly 4 | dumbbell | Working out, swimming, skating or any other sport or physical activity. |
| abstinence | Abstinence | daily | shield | Abstain from pornography. |
| logic | Logic Workout | daily | knight | A game of chess, online Catan or a strategy board game with friends. |
| chores | House Chores | weekly-unlimited 4 | broom | Any household chore – can be logged more than once a day. |
| language | Language Learning | daily | speech | Practise a foreign language every day. |

- **Validation:** `tasks` must be an array of valid `TaskDef`s (all field rules in §3, a known image key, valid date keys, a Sunday `retiresAfter` or `null`) with unique ids. Every completion key must be the id of a task in `tasks`. Anything else counts as invalid data (fresh state plus a warning, as before).

## 6. Image library

`IMAGE_LIBRARY: Record<string, string[]>`: 24 maps of 10×10 `#`/`.`, single colour, same style as today's sprites. Keys, in picker order:

`book`, `laptop`, `shoe`, `dumbbell`, `shield`, `knight`, `broom`, `speech` (the existing 8), then `music`, `brush`, `water`, `moon`, `apple`, `lotus`, `pen`, `coin`, `heart`, `plant`, `sun`, `tooth`, `guitar`, `camera`, `no-phone`, `mountain`.

Each new icon is a plain 10×10 silhouette of its name (`no-phone` = a phone with a diagonal slash, `lotus` = a meditation lotus flower).

## 7. UI

Same visual language throughout (black, `#B48CFF` / `#5A3F8C`, VT323, 2px borders, ASCII-only glyphs).

**Modal (shared):** generalised from the current info popup: a backdrop, a box with a title and a `[ X ]` close button, and arbitrary content. Esc, a click outside, or `[ X ]` closes it. Focus moves to `[ X ]` on open and returns to the opening button on close. `role="dialog"`, `aria-modal`, labelled by its title. The section `[?]` popups use it too.

**Task card:**
- Top-left `[?]` (label `About <name>`): opens a modal titled with the task name, showing the description or `No description yet.`
- Top-right `[...]` (label `Edit <name>`): opens the edit modal.
- **Not started:** card dimmed (dim colour for sprite, text and border); the done/counter controls are replaced by `STARTS MON`; `[?]` and `[...]` still work.
- **Retiring:** the subtitle adds ` · RETIRES SUNDAY` (shown as `RETIRES SUNDAY` alone on daily cards, which have no subtitle).

**Add card:** the last item in each section's grid. A dashed-border card with a large `+` and `ADD DAILY TASK` / `ADD WEEKLY TASK` / `ADD NO-LIMIT TASK` opens the add modal for that section's type. Sections with no tasks still show their heading, `[?]` and this card.

**Task form (add and edit modals):**
- Title: `NEW DAILY TASK` / `NEW WEEKLY TASK` / `NEW NO-LIMIT TASK`, or `EDIT TASK`.
- `NAME`: text input, maxLength 24, required. `[ SAVE ]` is disabled while the trimmed name is empty.
- `TARGET` (weekly types only): number input with min 1, max 7 or 30, default 3, followed by `PER WEEK`. On edit it is shown read-only as text.
- `IMAGE`: a grid of all library icons as buttons (`aria-label` = key, `aria-pressed` for the selected one; selected = inverted). Default: the first icon.
- `DESCRIPTION`: textarea, maxLength 300.
- Add only: a note `STARTS TODAY` (Monday) or `STARTS NEXT MONDAY`.
- Edit only: `[ REMOVE ]`. The first click changes it to `[ CONFIRM REMOVE ]` with a note: `STAYS UNTIL SUNDAY NIGHT AND IS SCORED AS USUAL` (started) or `REMOVED NOW` (not started). The second click removes the task and closes the modal. For a retiring task the button is `[ UNDO REMOVE ]` instead, which applies immediately and closes the modal.
- `[ SAVE ]` applies the action and closes the modal.

## 8. Code structure

```
src/
  domain/
    tasks.ts        # TaskDef, TaskGroup, taskGroup, isActive, groupCadence, SEED_TASKS (migration)
    actions.ts      # + addTask, editTask, removeTask, undoRemove; complete/undo check isActive
    settle.ts       # active tasks only; delete retired tasks after their Sunday
    counts.ts, selectors.ts   # take TaskDef from state; active-only
    types.ts        # + tasks
  storage/persist.ts          # tasks validation, migration seed, completions keyed by known ids
  state/useAppState.ts        # + addTask/editTask/removeTask/undoRemove (id generated here)
  ui/
    images.ts       # IMAGE_LIBRARY (replaces sprites.ts; CHECK moves here)
    Modal.tsx       # replaces InfoDialog.tsx
    TaskForm.tsx    # add/edit form
    AddCard.tsx
    TaskCard.tsx, CounterCard.tsx, TaskGrid.tsx   # [?], [...], STARTS MON, RETIRES SUNDAY, add cards
```

## 9. Testing

- **tasks:** `isActive` boundaries; `taskGroup`; `SEED_TASKS` matches §5.
- **actions:** `addTask` start date (Monday vs. other days), group → cadence/maxPerDay, trimming, empty-name rejection, target clamping, unknown image fallback; `editTask` cosmetic fields only; `removeTask` immediate delete vs. retire; `undoRemove`; `complete`/`undo` ignore inactive tasks.
- **settle:** inactive tasks are not scored or penalised; a task starting Monday is scored from Monday; a retiring task is penalised on its Sunday and deleted afterwards; undo before Sunday keeps it.
- **selectors:** `pendingToday` / `willMiss` / `remainingThisWeek` ignore inactive tasks.
- **persist:** migration seeds the 8 tasks with ids, images and descriptions, keeping this week's completions; invalid tasks (duplicate id, empty name, bad target, unknown image, non-Sunday `retiresAfter`) and completions for unknown ids → fresh state.
- **images:** 24 entries, each 10×10.
- **UI:** card `[?]` description popup (with the empty-description fallback); add card per section → form → new card shown as `STARTS MON`; Save disabled for an empty name; target limits; image selection; edit saves cosmetic changes; two-step remove (immediate for not started, `RETIRES SUNDAY` for started); undo remove; Modal Esc/backdrop/close/focus.
