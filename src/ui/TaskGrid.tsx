import type { DateKey } from '../domain/dates';
import { remainingThisWeek, todayCount, willMiss } from '../domain/selectors';
import { TASKS, taskGroup, type TaskDef, type TaskGroup, type TaskId } from '../domain/tasks';
import type { AppState } from '../domain/types';
import { CounterCard } from './CounterCard';
import { TaskCard, type CardProps } from './TaskCard';

interface TaskGridProps {
  state: AppState;
  today: DateKey;
  onComplete: (id: TaskId) => void;
  onUndo: (id: TaskId) => void;
}

const GROUPS: { id: TaskGroup; title: string; hint: string }[] = [
  { id: 'daily', title: 'DAILY', hint: 'EVERY DAY · +1 WHEN DONE · -2 IF MISSED' },
  { id: 'weekly', title: 'WEEKLY', hint: 'ONCE A DAY AT MOST · +1 EACH · -2 PER SESSION SHORT ON SUNDAY' },
  {
    id: 'weekly-unlimited',
    title: 'WEEKLY · NO DAY LIMIT',
    hint: 'AS MANY A DAY AS YOU LIKE · +1 EACH UP TO TARGET · -2 PER SESSION SHORT ON SUNDAY',
  },
];

export function TaskGrid({ state, today, onComplete, onUndo }: TaskGridProps) {
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
            <h2 id={`group-${group.id}`} className="group-title">
              {group.title}
            </h2>
            <p className="group-hint">{group.hint}</p>
            <div className="grid">{tasks.map(renderCard)}</div>
          </section>
        );
      })}
    </>
  );
}
