# Strive — Pixel Editor (Custom Tasks Part 2): Design Spec

Date: 2026-10-06
Status: Approved in brainstorming, pending written-spec review
Extends: `docs/superpowers/specs/2026-10-05-custom-tasks-design.md` and the specs it extends (their rules still apply unless replaced here)

## 1. Purpose

The player can draw their own 10×10 task images. Drawings join a shared custom library that appears in the task form's image picker next to the 24 built-in images. Custom images can be edited (which updates every task using them) and deleted (only while no task uses them).

## 2. Scope

**In scope:** persisted custom images; add, update and delete actions; an editor view inside the task form popup with drag painting, undo/redo, clear and "copy from" an existing image; a live preview; keyboard access.

**Out of scope:** mirror mode, shift arrows, sizes other than 10×10, colours, naming images, reordering the library.

## 3. Data

`AppState` gains `customImages`, still under the `strive:v1` key:

```ts
interface CustomImage {
  key: string;   // 'c-' + 8 hex chars, unique, generated in useAppState
  map: string[]; // 10 rows of 10 '#'/'.' characters, at least one '#'
}
customImages: CustomImage[]; // creation order
```

- `MAX_CUSTOM_IMAGES = 100`.
- **Valid image keys** = `IMAGE_KEYS` (built-in) ∪ `customImages` keys. `addTask`/`editTask` accept either; an unknown key falls back to `IMAGE_KEYS[0]` (book).
- **Picker order:** built-in images, then custom images in creation order, then the `+ DRAW` tile.

## 4. Actions and selectors (pure)

- `isValidMap(map)`: an array of 10 strings matching `/^[#.]{10}$/` with at least one `#`.
- `addImage(state, map, key)`: appends `{ key, map }`. A no-op if the map is invalid, the key already exists, or there are already 100 custom images.
- `updateImage(state, key, map)`: replaces the map. A no-op if the key is unknown or the map is invalid.
- `deleteImage(state, key)`: removes the image. A no-op if any task in `state.tasks` (active, pending or retiring) uses it, or if the key is unknown.
- `imageUsers(state, key): string[]`: names of the tasks using the image, in task order.
- **Hook:** `useAppState` adds `addImage(map): string` (returns the generated key, so the form can select it), `updateImage(key, map)` and `deleteImage(key)`.

## 5. Persistence

- **Fresh state:** `customImages: []`.
- **Migration:** data without `customImages` gets `[]`. This runs before the orphan-completion repair.
- **Validation:** `customImages` must be an array of at most 100 entries, each with a unique key matching `/^c-[0-9a-f]{8}$/` and a valid map. Every task's `image` must be a built-in key or one of those keys. Anything else counts as invalid data (fresh state plus a warning).

## 6. Editor-only state (never persisted)

- **Working grid:** `string[]` (10×10).
- **History:** `{ past: string[][]; future: string[][] }`, each list capped at 50.
- **One undo step:** one stroke (pointer down → moves → up), one `[ CLEAR ]`, one cell toggled from the keyboard, or one "copy from". Applying a step clears `future`. A stroke that changes nothing adds no step.
- Discarded when the editor view closes.

## 7. UI

**Task form changes (`TaskForm`):**
- The image picker shows built-in tiles, then custom tiles (`aria-label` `Custom image N`, numbered by position), then a `+ DRAW` tile (`aria-label` `Draw a new image`).
- When the selected image is custom, an `[ EDIT IMAGE ]` button appears under the picker.
- The selected image becomes a controlled prop (`image`, `onImageChange`), so the dialog can select a newly saved image.

**`TaskFormDialog`** owns the popup for add and edit:
- **State:** `image` (the form selection) and `editor: null | { key?: string }`.
- **Modal title:** the form title (`NEW … TASK` / `EDIT TASK`), or `NEW IMAGE` / `EDIT IMAGE` while the editor is open.
- **While the editor is open:**
  - The form stays mounted but hidden (the `hidden` attribute), so typed values survive.
  - The Modal's close action (Esc, backdrop, `[ X ]`) returns to the form instead of closing the popup.
