import type { DateKey } from '../domain/dates';
import { isAtRisk, remainingThisWeek, todayCount } from '../domain/selectors';
import { TASKS, type TaskId } from '../domain/tasks';
import type { AppState } from '../domain/types';
import { CounterCard } from './CounterCard';
import { TaskCard, type CardProps } from './TaskCard';

interface TaskGridProps {
  state: AppState;
  today: DateKey;
  onComplete: (id: TaskId) => void;
  onUndo: (id: TaskId) => void;
}

export function TaskGrid({ state, today, onComplete, onUndo }: TaskGridProps) {
  return (
    <section className="grid">
      {TASKS.map((task) => {
        const props: CardProps = {
          task,
          todayCount: todayCount(state, task.id, today),
          remaining: remainingThisWeek(state, task, today),
          atRisk: isAtRisk(state, task, today),
          onComplete: () => onComplete(task.id),
          onUndo: () => onUndo(task.id),
        };
        return task.maxPerDay === null ? (
          <CounterCard key={task.id} {...props} />
        ) : (
          <TaskCard key={task.id} {...props} />
        );
      })}
    </section>
  );
}
