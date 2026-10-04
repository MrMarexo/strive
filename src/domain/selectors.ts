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

// Days still usable for a once-per-day weekly task; null if the task isn't one.
function slack(state: AppState, task: TaskDef, today: DateKey): { remaining: number; available: number } | null {
  if (task.maxPerDay !== 1) return null;
  const remaining = remainingThisWeek(state, task, today);
  if (remaining === null) return null;
  const available = daysLeftAfter(today) + (todayCount(state, task.id, today) === 0 ? 1 : 0);
  return { remaining, available };
}

// Every remaining day is needed to hit the target.
export function isAtRisk(state: AppState, task: TaskDef, today: DateKey): boolean {
  const s = slack(state, task, today);
  return s !== null && s.remaining > 0 && s.remaining === s.available;
}

// Sessions that can no longer fit before Sunday ends.
export function willMiss(state: AppState, task: TaskDef, today: DateKey): number {
  const s = slack(state, task, today);
  return s === null ? 0 : Math.max(0, s.remaining - s.available);
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
