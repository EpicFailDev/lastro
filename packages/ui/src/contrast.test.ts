import { describe, it, expect } from 'vitest';
import { contrastRatio } from './contrast';
import { semantic } from './semantic';

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

describe('contraste dos pares semânticos (WCAG AA)', () => {
  const themes = [
    ['light', semantic.light],
    ['dark', semantic.dark],
  ] as const;

  for (const [name, t] of themes) {
    const backgrounds = [t['bg.surface'], t['bg.canvas'], t['bg.subtle']];

    it(`${name}: text.primary >= 4.5 sobre todos os fundos`, () => {
      for (const bg of backgrounds) {
        expect(contrastRatio(t['text.primary'], bg)).toBeGreaterThanOrEqual(4.5);
      }
    });

    it(`${name}: text.muted >= 4.5 sobre todos os fundos`, () => {
      for (const bg of backgrounds) {
        expect(contrastRatio(t['text.muted'], bg)).toBeGreaterThanOrEqual(4.5);
      }
    });

    it(`${name}: text.onAccent >= 4.5 sobre accent`, () => {
      expect(contrastRatio(t['text.onAccent'], t['accent'])).toBeGreaterThanOrEqual(4.5);
    });

    it(`${name}: valores (positivo/negativo) >= 3 sobre surface`, () => {
      expect(contrastRatio(t['amount.positive'], t['bg.surface'])).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(t['amount.negative'], t['bg.surface'])).toBeGreaterThanOrEqual(3);
    });
  }
});
