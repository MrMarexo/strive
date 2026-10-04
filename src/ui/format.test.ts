import { describe, expect, it } from 'vitest';
import { barCells, cadenceLabel, formatWeekOf } from './format';

describe('barCells', () => {
  it('fills proportionally, rounding down', () => {
    expect(barCells(0)).toEqual({ filled: 0, empty: 20 });
    expect(barCells(5 / 30)).toEqual({ filled: 3, empty: 17 });
    expect(barCells(0.99)).toEqual({ filled: 19, empty: 1 });
    expect(barCells(1)).toEqual({ filled: 20, empty: 0 });
  });

  it('clamps out-of-range progress', () => {
    expect(barCells(-1)).toEqual({ filled: 0, empty: 20 });
    expect(barCells(2)).toEqual({ filled: 20, empty: 0 });
  });
});

describe('formatWeekOf', () => {
  it('formats as MON D', () => {
    expect(formatWeekOf('2026-09-28')).toBe('SEP 28');
    expect(formatWeekOf('2026-10-05')).toBe('OCT 5');
  });
});

describe('cadenceLabel', () => {
  it('labels daily and weekly tasks', () => {
    expect(cadenceLabel(null)).toBe('DAILY');
    expect(cadenceLabel(3)).toBe('3 LEFT THIS WEEK');
    expect(cadenceLabel(0)).toBe('TARGET MET');
  });
});
