import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { STORAGE_KEY, freshState, load, loadStored, save } from './persist';
import type { AppState } from '../domain/types';
import { seedTasks } from '../domain/tasks';

const TODAY = '2026-09-30';

const valid: AppState = {
  version: 1,
  points: 42,
  lastSettledDate: '2026-09-29',
  completions: { '2026-09-30': { reading: 1, chores: 3 } },
  graceWeek: '2026-09-28',
  weekNumber: 1,
  playerName: 'Aragorn',
  rankDays: { Beggar: 2 },
  tasks: seedTasks('2026-09-28'),
};

describe('persist', () => {
  let warn: MockInstance<typeof console.warn>;

  beforeEach(() => {
    localStorage.clear();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it('creates a fresh state whose first scored day is today', () => {
    expect(freshState(TODAY)).toEqual({
      version: 1, points: 0, lastSettledDate: '2026-09-29', completions: {}, graceWeek: '2026-09-28',
      weekNumber: 1, playerName: 'no_name', rankDays: {}, tasks: [],
    });
  });

  it('returns a fresh state when nothing is stored', () => {
    expect(load(TODAY)).toEqual(freshState(TODAY));
    expect(warn).not.toHaveBeenCalled();
  });

  it('round-trips a saved state', () => {
    save(valid);
    expect(load(TODAY)).toEqual(valid);
  });

  it.each([
    ['invalid JSON', '{not json'],
    ['wrong version', JSON.stringify({ ...valid, version: 2 })],
    ['negative points', JSON.stringify({ ...valid, points: -3 })],
    ['string points', JSON.stringify({ ...valid, points: '42' })],
    ['bad date key', JSON.stringify({ ...valid, lastSettledDate: 'yesterday' })],
    ['empty player name', JSON.stringify({ ...valid, playerName: '' })],
    ['too long player name', JSON.stringify({ ...valid, playerName: 'x'.repeat(21) })],
    ['zero week number', JSON.stringify({ ...valid, weekNumber: 0 })],
    ['string week number', JSON.stringify({ ...valid, weekNumber: '1' })],
    ['unknown rank title', JSON.stringify({ ...valid, rankDays: { Emperor: 1 } })],
    ['negative rank days', JSON.stringify({ ...valid, rankDays: { Beggar: -1 } })],
    ['fractional rank days', JSON.stringify({ ...valid, rankDays: { Beggar: 0.5 } })],
    ['array rank days', JSON.stringify({ ...valid, rankDays: [] })],
    ['duplicate task id', JSON.stringify({ ...valid, tasks: [...seedTasks('2026-09-28'), seedTasks('2026-09-28')[0]] })],
    ['empty task name', JSON.stringify({ ...valid, tasks: [{ ...seedTasks('2026-09-28')[0], name: '' }] })],
    ['task target too high', JSON.stringify({ ...valid, tasks: [{ ...seedTasks('2026-09-28')[1], cadence: { kind: 'weekly', target: 8 } }] })],
    ['unknown task image', JSON.stringify({ ...valid, tasks: [{ ...seedTasks('2026-09-28')[0], image: 'dragon' }] })],
    ['retiresAfter not a Sunday', JSON.stringify({ ...valid, tasks: [{ ...seedTasks('2026-09-28')[0], retiresAfter: '2026-10-03' }] })],
    ['impossible calendar date', JSON.stringify({ ...valid, lastSettledDate: '2026-13-45' })],
    ['missing graceWeek', JSON.stringify({ ...valid, graceWeek: undefined })],
    ['fractional count', JSON.stringify({ ...valid, completions: { '2026-09-30': { reading: 0.5 } } })],
    ['array completions', JSON.stringify({ ...valid, completions: [] })],
  ])('falls back to a fresh state on %s', (_label, raw) => {
    localStorage.setItem(STORAGE_KEY, raw);
    expect(load(TODAY)).toEqual(freshState(TODAY));
    expect(warn).toHaveBeenCalled();
  });

  it('survives a browser that blocks access to localStorage itself', () => {
    const blocked = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(load(TODAY)).toEqual(freshState(TODAY));
    expect(() => save(valid)).not.toThrow();
    expect(blocked).toHaveBeenCalled();
  });

  it('survives storage that throws on read', () => {
    const broken = { getItem: () => { throw new Error('denied'); } } as unknown as Storage;
    expect(load(TODAY, broken)).toEqual(freshState(TODAY));
  });

  it('survives storage that throws on write', () => {
    const broken = { setItem: () => { throw new Error('quota'); } } as unknown as Storage;
    expect(() => save(valid, broken)).not.toThrow();
    expect(warn).toHaveBeenCalled();
  });
  it('repairs a lastSettledDate far in the future, keeping points and current completions', () => {
    save({
      ...valid,
      lastSettledDate: '2027-10-01',
      completions: { '2026-09-30': { reading: 1 }, '2027-10-01': { reading: 1 } },
    });
    expect(load(TODAY)).toEqual({ ...valid, lastSettledDate: '2026-09-29', completions: { '2026-09-30': { reading: 1 } } });
    expect(warn).toHaveBeenCalled();
  });

  it('leaves a lastSettledDate a few days ahead alone', () => {
    const drifted = { ...valid, lastSettledDate: '2026-10-02' };
    save(drifted);
    expect(load(TODAY)).toEqual(drifted);
  });
  it('migrates data saved before names and week numbers existed', () => {
    const { weekNumber: _w, playerName: _p, rankDays: _r, tasks: _t, ...old } = { ...valid, graceWeek: '2026-09-21' };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(old));
    expect(load(TODAY)).toEqual({
      ...old, weekNumber: 2, playerName: 'no_name', rankDays: {}, tasks: seedTasks('2026-09-21'),
    });
  });

  it('drops taps on unknown tasks instead of resetting everything', () => {
    save({ ...valid, completions: { '2026-09-30': { reading: 1, napping: 2 }, '2026-09-29': { napping: 1 } } });
    expect(load(TODAY)).toEqual({ ...valid, completions: { '2026-09-30': { reading: 1 }, '2026-09-29': {} } });
    expect(warn).toHaveBeenCalled();
  });

  it('tells stored data apart from missing or invalid data', () => {
    expect(loadStored(TODAY)).toBeNull();
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(loadStored(TODAY)).toBeNull();
    save(valid);
    expect(loadStored(TODAY)).toEqual(valid);
  });
});
