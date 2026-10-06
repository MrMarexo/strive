import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppState } from './useAppState';
import { STORAGE_KEY } from '../storage/persist';

function seed(state: object) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

describe('useAppState', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => vi.useRealTimers());

  it('records completions for today and saves them', () => {
    seed({ version: 1, points: 0, graceWeek: '2026-09-28', weekNumber: 1, playerName: 'no_name', lastSettledDate: '2026-09-29', completions: {} });
    vi.setSystemTime(new Date(2026, 8, 30, 10, 0));
    const { result } = renderHook(() => useAppState());
    expect(result.current.today).toBe('2026-09-30');
    expect(result.current.state.points).toBe(0);

    act(() => result.current.complete('reading'));
    expect(result.current.state.completions['2026-09-30']).toEqual({ reading: 1 });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).completions['2026-09-30']).toEqual({ reading: 1 });

    act(() => result.current.undo('reading'));
    expect(result.current.state.completions['2026-09-30']).toEqual({ reading: 0 });
  });

  it('settles days missed while the app was closed', () => {
    seed({ version: 1, points: 50, graceWeek: '2026-09-21', weekNumber: 2, playerName: 'no_name', lastSettledDate: '2026-09-28', completions: { '2026-09-29': { reading: 1 } } });
    vi.setSystemTime(new Date(2026, 8, 30, 10, 0));
    const { result } = renderHook(() => useAppState());
    // Tue: +1 reading, -8 for four missed daily tasks
    expect(result.current.state.points).toBe(43);
    expect(result.current.state.lastSettledDate).toBe('2026-09-29');
  });

  it('settles at midnight while the app stays open', () => {
    seed({ version: 1, points: 50, graceWeek: '2026-09-21', weekNumber: 2, playerName: 'no_name', lastSettledDate: '2026-09-28', completions: {} });
    vi.setSystemTime(new Date(2026, 8, 29, 23, 59, 30));
    const { result } = renderHook(() => useAppState());
    act(() => result.current.complete('reading'));

    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current.state.points).toBe(43);
    expect(result.current.state.lastSettledDate).toBe('2026-09-29');
  });

  it('counts a tap after midnight for the new day even before the timer fires', () => {
    seed({ version: 1, points: 50, graceWeek: '2026-09-21', weekNumber: 2, playerName: 'no_name', lastSettledDate: '2026-09-28', completions: {} });
    vi.setSystemTime(new Date(2026, 8, 29, 23, 59, 50));
    const { result } = renderHook(() => useAppState());

    vi.setSystemTime(new Date(2026, 8, 30, 0, 0, 10));
    act(() => result.current.complete('reading'));
    expect(result.current.state.lastSettledDate).toBe('2026-09-29');
    expect(result.current.state.points).toBe(40);
    expect(result.current.state.completions['2026-09-30']).toEqual({ reading: 1 });
  });

  it('settles when the window regains focus', () => {
    seed({ version: 1, points: 50, graceWeek: '2026-09-21', weekNumber: 2, playerName: 'no_name', lastSettledDate: '2026-09-28', completions: {} });
    vi.setSystemTime(new Date(2026, 8, 29, 23, 59, 50));
    const { result } = renderHook(() => useAppState());

    vi.setSystemTime(new Date(2026, 8, 30, 8, 0));
    act(() => { window.dispatchEvent(new Event('focus')); });
    expect(result.current.state.lastSettledDate).toBe('2026-09-29');
  });
  it('picks up progress saved by another tab', () => {
    vi.setSystemTime(new Date(2026, 8, 30, 10, 0));
    const { result } = renderHook(() => useAppState());

    seed({ version: 1, points: 7, graceWeek: '2026-09-28', weekNumber: 1, playerName: 'no_name', lastSettledDate: '2026-09-29', completions: { '2026-09-30': { reading: 1 } } });
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY })); });
    expect(result.current.state.points).toBe(7);
    expect(result.current.state.completions['2026-09-30']).toEqual({ reading: 1 });

    act(() => result.current.complete('running'));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).completions['2026-09-30']).toEqual({ reading: 1, running: 1 });
  });
  it('settles right at midnight instead of up to a minute later', () => {
    seed({ version: 1, points: 50, graceWeek: '2026-09-21', weekNumber: 2, playerName: 'no_name', lastSettledDate: '2026-09-28', completions: {} });
    vi.setSystemTime(new Date(2026, 8, 29, 23, 59, 58));
    const { result } = renderHook(() => useAppState());

    act(() => vi.advanceTimersByTime(3_000));
    expect(result.current.today).toBe('2026-09-30');
    expect(result.current.state.lastSettledDate).toBe('2026-09-29');
  });
  it('renames the player and saves it', () => {
    vi.setSystemTime(new Date(2026, 8, 30, 10, 0));
    const { result } = renderHook(() => useAppState());
    act(() => result.current.rename('Aragorn'));
    expect(result.current.state.playerName).toBe('Aragorn');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).playerName).toBe('Aragorn');
  });

  it('adds, edits, removes and restores tasks with generated ids', () => {
    vi.setSystemTime(new Date(2026, 8, 30, 10, 0));
    seed({ version: 1, points: 0, graceWeek: '2026-09-28', weekNumber: 1, playerName: 'no_name', lastSettledDate: '2026-09-29', completions: {} });
    const { result } = renderHook(() => useAppState());

    act(() => result.current.addTask({ group: 'daily', name: 'Meditate', description: '', image: 'lotus' }));
    act(() => result.current.addTask({ group: 'daily', name: 'Meditate', description: '', image: 'lotus' }));
    const added = result.current.state.tasks.slice(-2);
    expect(added[0].id).toMatch(/^t-[0-9a-f]{8}$/);
    expect(added[0].id).not.toBe(added[1].id);

    act(() => result.current.editTask('reading', { name: 'Books', description: 'Read.', image: 'book' }));
    act(() => result.current.removeTask('coding'));
    expect(result.current.state.tasks.find((t) => t.id === 'reading')?.name).toBe('Books');
    expect(result.current.state.tasks.find((t) => t.id === 'coding')?.retiresAfter).toBe('2026-10-04');

    act(() => result.current.undoRemove('coding'));
    expect(result.current.state.tasks.find((t) => t.id === 'coding')?.retiresAfter).toBeNull();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).tasks).toHaveLength(10);
  });

  it('ignores invalid data written by another tab', () => {
    seed({ version: 1, points: 50, graceWeek: '2026-09-21', weekNumber: 2, playerName: 'no_name', lastSettledDate: '2026-09-29', completions: {} });
    vi.setSystemTime(new Date(2026, 8, 30, 10, 0));
    const { result } = renderHook(() => useAppState());
    localStorage.setItem(STORAGE_KEY, '{"version": 99}');
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY })); });
    expect(result.current.state.points).toBe(50);
    expect(result.current.state.tasks).toHaveLength(8);
  });

  it('creates task ids without crypto.randomUUID (plain-HTTP pages)', () => {
    const original = crypto.randomUUID;
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
    try {
      vi.setSystemTime(new Date(2026, 8, 30, 10, 0));
      const { result } = renderHook(() => useAppState());
      act(() => result.current.addTask({ group: 'daily', name: 'Meditate', description: '', image: 'lotus' }));
      expect(result.current.state.tasks.at(-1)?.id).toMatch(/^t-[0-9a-f]{8}$/);
    } finally {
      Object.defineProperty(crypto, 'randomUUID', { value: original, configurable: true });
    }
  });

  it('adds, updates and deletes custom images', () => {
    vi.setSystemTime(new Date(2026, 8, 30, 10, 0));
    seed({ version: 1, points: 0, graceWeek: '2026-09-28', weekNumber: 1, playerName: 'no_name', lastSettledDate: '2026-09-29', completions: {} });
    const { result } = renderHook(() => useAppState());
    const map = ['##########', ...Array(9).fill('..........')];
    let key = '';
    act(() => {
      key = result.current.addImage(map);
    });
    expect(key).toMatch(/^c-[0-9a-f]{8}$/);
    expect(result.current.state.customImages).toEqual([{ key, map }]);

    const dot = ['#.........', ...Array(9).fill('..........')];
    act(() => result.current.updateImage(key, dot));
    expect(result.current.state.customImages[0].map).toEqual(dot);

    act(() => result.current.editTask('reading', { name: 'Reading', description: '', image: key }));
    act(() => result.current.deleteImage(key));
    expect(result.current.state.customImages).toHaveLength(1);
    act(() => result.current.editTask('reading', { name: 'Reading', description: '', image: 'book' }));
    act(() => result.current.deleteImage(key));
    expect(result.current.state.customImages).toEqual([]);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).customImages).toEqual([]);
  });
});
