import { describe, expect, it } from 'vitest';
import { settle } from './settle';
import type { AppState, DayCompletions } from './types';
import { seedTasks, type TaskDef } from './tasks';
import { weekDays } from './dates';

const ALL_DAILY: DayCompletions = { reading: 1, running: 1, abstinence: 1, logic: 1, language: 1 };

function state(over: Partial<AppState> = {}): AppState {
  return { version: 1, points: 100, lastSettledDate: '2026-09-27', completions: {}, graceWeek: '2026-09-21', weekNumber: 1, playerName: 'no_name', rankDays: {}, tasks: seedTasks('2026-01-05'), customImages: [], ...over };
}

describe('settle', () => {
  it('awards +1 per daily task on a perfect day', () => {
    const result = settle(state({ completions: { '2026-09-28': ALL_DAILY } }), '2026-09-29');
    expect(result.points).toBe(105);
    expect(result.lastSettledDate).toBe('2026-09-28');
  });

  it('charges -2 per missed daily task', () => {
    expect(settle(state(), '2026-09-29').points).toBe(90);
  });

  it('never settles today', () => {
    const s = state();
    expect(settle(s, '2026-09-28')).toBe(s);
  });

  it('is a no-op when the clock moves backwards', () => {
    const s = state({ lastSettledDate: '2026-09-30' });
    expect(settle(s, '2026-09-29')).toBe(s);
    expect(settle(s, '2026-09-30')).toBe(s);
  });

  it('caps weekly points at the target', () => {
    const s = state({
      completions: {
        '2026-09-28': { ...ALL_DAILY, chores: 3 },
        '2026-09-29': { ...ALL_DAILY, chores: 3 },
      },
    });
    // Mon: 5 + 3 = 8; Tue: 5 + 1 (only 1 left under target 4) = 6
    expect(settle(s, '2026-09-30').points).toBe(114);
  });

  it('applies -2 per missing weekly session on Sunday and clears the week', () => {
    const completions: AppState['completions'] = {};
    weekDays('2026-09-28').forEach((day, i) => {
      completions[day] = {
        ...ALL_DAILY,
        ...(i < 5 ? { coding: 1 } : {}),
        ...(i === 0 ? { sport: 1 } : {}),
        ...(i === 5 ? { chores: 4 } : {}),
      };
    });
    const result = settle(state({ completions }), '2026-10-05');
    // daily 35 + coding 5 + chores 4 + sport 1 = 45; sport shortfall 3 × 2 = 6
    expect(result.points).toBe(139);
    expect(result.lastSettledDate).toBe('2026-10-04');
    expect(result.completions).toEqual({});
  });

  it('clamps at zero after each day so a bad day does not eat into the next', () => {
    const s = state({ points: 0, completions: { '2026-09-29': ALL_DAILY } });
    // Mon: 0 - 10 -> 0; Tue: +5
    expect(settle(s, '2026-09-30').points).toBe(5);
  });

  it('nets a day before clamping', () => {
    const s = state({ points: 1, completions: { '2026-09-28': { reading: 1, chores: 3 } } });
    // +1 reading +3 chores -8 missed daily = -4 -> 1 - 4 -> 0
    expect(settle(s, '2026-09-29').points).toBe(0);
  });

  it('clamps the Sunday penalty at zero', () => {
    const s = state({ points: 5, lastSettledDate: '2026-10-03', completions: { '2026-10-04': ALL_DAILY } });
    // Sun: 5 + 5 = 10; weekly penalty (5 + 4 + 4) × 2 = 26 -> 0
    expect(settle(s, '2026-10-05').points).toBe(0);
  });

  it('settles a multi-week absence day by day', () => {
    const result = settle(state({ points: 1000 }), '2026-10-12');
    // 14 days × -10 = -140; two Sundays × -26 = -52
    expect(result.points).toBe(808);
    expect(result.lastSettledDate).toBe('2026-10-11');
  });

  it('skips the shortfall penalty in the grace week but still clears it', () => {
    const s = state({ graceWeek: '2026-09-28', lastSettledDate: '2026-10-03', completions: { '2026-10-04': ALL_DAILY } });
    const result = settle(s, '2026-10-05');
    expect(result.points).toBe(105);
    expect(result.completions).toEqual({});
  });

  it('applies the shortfall penalty in the week after the grace week', () => {
    const s = state({ graceWeek: '2026-09-28', points: 100, lastSettledDate: '2026-10-10', completions: { '2026-10-11': ALL_DAILY } });
    // Sun 2026-10-11: +5, then -26
    expect(settle(s, '2026-10-12').points).toBe(79);
  });

  it('keeps completions from the new week when settling Sunday', () => {
    const s = state({ lastSettledDate: '2026-10-03', completions: { '2026-10-05': { reading: 1 } } });
    expect(settle(s, '2026-10-05').completions).toEqual({ '2026-10-05': { reading: 1 } });
  });

  it('is idempotent', () => {
    const s = state({ completions: { '2026-09-28': { ...ALL_DAILY, chores: 6 } } });
    const once = settle(s, '2026-10-01');
    expect(settle(once, '2026-10-01')).toEqual(once);
  });

  it('does not mutate its input', () => {
    const s = state({ lastSettledDate: '2026-10-03', completions: { '2026-10-04': ALL_DAILY } });
    const copy = structuredClone(s);
    settle(s, '2026-10-05');
    expect(s).toEqual(copy);
  });

  it('advances the week number on each settled Sunday, grace week included', () => {
    const s = state({ graceWeek: '2026-09-28', weekNumber: 1, points: 1000 });
    expect(settle(s, '2026-10-04').weekNumber).toBe(1);
    expect(settle(s, '2026-10-05').weekNumber).toBe(2);
    expect(settle(s, '2026-10-12').weekNumber).toBe(3);
  });

  it('credits each day to the rank held during it, across a promotion and a demotion', () => {
    const s = state({ points: 3, completions: { '2026-09-28': ALL_DAILY } });
    // Mon: held Beggar (3), +5 -> 8 Peasant; Tue: held Peasant, -10 -> 0
    expect(settle(s, '2026-09-30').rankDays).toEqual({ Beggar: 1, Peasant: 1 });
  });

  it('credits every day of a gap and adds to existing days', () => {
    expect(settle(state({ points: 0 }), '2026-10-05').rankDays).toEqual({ Beggar: 7 });
    expect(settle(state({ points: 0, rankDays: { Beggar: 4 } }), '2026-09-29').rankDays).toEqual({ Beggar: 5 });
  });

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
});
