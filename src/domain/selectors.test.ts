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
