import { IMAGE_LIBRARY } from './images';
import { PixelSprite } from './PixelSprite';
import { CardSubtitle, CardTop, type CardProps } from './TaskCard';

export function CounterCard({ task, status, todayCount, remaining, willMiss, onComplete, onUndo, onInfo, onEdit }: CardProps) {
  return (
    <article className={status === 'pending' ? 'card card-pending' : 'card'} aria-label={task.name}>
      <CardTop task={task} onInfo={onInfo} onEdit={onEdit} />
      <PixelSprite map={IMAGE_LIBRARY[task.image]} title={task.name} />
      <h3>{task.name.toUpperCase()}</h3>
      <CardSubtitle status={status} remaining={remaining} willMiss={willMiss} />
      {status === 'pending' ? (
        <p className="starts">STARTS MON</p>
      ) : (
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
      )}
    </article>
  );
}
