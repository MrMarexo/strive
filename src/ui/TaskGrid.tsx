import { useRef, useState, type MouseEvent } from 'react';
import type { DateKey } from '../domain/dates';
import { remainingThisWeek, todayCount, willMiss } from '../domain/selectors';
import { findTask, taskGroup, taskStatus, type TaskDef, type TaskGroup, type TaskId } from '../domain/tasks';
import type { AppState } from '../domain/types';
import { CounterCard } from './CounterCard';
import { Modal } from './Modal';
import { TaskCard, type CardProps } from './TaskCard';

interface TaskGridProps {
  state: AppState;
  today: DateKey;
  onComplete: (id: TaskId) => void;
  onUndo: (id: TaskId) => void;
}

const GROUPS: { id: TaskGroup; title: string; info: string }[] = [
  {
    id: 'daily',
    title: 'DAILY',
    info: 'Do each of these once every day. Done: +1 point at midnight. Missed: -2 points at midnight.',
  },
  {
    id: 'weekly',
    title: 'WEEKLY',
    info:
      'Each has a weekly target (e.g. Coding 5×) and counts at most once per day. +1 point per session at midnight. ' +
      'On Sunday night, -2 for every session short of the target.',
  },
  {
    id: 'weekly-unlimited',
    title: 'WEEKLY · NO DAY LIMIT',
    info:
      'A weekly target you can log several times a day (e.g. 3 chores today). +1 point per session up to the target; ' +
      'extras earn nothing. On Sunday night, -2 for every session short of the target.',
  },
];

type OpenModal = { kind: 'group'; group: TaskGroup } | { kind: 'task'; id: TaskId };

export function TaskGrid({ state, today, onComplete, onUndo }: TaskGridProps) {
  const [modal, setModal] = useState<OpenModal | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  const open = (next: OpenModal) => (event: MouseEvent<HTMLButtonElement>) => {
    opener.current = event.currentTarget;
    setModal(next);
  };
  const close = () => {
    setModal(null);
    opener.current?.focus();
  };

  const renderCard = (task: TaskDef) => {
    const status = taskStatus(task, today);
    const props: CardProps = {
      task,
      status,
      todayCount: todayCount(state, task.id, today),
      remaining: status === 'pending' ? null : remainingThisWeek(state, task, today),
      willMiss: willMiss(state, task, today),
      onComplete: () => onComplete(task.id),
      onUndo: () => onUndo(task.id),
      onInfo: open({ kind: 'task', id: task.id }),
    };
    return task.maxPerDay === null ? (
      <CounterCard key={task.id} {...props} />
    ) : (
      <TaskCard key={task.id} {...props} />
    );
  };

  const renderModal = () => {
    if (!modal) return null;
    if (modal.kind === 'group') {
      const group = GROUPS.find((g) => g.id === modal.group)!;
      return (
        <Modal title={group.title} onClose={close}>
          <p>{group.info}</p>
        </Modal>
      );
    }
    const task = findTask(state.tasks, modal.id);
    if (!task) return null;
    return (
      <Modal title={task.name.toUpperCase()} onClose={close}>
        <p>{task.description || 'No description yet.'}</p>
      </Modal>
    );
  };

  return (
    <>
      {GROUPS.map((group) => {
        const tasks = state.tasks.filter((task) => taskGroup(task) === group.id);
        if (tasks.length === 0) return null;
        return (
          <section key={group.id} className="task-group" aria-labelledby={`group-${group.id}`}>
            <div className="group-head">
              <h2 id={`group-${group.id}`} className="group-title">
                {group.title}
              </h2>
              <button
                type="button"
                className="btn info-btn"
                aria-label={`About ${group.title} tasks`}
                onClick={open({ kind: 'group', group: group.id })}
              >
                [?]
              </button>
            </div>
            <div className="grid">{tasks.map(renderCard)}</div>
          </section>
        );
      })}
      {renderModal()}
    </>
  );
}
