import { countOn, weekCountThrough, weeklyAwarded } from './counts';
import { addDays, isSunday, mondayOf, weekDays, type DateKey } from './dates';
import { getRank } from './ranks';
import { activeTasks, type TaskDef } from './tasks';
import type { AppState } from './types';

export const COMPLETE_POINTS = 1;
export const FAIL_PENALTY = 2;

type Completions = AppState['completions'];

function scoreDay(tasks: TaskDef[], completions: Completions, day: DateKey): number {
  let net = 0;
  for (const task of activeTasks(tasks, day)) {
    if (task.cadence.kind === 'daily') {
      net += countOn(completions, day, task.id) > 0 ? COMPLETE_POINTS : -FAIL_PENALTY;
    } else {
      net += weeklyAwarded(completions, day, task) * COMPLETE_POINTS;
    }
  }
  return net;
}

function weeklyPenalty(tasks: TaskDef[], completions: Completions, sunday: DateKey): number {
  let penalty = 0;
  for (const task of activeTasks(tasks, sunday)) {
    if (task.cadence.kind !== 'weekly') continue;
    const done = weekCountThrough(completions, sunday, task.id);
    penalty += FAIL_PENALTY * Math.max(0, task.cadence.target - done);
  }
  return penalty;
}

export function settle(state: AppState, today: DateKey): AppState {
  let { points, lastSettledDate, weekNumber } = state;
  const completions = { ...state.completions };
  const rankDays = { ...state.rankDays };
  let tasks = state.tasks;

  for (let day = addDays(lastSettledDate, 1); day < today; day = addDays(day, 1)) {
    const held = getRank(points).current.title; // rank shown on screen during this day
    rankDays[held] = (rankDays[held] ?? 0) + 1;
    points = Math.max(0, points + scoreDay(tasks, completions, day));
    if (isSunday(day)) {
      if (mondayOf(day) !== state.graceWeek) {
        points = Math.max(0, points - weeklyPenalty(tasks, completions, day));
      }
      for (const d of weekDays(day)) delete completions[d];
      tasks = tasks.filter((task) => task.retiresAfter !== day); // retired tasks leave after their last Sunday
      weekNumber += 1;
    }
    lastSettledDate = day;
  }

  if (lastSettledDate === state.lastSettledDate) return state;
  return { ...state, points, lastSettledDate, completions, weekNumber, rankDays, tasks };
}
