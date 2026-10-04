import { cadenceLabel } from './format';
import { PixelSprite } from './PixelSprite';
import { SPRITES } from './sprites';
import type { CardProps } from './TaskCard';

export function CounterCard({ task, todayCount, remaining, onComplete, onUndo }: CardProps) {
  return (
    <article className="card" aria-label={task.name}>
      <PixelSprite map={SPRITES[task.id]} title={task.name} />
      <h2>{task.name.toUpperCase()}</h2>
      <p className="sub">{cadenceLabel(remaining)}</p>
      <div className="counter">
        <button
          type="button"
          className="btn"
          aria-label={`Remove one ${task.name}`}
          disabled={todayCount === 0}
          onClick={onUndo}
        >
          [-]
        </button>
        <span className="count">{todayCount}</span>
        <button type="button" className="btn" aria-label={`Add one ${task.name}`} onClick={onComplete}>
          [+]
        </button>
      </div>
    </article>
  );
}
