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

export function complete(state: AppState, id: TaskId, today: DateKey): AppState {
  const { maxPerDay } = getTask(id);
  const count = countOn(state.completions, today, id);
  if (maxPerDay !== null && count >= maxPerDay) return state;
  return withCount(state, id, today, count + 1);
}

export function undo(state: AppState, id: TaskId, today: DateKey): AppState {
  const count = countOn(state.completions, today, id);
  if (count === 0) return state;
  return withCount(state, id, today, count - 1);
}
