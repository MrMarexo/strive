import type { TaskDef } from '../domain/tasks';
import { cadenceLabel } from './format';
import { PixelSprite } from './PixelSprite';
import { SPRITES } from './sprites';

export interface CardProps {
  task: TaskDef;
  todayCount: number;
  remaining: number | null;
  atRisk: boolean;
  onComplete: () => void;
  onUndo: () => void;
}

export function TaskCard({ task, todayCount, remaining, atRisk, onComplete, onUndo }: CardProps) {
  const done = todayCount > 0;
  return (
    <article className="card" aria-label={task.name}>
      <PixelSprite map={SPRITES[task.id]} title={task.name} />
      <h2>{task.name.toUpperCase()}</h2>
      <p className="sub">
        {cadenceLabel(remaining)}
        {atRisk && <span className="risk"> · AT RISK</span>}
      </p>
      <button
        type="button"
        className={done ? 'btn btn-done' : 'btn'}
        aria-pressed={done}
        onClick={done ? onUndo : onComplete}
      >
        {done ? '[ DONE ✓ ]' : '[ MARK DONE ]'}
      </button>
    </article>
  );
}
