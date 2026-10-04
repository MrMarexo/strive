export interface Rank {
  title: string;
  min: number;
}

export const RANKS: Rank[] = [
  { title: 'Beggar', min: 0 },
  { title: 'Peasant', min: 5 },
  { title: 'Stable Hand', min: 15 },
  { title: 'Squire', min: 30 },
  { title: 'Man-at-Arms', min: 50 },
  { title: 'Knight', min: 75 },
  { title: 'Ranger', min: 105 },
  { title: 'Battlemage', min: 140 },
  { title: 'Lord', min: 180 },
  { title: 'Paladin', min: 225 },
  { title: 'Archmage', min: 275 },
  { title: 'Dragon Slayer', min: 330 },
  { title: 'King', min: 390 },
  { title: 'Wizard of the White Order', min: 460 },
  { title: 'Legend of the Realm', min: 550 },
];

export interface RankInfo {
  current: Rank;
  next: Rank | null;
  progress: number; // 0..1 from current.min to next.min
  toNext: number;
}

export function getRank(points: number): RankInfo {
  let index = 0;
  for (let i = 0; i < RANKS.length; i++) {
    if (points >= RANKS[i].min) index = i;
  }
  const current = RANKS[index];
  const next = RANKS[index + 1] ?? null;
  if (!next) return { current, next: null, progress: 1, toNext: 0 };
  return {
    current,
    next,
    progress: (points - current.min) / (next.min - current.min),
    toNext: next.min - points,
  };
}

export function rankSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function rankBySlug(slug: string): Rank | undefined {
  return RANKS.find((rank) => rankSlug(rank.title) === slug);
}
