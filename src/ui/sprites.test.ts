import { describe, expect, it } from 'vitest';
import { SPRITES } from './sprites';
import { TASKS } from '../domain/tasks';

describe('SPRITES', () => {
  it.each(TASKS.map((t) => t.id))('%s is a 10×10 map of # and .', (id) => {
    const map = SPRITES[id];
    expect(map).toHaveLength(10);
    for (const row of map) expect(row).toMatch(/^[#.]{10}$/);
  });
});