- **Save image:** a new image is added and selected; an edited image is updated. Then back to the form.
- **Delete:** the image is deleted. If it was selected, the selection falls back to `IMAGE_KEYS[0]`. Then back to the form.
- **Focus:** opening the editor focuses the tabbable pixel. Returning to the form focuses the button that opened the editor, or the selected image tile if that button is gone.
- **Backdrop:** a click outside closes the popup (or returns to the form) only if the press also started outside, so a drag released past the dialog edge keeps the drawing.

**`PixelEditor`** (the editor view):
- **Grid:** a 10×10 grid of pixel buttons (28px cells, dim grid lines, filled cells in the primary colour). `touch-action: none` on the grid.
  - Pointer: pressing a cell starts a stroke whose mode comes from that cell (empty → paint, filled → erase).
  - Moving while pressed applies the mode to the cell under the pointer, found with `cellFromPoint(rect, x, y)` from the grid's bounding box, so touch drags work.
  - Releasing ends the stroke and records one history step.
  - Keyboard: roving tabindex (one pixel is tabbable). Arrow keys move focus; Space/Enter toggle the focused pixel (one step).
  - Each pixel's `aria-label`: `Pixel row R, column C, filled|empty`.
- **Preview:** the current grid at card size (80px), labelled `Preview`.
- **Buttons:**
  - `[ UNDO ]` and `[ REDO ]`: disabled when their stack is empty. Ctrl/Cmd+Z undoes; Shift+Ctrl/Cmd+Z redoes.
  - `[ CLEAR ]`: one step; disabled when the grid is already blank.
  - `[ COPY FROM... ]` toggles a row of small tiles of every built-in and custom image (`aria-label` `Copy <key>` / `Copy custom image N`). Picking one replaces the grid (one step) and hides the row.
- **Edit mode only:**
  - `USED BY: <NAMES>` (uppercase, comma-separated), or `NOT USED BY ANY TASK`.
  - `[ DELETE ]`: disabled while used; enabled otherwise.
- **Footer:** `[ SAVE IMAGE ]` (disabled while the grid is blank) and `[ CANCEL ]`.
- **Starting grid:** a new image starts blank; edit mode starts from the image's current map.

## 8. Code structure

```
src/
  domain/
    images.ts        # CustomImage, MAX_CUSTOM_IMAGES, isValidMap, isImageKey, addImage,
                     # updateImage, deleteImage, imageUsers
    actions.ts       # cleanImage accepts custom keys
    types.ts         # + customImages
  storage/persist.ts # customImages validation/migration; task image must be built-in or custom
  state/useAppState.ts  # + addImage (returns key), updateImage, deleteImage
  ui/
    pixelGrid.ts     # blankGrid, setCell, isBlank, cellFromPoint, history push/undo/redo
    PixelEditor.tsx
    TaskFormDialog.tsx
    TaskForm.tsx     # controlled image, custom tiles, + DRAW, EDIT IMAGE
    TaskGrid.tsx     # uses TaskFormDialog for add/edit
    images.ts        # + imageMap(customImages, key): built-in or custom map (fallback: book)
    TaskCard.tsx, CounterCard.tsx  # render images via imageMap
```

## 9. Testing

- **pixelGrid:** `setCell`, `isBlank`, `cellFromPoint` (inside, edges, outside → null), history push (caps at 50, clears future), undo/redo.
- **images actions:** `isValidMap`; `addImage` rejects blank/malformed maps, duplicate keys and the 101st image; `updateImage`; `deleteImage` blocked by active, pending and retiring users; `imageUsers`.
- **ui/images:** `imageMap` for built-in, custom and unknown (falls back to book) keys.
- **actions:** `addTask`/`editTask` accept custom keys.
- **persist:** migration adds `customImages: []`; invalid entries (bad key, blank map, duplicate key, 101 images) and a task using an unknown custom key → fresh state.
- **hook:** `addImage` returns a `c-` key and persists; update and delete.
- **UI:**
  - `+ DRAW` opens `NEW IMAGE`; clicking pixels paints; undo/redo; clear; copy from; save disabled while blank.
  - Saving returns to the form with the new image selected and the typed name intact; the card shows the custom image after saving the task.
  - Esc in the editor returns to the form.
  - `EDIT IMAGE` shows the used-by list; delete is disabled while in use and works when unused (the selection falls back).
  - Keyboard arrow navigation and Space toggling.
