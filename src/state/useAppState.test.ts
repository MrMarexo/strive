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

  it('starts fresh and records completions for today', () => {
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
    seed({ version: 1, points: 50, graceWeek: '2026-09-21', lastSettledDate: '2026-09-28', completions: { '2026-09-29': { reading: 1 } } });
    vi.setSystemTime(new Date(2026, 8, 30, 10, 0));
    const { result } = renderHook(() => useAppState());
    // Tue: +1 reading, -8 for four missed daily tasks
    expect(result.current.state.points).toBe(43);
    expect(result.current.state.lastSettledDate).toBe('2026-09-29');
  });

  it('settles at midnight while the app stays open', () => {
    seed({ version: 1, points: 50, graceWeek: '2026-09-21', lastSettledDate: '2026-09-28', completions: {} });
    vi.setSystemTime(new Date(2026, 8, 29, 23, 59, 30));
    const { result } = renderHook(() => useAppState());
    act(() => result.current.complete('reading'));

    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current.state.points).toBe(43);
    expect(result.current.state.lastSettledDate).toBe('2026-09-29');
  });

  it('counts a tap after midnight for the new day even before the timer fires', () => {
    seed({ version: 1, points: 50, graceWeek: '2026-09-21', lastSettledDate: '2026-09-28', completions: {} });
    vi.setSystemTime(new Date(2026, 8, 29, 23, 59, 50));
    const { result } = renderHook(() => useAppState());

    vi.setSystemTime(new Date(2026, 8, 30, 0, 0, 10));
    act(() => result.current.complete('reading'));
    expect(result.current.state.lastSettledDate).toBe('2026-09-29');
    expect(result.current.state.points).toBe(40);
    expect(result.current.state.completions['2026-09-30']).toEqual({ reading: 1 });
  });

  it('settles when the window regains focus', () => {
    seed({ version: 1, points: 50, graceWeek: '2026-09-21', lastSettledDate: '2026-09-28', completions: {} });
    vi.setSystemTime(new Date(2026, 8, 29, 23, 59, 50));
    const { result } = renderHook(() => useAppState());

    vi.setSystemTime(new Date(2026, 8, 30, 8, 0));
    act(() => { window.dispatchEvent(new Event('focus')); });
    expect(result.current.state.lastSettledDate).toBe('2026-09-29');
  });
  it('picks up progress saved by another tab', () => {
    vi.setSystemTime(new Date(2026, 8, 30, 10, 0));
    const { result } = renderHook(() => useAppState());

    seed({ version: 1, points: 7, graceWeek: '2026-09-28', lastSettledDate: '2026-09-29', completions: { '2026-09-30': { reading: 1 } } });
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY })); });
    expect(result.current.state.points).toBe(7);
    expect(result.current.state.completions['2026-09-30']).toEqual({ reading: 1 });

    act(() => result.current.complete('running'));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).completions['2026-09-30']).toEqual({ reading: 1, running: 1 });
  });
});
