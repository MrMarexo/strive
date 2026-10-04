import type { DateKey } from '../domain/dates';
import { getRank } from '../domain/ranks';
import { barCells, formatWeekOf } from './format';

interface HeaderProps {
  points: number;
  pending: number;
  weekStart: DateKey;
}

export function Header({ points, pending, weekStart }: HeaderProps) {
  const { current, next, progress, toNext } = getRank(points);
  const { filled, empty } = barCells(progress);

  return (
    <header className="header">
      <div className="header-top">
        <h1 className="rank">
          {current.title.toUpperCase()}
          <span className="cursor" aria-hidden="true">▮</span>
        </h1>
        <div className="points">{points} PTS</div>
      </div>
      <div className="bar">
        <span className="bar-cells" aria-hidden="true">
          <span className="bar-fill">{'▓'.repeat(filled)}</span>
          <span className="bar-empty">{'░'.repeat(empty)}</span>
        </span>
        <span>{next ? `${toNext} TO ${next.title.toUpperCase()}` : 'MAX RANK'}</span>
      </div>
      <div className="meta">
        TODAY: +{pending} PENDING · WEEK OF {formatWeekOf(weekStart)}
      </div>
    </header>
  );
}
