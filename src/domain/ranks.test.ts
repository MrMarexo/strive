import { describe, expect, it } from 'vitest';
import { RANKS, getRank, rankBySlug, rankSlug } from './ranks';

describe('ranks', () => {
  it('has 15 ascending ranks from Beggar at 0 to Legend of the Realm at 550', () => {
    expect(RANKS).toHaveLength(15);
    expect(RANKS[0]).toEqual({ title: 'Beggar', min: 0 });
    expect(RANKS[14]).toEqual({ title: 'Legend of the Realm', min: 550 });
    for (let i = 1; i < RANKS.length; i++) {
      expect(RANKS[i].min).toBeGreaterThan(RANKS[i - 1].min);
    }
  });

  it('starts at Beggar', () => {
    expect(getRank(0)).toEqual({ current: RANKS[0], next: RANKS[1], progress: 0, toNext: 5 });
  });

  it('promotes exactly at the threshold', () => {
    expect(getRank(4).current.title).toBe('Beggar');
    expect(getRank(5).current.title).toBe('Peasant');
  });

  it('computes progress toward the next rank', () => {
    const info = getRank(80);
    expect(info.current.title).toBe('Knight');
    expect(info.next?.title).toBe('Ranger');
    expect(info.toNext).toBe(25);
    expect(info.progress).toBeCloseTo(5 / 30);
  });

  it('caps at the top rank', () => {
    for (const points of [550, 9999]) {
      const info = getRank(points);
      expect(info.current.title).toBe('Legend of the Realm');
      expect(info.next).toBeNull();
      expect(info.progress).toBe(1);
      expect(info.toNext).toBe(0);
    }
  });

  it('builds URL slugs from titles', () => {
    expect(rankSlug('Beggar')).toBe('beggar');
    expect(rankSlug('Man-at-Arms')).toBe('man-at-arms');
    expect(rankSlug('Wizard of the White Order')).toBe('wizard-of-the-white-order');
  });

  it('gives every rank a unique slug that maps back to it', () => {
    const slugs = RANKS.map((r) => rankSlug(r.title));
    expect(new Set(slugs).size).toBe(RANKS.length);
    for (const rank of RANKS) expect(rankBySlug(rankSlug(rank.title))).toBe(rank);
  });

  it('returns undefined for an unknown slug', () => {
    expect(rankBySlug('emperor')).toBeUndefined();
  });
});
