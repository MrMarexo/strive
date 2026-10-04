import { addDays, mondayOf, type DateKey } from '../domain/dates';
import { TASKS } from '../domain/tasks';
import type { AppState } from '../domain/types';

export const STORAGE_KEY = 'strive:v1';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TASK_IDS = new Set<string>(TASKS.map((t) => t.id));

export function freshState(today: DateKey): AppState {
  return { version: 1, points: 0, lastSettledDate: addDays(today, -1), completions: {}, graceWeek: mondayOf(today) };
}

function isCount(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && DATE_RE.test(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isValidState(value: unknown): value is AppState {
  if (!isPlainObject(value)) return false;
  if (value.version !== 1 || !isCount(value.points)) return false;
  if (!isDateKey(value.lastSettledDate) || !isDateKey(value.graceWeek)) return false;
  if (!isPlainObject(value.completions)) return false;
  return Object.entries(value.completions).every(
    ([date, day]) =>
      DATE_RE.test(date) &&
      isPlainObject(day) &&
      Object.entries(day).every(([id, n]) => TASK_IDS.has(id) && isCount(n)),
  );
}

// Reading window.localStorage itself throws when the browser blocks site data,
// so it is only touched inside the try blocks.
export function load(today: DateKey, storage?: Storage): AppState {
  let raw: string | null;
  try {
    raw = (storage ?? window.localStorage).getItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Strive: storage unavailable, starting fresh', error);
    return freshState(today);
  }
  if (raw === null) return freshState(today);

  try {
    const parsed: unknown = JSON.parse(raw);
    if (isValidState(parsed)) return parsed;
  } catch {
    // fall through to the warning below
  }
  console.warn('Strive: stored data is invalid, starting fresh');
  return freshState(today);
}

export function save(state: AppState, storage?: Storage): void {
  try {
    (storage ?? window.localStorage).setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Strive: could not save progress', error);
  }
}
