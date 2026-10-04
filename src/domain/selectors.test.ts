import { describe, expect, it } from 'vitest';
import { isAtRisk, pendingToday, remainingThisWeek, todayCount, weekCount, willMiss } from './selectors';
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

  it('flags Saturday with 2 left and not done today (both days needed)', () => {
    expect(isAtRisk(state({ '2026-09-28': { sport: 2 } }), sport, SAT)).toBe(true);
  });

  it('does not flag Saturday with 1 left', () => {
    expect(isAtRisk(state({ '2026-09-28': { sport: 3 } }), sport, SAT)).toBe(false);
  });

  it('does not flag a target that is already out of reach', () => {
    expect(isAtRisk(state({ '2026-09-28': { sport: 1 } }), sport, SAT)).toBe(false);
  });

  it('never flags daily tasks or chores', () => {
    expect(isAtRisk(state(), getTask('reading'), SAT)).toBe(false);
    expect(isAtRisk(state(), getTask('chores'), '2026-10-04')).toBe(false);
  });
});

describe('willMiss', () => {
  const sport = getTask('sport');

  it('counts sessions that can no longer fit in the week', () => {
    expect(willMiss(state({ '2026-09-28': { sport: 1 } }), sport, SAT)).toBe(1);
    expect(willMiss(state({ '2026-09-28': { sport: 1 }, [SAT]: { sport: 1 } }), sport, SAT)).toBe(1);
    expect(willMiss(state(), getTask('coding'), '2026-10-04')).toBe(4);
  });

  it('is zero while the target is reachable, and for daily tasks and chores', () => {
    expect(willMiss(state({ '2026-09-28': { sport: 2 } }), sport, SAT)).toBe(0);
    expect(willMiss(state(), getTask('reading'), SAT)).toBe(0);
    expect(willMiss(state(), getTask('chores'), '2026-10-04')).toBe(0);
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
