import { useCallback, useRef, useState } from 'react';
import type { DateKey } from '../domain/dates';
import { remainingThisWeek, todayCount, willMiss } from '../domain/selectors';
import { TASKS, taskGroup, type TaskDef, type TaskGroup, type TaskId } from '../domain/tasks';
import type { AppState } from '../domain/types';
import { CounterCard } from './CounterCard';
import { InfoDialog } from './InfoDialog';
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

export function TaskGrid({ state, today, onComplete, onUndo }: TaskGridProps) {
  const [openInfo, setOpenInfo] = useState<TaskGroup | null>(null);
  const infoButtons = useRef<Partial<Record<TaskGroup, HTMLButtonElement | null>>>({});
  const openGroup = GROUPS.find((group) => group.id === openInfo);

  const closeInfo = useCallback(() => {
    if (openInfo) infoButtons.current[openInfo]?.focus();
    setOpenInfo(null);
  }, [openInfo]);

  const renderCard = (task: TaskDef) => {
    const props: CardProps = {
      task,
      todayCount: todayCount(state, task.id, today),
      remaining: remainingThisWeek(state, task, today),
      willMiss: willMiss(state, task, today),
      onComplete: () => onComplete(task.id),
      onUndo: () => onUndo(task.id),
    };
    return task.maxPerDay === null ? (
      <CounterCard key={task.id} {...props} />
    ) : (
      <TaskCard key={task.id} {...props} />
    );
  };

  return (
    <>
      {GROUPS.map((group) => {
        const tasks = TASKS.filter((task) => taskGroup(task) === group.id);
        if (tasks.length === 0) return null;
        return (
          <section key={group.id} className="task-group" aria-labelledby={`group-${group.id}`}>
            <div className="group-head">
              <h2 id={`group-${group.id}`} className="group-title">
                {group.title}
              </h2>
              <button
                ref={(el) => {
                  infoButtons.current[group.id] = el;
                }}
                type="button"
                className="btn info-btn"
                aria-label={`About ${group.title} tasks`}
                onClick={() => setOpenInfo(group.id)}
              >
                [?]
              </button>
            </div>
            <div className="grid">{tasks.map(renderCard)}</div>
          </section>
        );
      })}
      {openGroup && <InfoDialog title={openGroup.title} text={openGroup.info} onClose={closeInfo} />}
    </>
  );
}
