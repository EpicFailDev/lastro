import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import * as ui from './index';
import { semantic } from './semantic';

describe('API pública @lastro/ui', () => {
  it('reexporta tokens, temas e utilitários principais', () => {
    expect(ui.color.teal['500']).toBe('#1F7A7D');
    expect(ui.semantic.light['accent']).toBeDefined();
    expect(ui.tokenKeys.length).toBeGreaterThan(0);
    expect(typeof ui.contrastRatio).toBe('function');
    expect(typeof ui.themeCss).toBe('function');
  });
});

const requireCjs = createRequire(import.meta.url);
const preset = requireCjs('../tailwind-preset.cjs') as {
  darkMode: string;
  theme: {
    extend: {
      colors: Record<string, string>;
      spacing: Record<string, string>;
      borderRadius: Record<string, string>;
      boxShadow: Record<string, string>;
    };
  };
};

describe('tailwind-preset', () => {
  it('é class-based e estende cores/espaço/raio/sombra', () => {
    expect(preset.darkMode).toBe('class');
    expect(preset.theme.extend.colors.accent).toBe('var(--accent)');
    expect(preset.theme.extend.spacing['4']).toBe('16px');
    expect(preset.theme.extend.borderRadius.md).toBe('10px');
    expect(preset.theme.extend.boxShadow.md).toContain('rgba');
  });

  it('toda var de cor do preset existe nas css-vars geradas', () => {
    const generated = ui.themeCssVars(semantic.light); // nomes '--xxx'
    const used = Object.values(preset.theme.extend.colors).map((v) =>
      String(v).replace(/^var\((--[^)]+)\)$/, '$1'),
    );
    for (const name of used) expect(generated[name]).toBeDefined();
  });
});
