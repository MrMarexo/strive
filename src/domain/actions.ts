import { countOn } from './counts';
import type { DateKey } from './dates';
import { findTask, isActive, type TaskId } from './tasks';
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

// Only tasks active today can be tapped; this also keeps completions free of
// not-yet-started tasks, which may be deleted outright.
function canTap(state: AppState, id: TaskId, today: DateKey) {
  const task = findTask(state.tasks, id);
  return !isLocked(state, today) && task !== undefined && isActive(task, today) ? task : undefined;
}

export function complete(state: AppState, id: TaskId, today: DateKey): AppState {
  const task = canTap(state, id, today);
  if (!task) return state;
  const count = countOn(state.completions, today, id);
  if (task.maxPerDay !== null && count >= task.maxPerDay) return state;
  return withCount(state, id, today, count + 1);
}

export function undo(state: AppState, id: TaskId, today: DateKey): AppState {
  if (!canTap(state, id, today)) return state;
  const count = countOn(state.completions, today, id);
  if (count === 0) return state;
  return withCount(state, id, today, count - 1);
}

export const DEFAULT_PLAYER_NAME = 'no_name';
export const MAX_NAME_LENGTH = 20;

export function rename(state: AppState, name: string): AppState {
  const playerName = name.trim().slice(0, MAX_NAME_LENGTH).trim() || DEFAULT_PLAYER_NAME;
  return playerName === state.playerName ? state : { ...state, playerName };
}
