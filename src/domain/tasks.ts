export type TaskId =
  | 'reading' | 'coding' | 'running' | 'sport'
  | 'abstinence' | 'logic' | 'chores' | 'language';

export type Cadence = { kind: 'daily' } | { kind: 'weekly'; target: number };

export interface TaskDef {
  id: TaskId;
  name: string;
  cadence: Cadence;
  maxPerDay: number | null; // null = unlimited
}

const daily: Cadence = { kind: 'daily' };

export const TASKS: TaskDef[] = [
  { id: 'reading', name: 'Reading', cadence: daily, maxPerDay: 1 },
  { id: 'coding', name: 'Coding', cadence: { kind: 'weekly', target: 5 }, maxPerDay: 1 },
  { id: 'running', name: 'Running', cadence: daily, maxPerDay: 1 },
  { id: 'sport', name: 'Sport & Exercise', cadence: { kind: 'weekly', target: 4 }, maxPerDay: 1 },
  { id: 'abstinence', name: 'Abstinence', cadence: daily, maxPerDay: 1 },
  { id: 'logic', name: 'Logic Workout', cadence: daily, maxPerDay: 1 },
  { id: 'chores', name: 'House Chores', cadence: { kind: 'weekly', target: 4 }, maxPerDay: null },
  { id: 'language', name: 'Language Learning', cadence: daily, maxPerDay: 1 },
];

export function getTask(id: TaskId): TaskDef {
  const task = TASKS.find((t) => t.id === id);
  if (!task) throw new Error(`Unknown task: ${id}`);
  return task;
}

export type TaskGroup = 'daily' | 'weekly' | 'weekly-unlimited';

export function taskGroup(task: TaskDef): TaskGroup {
  if (task.cadence.kind === 'daily') return 'daily';
  return task.maxPerDay === null ? 'weekly-unlimited' : 'weekly';
}
