import { describe, expect, it } from 'vitest';
import { CHECK, IMAGE_LIBRARY } from './images';
import { IMAGE_KEYS } from '../domain/imageKeys';

describe('image library', () => {
  it('has the 24 keys in picker order', () => {
    expect(IMAGE_KEYS).toHaveLength(24);
    expect(IMAGE_KEYS.slice(0, 8)).toEqual(['book', 'laptop', 'shoe', 'dumbbell', 'shield', 'knight', 'broom', 'speech']);
    expect(Object.keys(IMAGE_LIBRARY)).toEqual([...IMAGE_KEYS]);
  });

  it.each([...IMAGE_KEYS])('%s is a 10×10 map of # and .', (key) => {
    const map = IMAGE_LIBRARY[key];
    expect(map).toHaveLength(10);
    for (const row of map) expect(row).toMatch(/^[#.]{10}$/);
  });

  it('keeps the 7×5 checkmark', () => {
    expect(CHECK).toHaveLength(5);
    for (const row of CHECK) expect(row).toMatch(/^[#.]{7}$/);
  });
});
