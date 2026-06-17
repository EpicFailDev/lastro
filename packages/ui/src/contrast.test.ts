import { describe, it, expect } from 'vitest';
import { contrastRatio } from './contrast';

describe('contrastRatio', () => {
  it('preto sobre branco é 21:1', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
  });

  it('mesma cor é 1:1', () => {
    expect(contrastRatio('#1F7A7D', '#1F7A7D')).toBeCloseTo(1, 5);
  });

  it('é simétrico (ordem não importa)', () => {
    const a = contrastRatio('#141A1A', '#FFFFFF');
    const b = contrastRatio('#FFFFFF', '#141A1A');
    expect(a).toBeCloseTo(b, 5);
  });
});
