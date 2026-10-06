import { countOn } from './counts';
import { addDays, dayOfWeek, mondayOf, type DateKey } from './dates';
import { IMAGE_KEYS } from './imageKeys';
import { isImageKey } from './images';
import {
  MAX_DESCRIPTION, MAX_TASK_NAME, TARGET_LIMITS, findTask, isActive,
  type TaskDef, type TaskGroup, type TaskId,
} from './tasks';
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

export interface NewTaskInput {
  group: TaskGroup;
  name: string;
  description: string;
  image: string;
  target?: number;
}

export interface TaskEdit {
  name: string;
  description: string;
  image: string;
}

const DEFAULT_TARGET = 3;

const cleanName = (name: string) => name.trim().slice(0, MAX_TASK_NAME).trim();
const cleanDescription = (text: string) => text.trim().slice(0, MAX_DESCRIPTION);
const cleanImage = (state: AppState, image: string) => (isImageKey(state, image) ? image : IMAGE_KEYS[0]);

function cleanTarget(group: TaskGroup, target: number | undefined): number {
  const max = group === 'weekly-unlimited' ? TARGET_LIMITS['weekly-unlimited'] : TARGET_LIMITS.weekly;
  const value = target !== undefined && Number.isFinite(target) ? Math.round(target) : DEFAULT_TARGET;
  return Math.min(max, Math.max(1, value));
}

function replaceTask(state: AppState, task: TaskDef): AppState {
  return { ...state, tasks: state.tasks.map((t) => (t.id === task.id ? task : t)) };
}

// New tasks start on a Monday so the first week is a full one.
export function firstStartDay(today: DateKey): DateKey {
  return dayOfWeek(today) === 0 ? today : addDays(mondayOf(today), 7);
}

export function addTask(state: AppState, input: NewTaskInput, today: DateKey, id: TaskId): AppState {
  const name = cleanName(input.name);
  if (!name || findTask(state.tasks, id)) return state;
  const task: TaskDef = {
    id,
    name,
    description: cleanDescription(input.description),
    image: cleanImage(state, input.image),
    cadence: input.group === 'daily' ? { kind: 'daily' } : { kind: 'weekly', target: cleanTarget(input.group, input.target) },
    maxPerDay: input.group === 'weekly-unlimited' ? null : 1,
    startsOn: firstStartDay(today),
    retiresAfter: null,
  };
  return { ...state, tasks: [...state.tasks, task] };
}

export function editTask(state: AppState, id: TaskId, edit: TaskEdit): AppState {
  const task = findTask(state.tasks, id);
  const name = cleanName(edit.name);
  if (!task || !name) return state;
  return replaceTask(state, { ...task, name, description: cleanDescription(edit.description), image: cleanImage(state, edit.image) });
}

// Started tasks retire after this Sunday (still scored, penalty included); others go now.
export function removeTask(state: AppState, id: TaskId, today: DateKey): AppState {
  const task = findTask(state.tasks, id);
  if (!task) return state;
  if (task.startsOn > today) {
    // Normally it has no taps, but a clock moved back can leave some; orphans would invalidate saved data.
    const completions = Object.fromEntries(
      Object.entries(state.completions).map(([day, counts]) => {
        const { [id]: _dropped, ...rest } = counts;
        return [day, rest];
      }),
    );
    return { ...state, tasks: state.tasks.filter((t) => t.id !== id), completions };
  }
  return replaceTask(state, { ...task, retiresAfter: addDays(mondayOf(today), 6) });
}

export function undoRemove(state: AppState, id: TaskId): AppState {
  const task = findTask(state.tasks, id);
  if (!task || task.retiresAfter === null) return state;
  return replaceTask(state, { ...task, retiresAfter: null });
}
