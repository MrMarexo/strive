import { describe, expect, it } from 'vitest';
import { daysInRank, isUnlocked, pendingToday, remainingThisWeek, todayCount, weekCount, willMiss } from './selectors';
import { seedTasks } from './tasks';
import type { AppState } from './types';

const getTask = (id: string) => seedTasks('2026-01-05').find((t) => t.id === id)!;

const SAT = '2026-10-03';

function state(completions: AppState['completions'] = {}): AppState {
  return { version: 1, points: 0, lastSettledDate: '2026-10-02', completions, graceWeek: '2026-09-21', weekNumber: 1, playerName: 'no_name', rankDays: {}, tasks: seedTasks('2026-01-05') };
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

describe('willMiss', () => {
  const sport = getTask('sport');

  it('counts today as missed until the session is done', () => {
    expect(willMiss(state(), getTask('coding'), '2026-10-04')).toBe(5);
    expect(willMiss(state({ '2026-10-04': { coding: 1 } }), getTask('coding'), '2026-10-04')).toBe(4);
  });

  it('flags Saturday with 2 left until today is done', () => {
    expect(willMiss(state({ '2026-09-28': { sport: 2 } }), sport, SAT)).toBe(1);
    expect(willMiss(state({ '2026-09-28': { sport: 2 }, [SAT]: { sport: 1 } }), sport, SAT)).toBe(0);
  });

  it('is zero while enough days remain, and for daily tasks and chores', () => {
    expect(willMiss(state(), sport, '2026-09-28')).toBe(0);
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

describe('daysInRank', () => {
  it('adds today only for the current rank', () => {
    const s = { ...state(), points: 80, rankDays: { Beggar: 3, Knight: 2 } };
    expect(daysInRank(s, 'Knight')).toBe(3);
    expect(daysInRank(s, 'Beggar')).toBe(3);
    expect(daysInRank(s, 'Ranger')).toBe(0);
  });
});

describe('isUnlocked', () => {
  it('unlocks every rank up to the current one, and none above it', () => {
    const s = { ...state(), points: 80, rankDays: { Squire: 2 } };
    expect(isUnlocked(state(), 'Beggar')).toBe(true);
    expect(isUnlocked(s, 'Knight')).toBe(true);
    expect(isUnlocked(s, 'Squire')).toBe(true);
    expect(isUnlocked(s, 'Ranger')).toBe(false);
    expect(isUnlocked(s, 'Peasant')).toBe(true);
  });

  it('keeps a rank unlocked after dropping below it', () => {
    expect(isUnlocked({ ...state(), points: 0, rankDays: { Knight: 5 } }, 'Knight')).toBe(true);
  });

  it('unlocks ranks skipped on the way up, even after dropping back down', () => {
    expect(isUnlocked({ ...state(), points: 15, rankDays: { Beggar: 3 } }, 'Peasant')).toBe(true);
    const dropped = { ...state(), points: 0, rankDays: { Beggar: 3, Knight: 2 } };
    expect(isUnlocked(dropped, 'Peasant')).toBe(true);
    expect(isUnlocked(dropped, 'Ranger')).toBe(false);
  });
});

describe('inactive tasks in selectors', () => {
  it('leaves not-yet-started tasks out of pending points and will-miss', () => {
    const later = { ...getTask('coding'), id: 't-later', startsOn: '2026-10-05' };
    const s = { ...state({ [SAT]: { reading: 1 } }), tasks: [getTask('reading'), later] };
    expect(pendingToday(s, SAT)).toBe(1);
    expect(willMiss(s, later, SAT)).toBe(0);
  });
});
