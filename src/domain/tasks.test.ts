import { describe, expect, it } from 'vitest';
import { activeTasks, isActive, seedTasks, taskGroup, taskStatus, type TaskDef } from './tasks';

const seeds = seedTasks('2026-09-28');
const byId = (id: string) => seeds.find((t) => t.id === id)!;

describe('seedTasks', () => {
  it('recreates the original eight tasks with their ids', () => {
    expect(seeds.map((t) => t.id)).toEqual([
      'reading', 'coding', 'running', 'sport', 'abstinence', 'logic', 'chores', 'language',
    ]);
    expect(seeds.every((t) => t.startsOn === '2026-09-28' && t.retiresAfter === null)).toBe(true);
  });

  it('keeps targets, day limits, images and descriptions', () => {
    expect(byId('coding')).toMatchObject({ cadence: { kind: 'weekly', target: 5 }, maxPerDay: 1, image: 'laptop' });
    expect(byId('sport')).toMatchObject({ cadence: { kind: 'weekly', target: 4 }, maxPerDay: 1, image: 'dumbbell' });
    expect(byId('chores')).toMatchObject({ cadence: { kind: 'weekly', target: 4 }, maxPerDay: null, image: 'broom' });
    expect(byId('reading')).toMatchObject({ cadence: { kind: 'daily' }, maxPerDay: 1, image: 'book' });
    expect(byId('sport').description).toBe('Working out, swimming, skating or any other sport or physical activity.');
  });
});

describe('taskGroup', () => {
  it('derives the dashboard section', () => {
    expect(seeds.filter((t) => taskGroup(t) === 'daily').map((t) => t.id)).toEqual([
      'reading', 'running', 'abstinence', 'logic', 'language',
    ]);
    expect(seeds.filter((t) => taskGroup(t) === 'weekly').map((t) => t.id)).toEqual(['coding', 'sport']);
    expect(seeds.filter((t) => taskGroup(t) === 'weekly-unlimited').map((t) => t.id)).toEqual(['chores']);
  });
});

describe('isActive / taskStatus', () => {
  const task: TaskDef = { ...byId('reading'), startsOn: '2026-10-05', retiresAfter: '2026-10-11' };

  it('is active from startsOn through retiresAfter', () => {
    expect(isActive(task, '2026-10-04')).toBe(false);
    expect(isActive(task, '2026-10-05')).toBe(true);
    expect(isActive(task, '2026-10-11')).toBe(true);
    expect(isActive(task, '2026-10-12')).toBe(false);
    expect(isActive({ ...task, retiresAfter: null }, '2030-01-01')).toBe(true);
  });

  it('filters active tasks', () => {
    expect(activeTasks([task, byId('coding')], '2026-10-01').map((t) => t.id)).toEqual(['coding']);
  });

  it('reports pending, retiring and active', () => {
    expect(taskStatus(task, '2026-10-01')).toBe('pending');
    expect(taskStatus(task, '2026-10-06')).toBe('retiring');
    expect(taskStatus(byId('coding'), '2026-10-01')).toBe('active');
  });
});
