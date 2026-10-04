import { DEFAULT_PLAYER_NAME, MAX_NAME_LENGTH } from '../domain/actions';
import { addDays, fromKey, mondayOf, toKey, type DateKey } from '../domain/dates';
import { TASKS } from '../domain/tasks';
import type { AppState } from '../domain/types';

export const STORAGE_KEY = 'strive:v1';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TASK_IDS = new Set<string>(TASKS.map((t) => t.id));
const MAX_CLOCK_DRIFT_DAYS = 7;

export function freshState(today: DateKey): AppState {
  return {
    version: 1,
    points: 0,
    lastSettledDate: addDays(today, -1),
    completions: {},
    graceWeek: mondayOf(today),
    weekNumber: 1,
    playerName: DEFAULT_PLAYER_NAME,
  };
}

function isCount(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && DATE_RE.test(value) && toKey(fromKey(value)) === value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isValidState(value: unknown): value is AppState {
  if (!isPlainObject(value)) return false;
  if (value.version !== 1 || !isCount(value.points)) return false;
  if (!isDateKey(value.lastSettledDate) || !isDateKey(value.graceWeek)) return false;
  if (!isCount(value.weekNumber) || (value.weekNumber as number) < 1) return false;
  if (typeof value.playerName !== 'string' || value.playerName.length < 1 || value.playerName.length > MAX_NAME_LENGTH) {
    return false;
  }
  if (!isPlainObject(value.completions)) return false;
  return Object.entries(value.completions).every(
    ([date, day]) =>
      DATE_RE.test(date) &&
      isPlainObject(day) &&
      Object.entries(day).every(([id, n]) => TASK_IDS.has(id) && isCount(n)),
  );
}

// Data saved before weekNumber/playerName existed: fill them in. The week number
// counts the Sundays already settled since the first week.
function migrate(value: unknown): unknown {
  if (!isPlainObject(value) || !isDateKey(value.graceWeek) || !isDateKey(value.lastSettledDate)) return value;
  const migrated = { ...value };
  if (migrated.playerName === undefined) migrated.playerName = DEFAULT_PLAYER_NAME;
  if (migrated.weekNumber === undefined) {
    const currentWeek = mondayOf(addDays(value.lastSettledDate, 1));
    let weekNumber = 1;
    for (let monday = value.graceWeek; monday < currentWeek; monday = addDays(monday, 7)) weekNumber += 1;
    migrated.weekNumber = weekNumber;
  }
  return migrated;
}

// A lastSettledDate far in the future (clock jumped ahead, hand edit) would block
// settlement until that date. Pull it back to yesterday, keeping the points.
function repairFutureDate(state: AppState, today: DateKey): AppState {
  if (state.lastSettledDate <= addDays(today, MAX_CLOCK_DRIFT_DAYS)) return state;
  console.warn('Strive: last settled date is in the future, resetting it to yesterday');
  const monday = mondayOf(today);
  const completions = Object.fromEntries(
    Object.entries(state.completions).filter(([date]) => date >= monday && date <= today),
  );
  return { ...state, lastSettledDate: addDays(today, -1), completions };
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
    const parsed = migrate(JSON.parse(raw));
    if (isValidState(parsed)) return repairFutureDate(parsed, today);
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
