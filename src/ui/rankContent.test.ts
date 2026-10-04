import { describe, expect, it } from 'vitest';
import { LOCKED_SPRITE, RANK_LORE, RANK_SPRITES } from './rankContent';
import { RANKS } from '../domain/ranks';

function expect20x20(map: string[]) {
  expect(map).toHaveLength(20);
  for (const row of map) expect(row).toMatch(/^[#.]{20}$/);
}

describe('rank content', () => {
  it.each(RANKS.map((r) => r.title))('%s has a 20×20 sprite and lore', (title) => {
    expect20x20(RANK_SPRITES[title]);
    expect(RANK_LORE[title]?.length).toBeGreaterThan(40);
  });

  it('has a 20×20 locked sprite', () => {
    expect20x20(LOCKED_SPRITE);
  });

  it('has no content for titles outside the ladder', () => {
    const titles = RANKS.map((r) => r.title).sort();
    expect(Object.keys(RANK_SPRITES).sort()).toEqual(titles);
    expect(Object.keys(RANK_LORE).sort()).toEqual(titles);
  });
});
