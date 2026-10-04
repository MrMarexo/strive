import { weekDays, type DateKey } from './dates';
import type { TaskDef, TaskId } from './tasks';
import type { AppState } from './types';

type Completions = AppState['completions'];

export function countOn(completions: Completions, day: DateKey, id: TaskId): number {
  return completions[day]?.[id] ?? 0;
}

export function weekCountBefore(completions: Completions, day: DateKey, id: TaskId): number {
  return weekDays(day)
    .filter((d) => d < day)
    .reduce((sum, d) => sum + countOn(completions, d, id), 0);
}

export function weekCountThrough(completions: Completions, day: DateKey, id: TaskId): number {
  return weekCountBefore(completions, day, id) + countOn(completions, day, id);
}

export function weeklyAwarded(completions: Completions, day: DateKey, task: TaskDef): number {
  if (task.cadence.kind !== 'weekly') return 0;
  const room = task.cadence.target - weekCountBefore(completions, day, task.id);
  return Math.max(0, Math.min(countOn(completions, day, task.id), room));
}
