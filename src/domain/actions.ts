import { countOn } from './counts';
import type { DateKey } from './dates';
import { getTask, type TaskId } from './tasks';
import type { AppState } from './types';

function withCount(state: AppState, id: TaskId, today: DateKey, count: number): AppState {
  return {
    ...state,
    completions: {
      ...state.completions,
      [today]: { ...state.completions[today], [id]: count },
    },
  };
}

// Days up to lastSettledDate are already scored (e.g. the clock moved back), so they're locked.
function isLocked(state: AppState, today: DateKey): boolean {
  return today <= state.lastSettledDate;
}

export function complete(state: AppState, id: TaskId, today: DateKey): AppState {
  if (isLocked(state, today)) return state;
  const { maxPerDay } = getTask(id);
  const count = countOn(state.completions, today, id);
  if (maxPerDay !== null && count >= maxPerDay) return state;
  return withCount(state, id, today, count + 1);
}

export function undo(state: AppState, id: TaskId, today: DateKey): AppState {
  if (isLocked(state, today)) return state;
  const count = countOn(state.completions, today, id);
  if (count === 0) return state;
  return withCount(state, id, today, count - 1);
}
