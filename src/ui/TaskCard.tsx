import type { MouseEvent } from 'react';
import type { TaskDef, TaskStatus } from '../domain/tasks';
import { cadenceLabel } from './format';
import { CHECK } from './images';
import { PixelSprite } from './PixelSprite';

export interface CardProps {
  task: TaskDef;
  sprite: string[]; // resolved image map
  status: TaskStatus;
  todayCount: number;
  remaining: number | null;
  willMiss: number;
  onComplete: () => void;
  onUndo: () => void;
  onInfo: (event: MouseEvent<HTMLButtonElement>) => void;
  onEdit: (event: MouseEvent<HTMLButtonElement>) => void;
}

export function CardTop({ task, onInfo, onEdit }: Pick<CardProps, 'task' | 'onInfo' | 'onEdit'>) {
  return (
    <div className="card-tools">
      <button type="button" className="btn tool-btn" aria-label={`About ${task.name}`} onClick={onInfo}>
        [?]
      </button>
      <button type="button" className="btn tool-btn" aria-label={`Edit ${task.name}`} onClick={onEdit}>
        [...]
      </button>
    </div>
  );
}

export function CardSubtitle({ status, remaining, willMiss }: Pick<CardProps, 'status' | 'remaining' | 'willMiss'>) {
  const parts: string[] = [];
  if (remaining !== null) parts.push(cadenceLabel(remaining));
  if (status === 'retiring') parts.push('RETIRES SUNDAY');
  return (
    <p className="sub">
      {parts.join(' · ')}
      {willMiss > 0 && <span className="risk"> · WILL MISS {willMiss}</span>}
    </p>
  );
}

export function TaskCard({ task, sprite, status, todayCount, remaining, willMiss, onComplete, onUndo, onInfo, onEdit }: CardProps) {
  const done = todayCount > 0;
  return (
    <article className={status === 'pending' ? 'card card-pending' : 'card'} aria-label={task.name}>
      <CardTop task={task} onInfo={onInfo} onEdit={onEdit} />
      <PixelSprite map={sprite} title={task.name} />
      <h3>{task.name.toUpperCase()}</h3>
      <CardSubtitle status={status} remaining={remaining} willMiss={willMiss} />
      {status === 'pending' ? (
        <p className="starts">STARTS MON</p>
      ) : (
        <button
          type="button"
          className={done ? 'btn btn-done' : 'btn'}
          aria-pressed={done}
          onClick={done ? onUndo : onComplete}
        >
          {done ? (
            <>
              [ DONE <PixelSprite map={CHECK} size={21} className="check" /> ]
            </>
          ) : (
            '[ MARK DONE ]'
          )}
        </button>
      )}
    </article>
  );
}
