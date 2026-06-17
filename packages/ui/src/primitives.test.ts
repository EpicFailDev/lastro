import { describe, it, expect } from 'vitest';
import { color, space, radius, fontSize } from './primitives';

const HEX = /^#[0-9A-F]{6}$/;

describe('primitives', () => {
  it('toda cor é hex #RRGGBB maiúsculo', () => {
    const all = [
      ...Object.values(color.teal),
      ...Object.values(color.aqua),
      ...Object.values(color.coral),
      ...Object.values(color.neutral),
      ...Object.values(color.feedback),
    ];
    expect(all.length).toBeGreaterThan(0);
    for (const c of all) expect(c).toMatch(HEX);
  });

  it('tem a base teal-500 da marca', () => {
    expect(color.teal['500']).toBe('#1F7A7D');
  });

  it('escalas numéricas são positivas e fontSize traz [size, lineHeight]', () => {
    expect(space['4']).toBe(16);
    expect(radius.md).toBe(10);
    expect(fontSize.base).toEqual([16, 24]);
  });
});
