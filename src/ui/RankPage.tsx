import { useEffect } from 'react';
import { RANKS, getRank, rankSlug, type Rank } from '../domain/ranks';
import { daysInRank, isUnlocked } from '../domain/selectors';
import type { AppState } from '../domain/types';
import { PixelSprite } from './PixelSprite';
import { LOCKED_SPRITE, RANK_LORE, RANK_SPRITES } from './rankContent';

interface RankPageProps {
  state: AppState;
  rank: Rank;
  onNavigate: (hash: string, options?: { replace?: boolean }) => void;
}

const HOME = '#/';
const rankHash = (rank: Rank) => `#/ranks/${rankSlug(rank.title)}`;
const STEP = { replace: true };

export function RankPage({ state, rank, onNavigate }: RankPageProps) {
  const index = RANKS.indexOf(rank);
  const prev = RANKS[index - 1];
  const next = RANKS[index + 1];
  const unlocked = isUnlocked(state, rank.title);
  const isCurrent = getRank(state.points).current === rank;
  const days = daysInRank(state, rank.title);
  const title = rank.title.toUpperCase();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' && prev) onNavigate(rankHash(prev), STEP);
      if (event.key === 'ArrowRight' && next) onNavigate(rankHash(next), STEP);
      if (event.key === 'Escape') onNavigate(HOME);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prev, next, onNavigate]);

  return (
    <section className="rank-page" aria-label={`${rank.title} rank`}>
      <div className="rank-page-top">
        <button type="button" className="btn" onClick={() => onNavigate(HOME)}>
          [ &lt; BACK ]
        </button>
        <span className="meta">
          RANK {index + 1}/{RANKS.length}
        </span>
      </div>
      <div className="rank-page-art">
        <button
          type="button"
          className="btn"
          aria-label="Previous rank"
          disabled={!prev}
          onClick={() => prev && onNavigate(rankHash(prev), STEP)}
        >
          [&lt;]
        </button>
        <PixelSprite
          map={unlocked ? RANK_SPRITES[rank.title] : LOCKED_SPRITE}
          title={unlocked ? rank.title : 'Locked rank'}
          size={200}
          className={unlocked ? 'sprite' : 'sprite sprite-locked'}
        />
        <button
          type="button"
          className="btn"
          aria-label="Next rank"
          disabled={!next}
          onClick={() => next && onNavigate(rankHash(next), STEP)}
        >
          [&gt;]
        </button>
      </div>
      <h2 className="rank-page-title">{title}</h2>
      <p className="meta">{rank.min} PTS+</p>
      {unlocked ? (
        <>
          <p className="lore">{RANK_LORE[rank.title]}</p>
          <p className="rank-days">
            {days === 1 ? 'DAY' : 'DAYS'} AS {title}: {days}
          </p>
          {isCurrent && <p className="current-tag">* CURRENT RANK *</p>}
        </>
      ) : (
        <p className="lore">REACH {rank.min} PTS TO UNLOCK</p>
      )}
    </section>
  );
}
