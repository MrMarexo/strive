export type DateKey = string;

export function toKey(date: Date): DateKey {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Noon avoids DST edge cases when shifting by whole days.
export function fromKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function addDays(key: DateKey, n: number): DateKey {
  const date = fromKey(key);
  date.setDate(date.getDate() + n);
  return toKey(date);
}

export function dayOfWeek(key: DateKey): number {
  return (fromKey(key).getDay() + 6) % 7;
}

export function mondayOf(key: DateKey): DateKey {
  return addDays(key, -dayOfWeek(key));
}

export function isSunday(key: DateKey): boolean {
  return dayOfWeek(key) === 6;
}

export function daysLeftAfter(key: DateKey): number {
  return 6 - dayOfWeek(key);
}

export function weekDays(key: DateKey): DateKey[] {
  const monday = mondayOf(key);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}
