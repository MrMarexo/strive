import { countOn, weekCountThrough, weeklyAwarded } from './counts';
import { daysLeftAfter, type DateKey } from './dates';
import { COMPLETE_POINTS } from './settle';
import { TASKS, type TaskDef, type TaskId } from './tasks';
import type { AppState } from './types';

export function todayCount(state: AppState, id: TaskId, today: DateKey): number {
  return countOn(state.completions, today, id);
}

export function weekCount(state: AppState, id: TaskId, today: DateKey): number {
  return weekCountThrough(state.completions, today, id);
}

export function remainingThisWeek(state: AppState, task: TaskDef, today: DateKey): number | null {
  if (task.cadence.kind !== 'weekly') return null;
  return Math.max(0, task.cadence.target - weekCount(state, task.id, today));
}

export function isAtRisk(state: AppState, task: TaskDef, today: DateKey): boolean {
  if (task.maxPerDay !== 1) return false;
  const remaining = remainingThisWeek(state, task, today);
  if (remaining === null) return false;
  const availableDays = daysLeftAfter(today) + (todayCount(state, task.id, today) === 0 ? 1 : 0);
  return remaining > availableDays;
}

export function pendingToday(state: AppState, today: DateKey): number {
  let points = 0;
  for (const task of TASKS) {
    if (task.cadence.kind === 'daily') {
      if (todayCount(state, task.id, today) > 0) points += COMPLETE_POINTS;
    } else {
      points += weeklyAwarded(state.completions, today, task) * COMPLETE_POINTS;
    }
  }
  return points;
}
