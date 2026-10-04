import { describe, expect, it } from 'vitest';
import { addDays, dayOfWeek, daysLeftAfter, fromKey, isSunday, mondayOf, toKey, weekDays } from './dates';

describe('dates', () => {
  it('formats a local date as YYYY-MM-DD', () => {
    expect(toKey(new Date(2026, 8, 28, 23, 59))).toBe('2026-09-28');
    expect(toKey(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05');
  });

  it('round-trips keys through fromKey', () => {
    expect(toKey(fromKey('2026-10-04'))).toBe('2026-10-04');
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30');
  });

  it('adds days across a DST change', () => {
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
  });

  it('numbers weekdays Monday=0 to Sunday=6', () => {
    expect(dayOfWeek('2026-09-28')).toBe(0);
    expect(dayOfWeek('2026-10-03')).toBe(5);
    expect(dayOfWeek('2026-10-04')).toBe(6);
  });

  it('finds the Monday of a week', () => {
    expect(mondayOf('2026-09-28')).toBe('2026-09-28');
    expect(mondayOf('2026-10-04')).toBe('2026-09-28');
    expect(mondayOf('2026-10-05')).toBe('2026-10-05');
  });

  it('detects Sundays', () => {
    expect(isSunday('2026-10-04')).toBe(true);
    expect(isSunday('2026-10-03')).toBe(false);
  });

  it('counts days left in the week after a date', () => {
    expect(daysLeftAfter('2026-09-28')).toBe(6);
    expect(daysLeftAfter('2026-10-03')).toBe(1);
    expect(daysLeftAfter('2026-10-04')).toBe(0);
  });

  it('lists the seven days of a week', () => {
    expect(weekDays('2026-10-01')).toEqual([
      '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01',
      '2026-10-02', '2026-10-03', '2026-10-04',
    ]);
  });
});
