import type { DateKey } from './dates';
import type { TaskDef, TaskId } from './tasks';

export type DayCompletions = Partial<Record<TaskId, number>>;

export interface AppState {
  version: 1;
  points: number;
  lastSettledDate: DateKey;
  completions: Record<DateKey, DayCompletions>; // current week only
  graceWeek: DateKey; // Monday of the first week; no shortfall penalty that week
  weekNumber: number; // 1 in the first week, +1 per settled Sunday
  playerName: string;
  rankDays: Record<string, number>; // rank title -> settled days spent in that rank
  tasks: TaskDef[]; // the player's tasks, in display order
}
