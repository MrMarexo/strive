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
