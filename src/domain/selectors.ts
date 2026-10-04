import { countOn, weekCountThrough, weeklyAwarded } from './counts';
import { daysLeftAfter, type DateKey } from './dates';
import { RANKS, getRank } from './ranks';
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

// Sessions that won't fit if nothing more is done today: today's session counts
// as missed until it's marked done. Only for once-per-day weekly tasks.
export function willMiss(state: AppState, task: TaskDef, today: DateKey): number {
  if (task.maxPerDay !== 1) return 0;
  const remaining = remainingThisWeek(state, task, today);
  return remaining === null ? 0 : Math.max(0, remaining - daysLeftAfter(today));
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

// Settled days in the rank, plus today if it's the current rank.
export function daysInRank(state: AppState, title: string): number {
  const days = state.rankDays[title] ?? 0;
  return title === getRank(state.points).current.title ? days + 1 : days;
}

export function isUnlocked(state: AppState, title: string): boolean {
  return (
    title === RANKS[0].title ||
    title === getRank(state.points).current.title ||
    (state.rankDays[title] ?? 0) > 0
  );
}
