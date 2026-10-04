import { countOn, weekCountThrough, weeklyAwarded } from './counts';
import { addDays, isSunday, mondayOf, weekDays, type DateKey } from './dates';
import { TASKS } from './tasks';
import type { AppState } from './types';

export const COMPLETE_POINTS = 1;
export const FAIL_PENALTY = 2;

type Completions = AppState['completions'];

function scoreDay(completions: Completions, day: DateKey): number {
  let net = 0;
  for (const task of TASKS) {
    if (task.cadence.kind === 'daily') {
      net += countOn(completions, day, task.id) > 0 ? COMPLETE_POINTS : -FAIL_PENALTY;
    } else {
      net += weeklyAwarded(completions, day, task) * COMPLETE_POINTS;
    }
  }
  return net;
}

function weeklyPenalty(completions: Completions, sunday: DateKey): number {
  let penalty = 0;
  for (const task of TASKS) {
    if (task.cadence.kind !== 'weekly') continue;
    const done = weekCountThrough(completions, sunday, task.id);
    penalty += FAIL_PENALTY * Math.max(0, task.cadence.target - done);
  }
  return penalty;
}

export function settle(state: AppState, today: DateKey): AppState {
  let { points, lastSettledDate, weekNumber } = state;
  const completions = { ...state.completions };

  for (let day = addDays(lastSettledDate, 1); day < today; day = addDays(day, 1)) {
    points = Math.max(0, points + scoreDay(completions, day));
    if (isSunday(day)) {
      if (mondayOf(day) !== state.graceWeek) {
        points = Math.max(0, points - weeklyPenalty(completions, day));
      }
      for (const d of weekDays(day)) delete completions[d];
      weekNumber += 1;
    }
    lastSettledDate = day;
  }

  if (lastSettledDate === state.lastSettledDate) return state;
  return { ...state, points, lastSettledDate, completions, weekNumber };
}
