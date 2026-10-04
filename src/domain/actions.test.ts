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

describe('settled days', () => {
  it('ignores taps on a day that is already settled', () => {
    const s = state({ '2026-09-29': { chores: 1 } });
    expect(complete(s, 'reading', '2026-09-29')).toBe(s);
    expect(undo(s, 'chores', '2026-09-29')).toBe(s);
  });
});
