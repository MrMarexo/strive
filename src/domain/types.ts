import type { DateKey } from './dates';
import type { TaskId } from './tasks';

export type DayCompletions = Partial<Record<TaskId, number>>;

export interface AppState {
  version: 1;
  points: number;
  lastSettledDate: DateKey;
  completions: Record<DateKey, DayCompletions>; // current week only
  graceWeek: DateKey; // Monday of the first week; no shortfall penalty that week
}
