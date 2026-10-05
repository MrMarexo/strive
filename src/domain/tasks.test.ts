import { describe, expect, it } from 'vitest';
import { TASKS, getTask, taskGroup } from './tasks';

describe('tasks', () => {
  it('defines the eight tasks in display order', () => {
    expect(TASKS.map((t) => t.id)).toEqual([
      'reading', 'coding', 'running', 'sport', 'abstinence', 'logic', 'chores', 'language',
    ]);
  });

  it('sets weekly targets', () => {
    expect(getTask('coding').cadence).toEqual({ kind: 'weekly', target: 5 });
    expect(getTask('sport').cadence).toEqual({ kind: 'weekly', target: 4 });
    expect(getTask('chores').cadence).toEqual({ kind: 'weekly', target: 4 });
  });

  it('makes the remaining tasks daily', () => {
    const daily = TASKS.filter((t) => t.cadence.kind === 'daily').map((t) => t.id);
    expect(daily).toEqual(['reading', 'running', 'abstinence', 'logic', 'language']);
  });

  it('allows only chores more than once per day', () => {
    for (const task of TASKS) {
      expect(task.maxPerDay).toBe(task.id === 'chores' ? null : 1);
    }
  });

  it('groups tasks by daily, weekly and weekly with no day limit', () => {
    expect(TASKS.filter((t) => taskGroup(t) === 'daily').map((t) => t.id)).toEqual([
      'reading', 'running', 'abstinence', 'logic', 'language',
    ]);
    expect(TASKS.filter((t) => taskGroup(t) === 'weekly').map((t) => t.id)).toEqual(['coding', 'sport']);
    expect(TASKS.filter((t) => taskGroup(t) === 'weekly-unlimited').map((t) => t.id)).toEqual(['chores']);
  });
});
