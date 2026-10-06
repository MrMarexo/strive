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
