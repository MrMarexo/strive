import { cadenceLabel } from './format';
import { PixelSprite } from './PixelSprite';
import { IMAGE_LIBRARY } from './images';
import type { CardProps } from './TaskCard';

export function CounterCard({ task, todayCount, remaining, onComplete, onUndo }: CardProps) {
  return (
    <article className="card" aria-label={task.name}>
      <PixelSprite map={IMAGE_LIBRARY[task.image]} title={task.name} />
      <h3>{task.name.toUpperCase()}</h3>
      <p className="sub">{remaining !== null && cadenceLabel(remaining)}</p>
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
