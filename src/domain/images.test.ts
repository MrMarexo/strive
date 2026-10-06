import { describe, expect, it } from 'vitest';
import { MAX_CUSTOM_IMAGES, addImage, deleteImage, imageUsers, isImageKey, isValidMap, updateImage } from './images';
import { seedTasks } from './tasks';
import type { AppState } from './types';

const BLOCK = ['##########', ...Array.from({ length: 9 }, () => '..........')];
const DOT = ['#.........', ...Array.from({ length: 9 }, () => '..........')];
const BLANK = Array.from({ length: 10 }, () => '..........');

function state(over: Partial<AppState> = {}): AppState {
  return {
    version: 1, points: 0, lastSettledDate: '2026-10-05', completions: {}, graceWeek: '2026-09-28',
    weekNumber: 1, playerName: 'no_name', rankDays: {}, tasks: seedTasks('2026-09-28'), customImages: [], ...over,
  };
}

describe('isValidMap', () => {
  it('accepts a 10×10 map with at least one filled pixel', () => {
    expect(isValidMap(BLOCK)).toBe(true);
    expect(isValidMap(BLANK)).toBe(false);
    expect(isValidMap(BLOCK.slice(1))).toBe(false);
    expect(isValidMap([...BLOCK.slice(1), '#########x'])).toBe(false);
    expect(isValidMap('##########')).toBe(false);
  });
});

describe('custom image actions', () => {
  it('adds an image and recognises its key', () => {
    const next = addImage(state(), BLOCK, 'c-0000000a');
    expect(next.customImages).toEqual([{ key: 'c-0000000a', map: BLOCK }]);
    expect(isImageKey(next, 'c-0000000a')).toBe(true);
    expect(isImageKey(next, 'book')).toBe(true);
    expect(isImageKey(next, 'c-ffffffff')).toBe(false);
  });

  it('rejects blank maps, bad or duplicate keys, and more than 100 images', () => {
    const s = state();
    expect(addImage(s, BLANK, 'c-0000000a')).toBe(s);
    expect(addImage(s, BLOCK, 'book')).toBe(s);
    const one = addImage(s, BLOCK, 'c-0000000a');
    expect(addImage(one, DOT, 'c-0000000a')).toBe(one);
    const full = state({
      customImages: Array.from({ length: MAX_CUSTOM_IMAGES }, (_, i) => ({ key: `c-${i.toString(16).padStart(8, '0')}`, map: BLOCK })),
    });
    expect(addImage(full, BLOCK, 'c-ffffffff')).toBe(full);
  });

  it('updates an existing image only', () => {
    const one = addImage(state(), BLOCK, 'c-0000000a');
    expect(updateImage(one, 'c-0000000a', DOT).customImages[0].map).toEqual(DOT);
    expect(updateImage(one, 'c-0000000a', BLANK)).toBe(one);
    expect(updateImage(one, 'c-ffffffff', DOT)).toBe(one);
  });

  it('lists users and blocks deleting an image any task uses', () => {
    const one = addImage(state(), BLOCK, 'c-0000000a');
    expect(deleteImage(one, 'c-0000000a').customImages).toEqual([]);

    const used = {
      ...one,
      tasks: one.tasks.map((t) =>
        t.id === 'reading' ? { ...t, image: 'c-0000000a' } :
        t.id === 'coding' ? { ...t, image: 'c-0000000a', retiresAfter: '2026-10-11' } : t),
    };
    expect(imageUsers(used, 'c-0000000a')).toEqual(['Reading', 'Coding']);
    expect(deleteImage(used, 'c-0000000a')).toBe(used);

    const pendingUser = { ...one, tasks: [{ ...one.tasks[0], image: 'c-0000000a', startsOn: '2026-10-12' }] };
    expect(deleteImage(pendingUser, 'c-0000000a')).toBe(pendingUser);
  });
});
