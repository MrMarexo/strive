import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { STORAGE_KEY, freshState, load, save } from './persist';
import type { AppState } from '../domain/types';

const TODAY = '2026-09-30';

const valid: AppState = {
  version: 1,
  points: 42,
  lastSettledDate: '2026-09-29',
  completions: { '2026-09-30': { reading: 1, chores: 3 } },
  graceWeek: '2026-09-28',
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
    ['missing graceWeek', JSON.stringify({ ...valid, graceWeek: undefined })],
    ['unknown task id', JSON.stringify({ ...valid, completions: { '2026-09-30': { napping: 1 } } })],
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
});
