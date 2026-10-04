import { getRank } from '../domain/ranks';
import { barCells } from './format';
import { PlayerName } from './PlayerName';

interface HeaderProps {
  playerName: string;
  points: number;
  pending: number;
  weekNumber: number;
  onRename: (name: string) => void;
}

export function Header({ playerName, points, pending, weekNumber, onRename }: HeaderProps) {
  const { current, next, progress, toNext } = getRank(points);
  const { filled, empty } = barCells(progress);

  return (
    <header className="header">
      <div className="header-top">
        <div className="identity">
          <PlayerName name={playerName} onRename={onRename} />
          <div className="rank">{current.title.toUpperCase()}</div>
        </div>
        <div className="score">
          <div className="points">{points} PTS</div>
          <div className="pending">+{pending} PENDING</div>
        </div>
      </div>
      <div className="bar">
        <span className="bar-cells" aria-hidden="true">
          <span className="bar-fill">{'▓'.repeat(filled)}</span>
          <span className="bar-empty">{'░'.repeat(empty)}</span>
        </span>
        <span>{next ? `${toNext} TO ${next.title.toUpperCase()}` : 'MAX RANK'}</span>
      </div>
      <div className="meta">WEEK {weekNumber}</div>
    </header>
  );
}
