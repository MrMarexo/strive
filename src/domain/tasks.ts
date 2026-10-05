import type { DateKey } from './dates';

export type TaskId = string;
export type Cadence = { kind: 'daily' } | { kind: 'weekly'; target: number };
export type TaskGroup = 'daily' | 'weekly' | 'weekly-unlimited';
export type TaskStatus = 'active' | 'pending' | 'retiring';

export interface TaskDef {
  id: TaskId;
  name: string;
  description: string;
  image: string; // key in IMAGE_KEYS
  cadence: Cadence;
  maxPerDay: 1 | null; // null = no day limit
  startsOn: DateKey; // first day scored
  retiresAfter: DateKey | null; // last day scored (a Sunday), set on removal
}

export const MAX_TASK_NAME = 24;
export const MAX_DESCRIPTION = 300;
export const TARGET_LIMITS = { weekly: 7, 'weekly-unlimited': 30 } as const;

export function taskGroup(task: Pick<TaskDef, 'cadence' | 'maxPerDay'>): TaskGroup {
  if (task.cadence.kind === 'daily') return 'daily';
  return task.maxPerDay === null ? 'weekly-unlimited' : 'weekly';
}

export function isActive(task: TaskDef, day: DateKey): boolean {
  return task.startsOn <= day && (task.retiresAfter === null || day <= task.retiresAfter);
}

export function activeTasks(tasks: TaskDef[], day: DateKey): TaskDef[] {
  return tasks.filter((task) => isActive(task, day));
}

export function findTask(tasks: TaskDef[], id: TaskId): TaskDef | undefined {
  return tasks.find((task) => task.id === id);
}

export function taskStatus(task: TaskDef, today: DateKey): TaskStatus {
  if (task.startsOn > today) return 'pending';
  return task.retiresAfter === null ? 'active' : 'retiring';
}

// The original eight tasks, used to migrate data saved before tasks were editable.
export function seedTasks(startsOn: DateKey): TaskDef[] {
  const daily: Cadence = { kind: 'daily' };
  const base = { startsOn, retiresAfter: null };
  return [
    { id: 'reading', name: 'Reading', description: 'Read every day.', image: 'book', cadence: daily, maxPerDay: 1, ...base },
    {
      id: 'coding', name: 'Coding', description: 'Write code – five sessions a week.', image: 'laptop',
      cadence: { kind: 'weekly', target: 5 }, maxPerDay: 1, ...base,
    },
    { id: 'running', name: 'Running', description: 'Go for a run every day.', image: 'shoe', cadence: daily, maxPerDay: 1, ...base },
    {
      id: 'sport', name: 'Sport & Exercise',
      description: 'Working out, swimming, skating or any other sport or physical activity.', image: 'dumbbell',
      cadence: { kind: 'weekly', target: 4 }, maxPerDay: 1, ...base,
    },
    { id: 'abstinence', name: 'Abstinence', description: 'Abstain from pornography.', image: 'shield', cadence: daily, maxPerDay: 1, ...base },
    {
      id: 'logic', name: 'Logic Workout', description: 'A game of chess, online Catan or a strategy board game with friends.',
      image: 'knight', cadence: daily, maxPerDay: 1, ...base,
    },
    {
      id: 'chores', name: 'House Chores', description: 'Any household chore – can be logged more than once a day.',
      image: 'broom', cadence: { kind: 'weekly', target: 4 }, maxPerDay: null, ...base,
    },
    {
      id: 'language', name: 'Language Learning', description: 'Practise a foreign language every day.', image: 'speech',
      cadence: daily, maxPerDay: 1, ...base,
    },
  ];
}
