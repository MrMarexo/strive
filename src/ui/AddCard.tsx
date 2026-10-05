import type { MouseEvent } from 'react';
import type { TaskGroup } from '../domain/tasks';

export const ADD_LABELS: Record<TaskGroup, string> = {
  daily: 'ADD DAILY TASK',
  weekly: 'ADD WEEKLY TASK',
  'weekly-unlimited': 'ADD NO-LIMIT TASK',
};

export const NEW_TITLES: Record<TaskGroup, string> = {
  daily: 'NEW DAILY TASK',
  weekly: 'NEW WEEKLY TASK',
  'weekly-unlimited': 'NEW NO-LIMIT TASK',
};

interface AddCardProps {
  group: TaskGroup;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}

export function AddCard({ group, onClick }: AddCardProps) {
  return (
    <button type="button" className="card add-card" onClick={onClick}>
      <span className="add-plus" aria-hidden="true">
        +
      </span>
      <span>{ADD_LABELS[group]}</span>
    </button>
  );
}
