import { describe, expect, it } from 'vitest';
import { addTask, complete, editTask, firstStartDay, removeTask, rename, undo, undoRemove } from './actions';
import type { AppState } from './types';
import { seedTasks } from './tasks';

const TODAY = '2026-09-30';

function state(completions: AppState['completions'] = {}): AppState {
  return { version: 1, points: 10, lastSettledDate: '2026-09-29', completions, graceWeek: '2026-09-21', weekNumber: 1, playerName: 'no_name', rankDays: {}, tasks: seedTasks('2026-01-05') };
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

describe('rename', () => {
  it('sets a trimmed player name', () => {
    expect(rename(state(), '  Aragorn ').playerName).toBe('Aragorn');
  });

  it('falls back to no_name when empty', () => {
    expect(rename({ ...state(), playerName: 'Aragorn' }, '   ').playerName).toBe('no_name');
  });

  it('caps the name at 20 characters', () => {
    expect(rename(state(), 'Gandalf the Grey Wanderer').playerName).toBe('Gandalf the Grey Wan');
  });
});

describe('inactive tasks', () => {
  it('ignores taps on unknown and not-yet-started tasks', () => {
    const pending = { ...seedTasks('2026-10-05')[0], id: 't-later' };
    const s = { ...state(), tasks: [...state().tasks, pending] };
    expect(complete(s, 't-later', TODAY)).toBe(s);
    expect(complete(s, 'nope', TODAY)).toBe(s);
    expect(undo(s, 't-later', TODAY)).toBe(s);
  });
});

describe('task management', () => {
  const input = { group: 'weekly' as const, name: '  Guitar  ', description: ' Practise chords. ', image: 'guitar', target: 3 };

  it('starts new tasks next Monday, or today on a Monday', () => {
    expect(firstStartDay('2026-09-30')).toBe('2026-10-05');
    expect(firstStartDay('2026-10-04')).toBe('2026-10-05');
    expect(firstStartDay('2026-10-05')).toBe('2026-10-05');
  });

  it('adds a cleaned-up task for its section', () => {
    const next = addTask(state(), input, TODAY, 't-1');
    expect(next.tasks.at(-1)).toEqual({
      id: 't-1', name: 'Guitar', description: 'Practise chords.', image: 'guitar',
      cadence: { kind: 'weekly', target: 3 }, maxPerDay: 1, startsOn: '2026-10-05', retiresAfter: null,
    });
    expect(addTask(state(), { ...input, group: 'daily' }, TODAY, 't-2').tasks.at(-1)).toMatchObject({
      cadence: { kind: 'daily' }, maxPerDay: 1,
    });
    expect(addTask(state(), { ...input, group: 'weekly-unlimited' }, TODAY, 't-3').tasks.at(-1)).toMatchObject({
      cadence: { kind: 'weekly', target: 3 }, maxPerDay: null,
    });
  });

  it('rejects empty names and duplicate ids, clamps targets and falls back on unknown images', () => {
    const s = state();
    expect(addTask(s, { ...input, name: '   ' }, TODAY, 't-1')).toBe(s);
    expect(addTask(s, input, TODAY, 'reading')).toBe(s);
    expect(addTask(s, { ...input, target: 99 }, TODAY, 't-1').tasks.at(-1)?.cadence).toEqual({ kind: 'weekly', target: 7 });
    expect(addTask(s, { ...input, group: 'weekly-unlimited', target: 99 }, TODAY, 't-1').tasks.at(-1)?.cadence)
      .toEqual({ kind: 'weekly', target: 30 });
    expect(addTask(s, { ...input, target: Number.NaN }, TODAY, 't-1').tasks.at(-1)?.cadence).toEqual({ kind: 'weekly', target: 3 });
    expect(addTask(s, { ...input, image: 'dragon' }, TODAY, 't-1').tasks.at(-1)?.image).toBe('book');
    expect(addTask(s, { ...input, name: 'x'.repeat(30) }, TODAY, 't-1').tasks.at(-1)?.name).toHaveLength(24);
  });

  it('edits only the name, description and image', () => {
    const next = editTask(state(), 'coding', { name: ' Deep work ', description: 'Focus.', image: 'pen' });
    expect(next.tasks.find((t) => t.id === 'coding')).toMatchObject({
      name: 'Deep work', description: 'Focus.', image: 'pen', cadence: { kind: 'weekly', target: 5 },
    });
    const s = state();
    expect(editTask(s, 'coding', { name: '', description: '', image: 'pen' })).toBe(s);
    expect(editTask(s, 'nope', { name: 'X', description: '', image: 'pen' })).toBe(s);
  });

  it('retires a started task at the end of the week and can undo it', () => {
    const removed = removeTask(state(), 'coding', TODAY);
    expect(removed.tasks.find((t) => t.id === 'coding')?.retiresAfter).toBe('2026-10-04');
    expect(undoRemove(removed, 'coding').tasks.find((t) => t.id === 'coding')?.retiresAfter).toBeNull();
  });

  it('deletes a task that has not started yet straight away', () => {
    const added = addTask(state(), input, TODAY, 't-1');
    expect(removeTask(added, 't-1', TODAY).tasks.map((t) => t.id)).not.toContain('t-1');
  });
});
