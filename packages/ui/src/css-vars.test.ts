import { describe, it, expect } from 'vitest';
import { cssVarName, themeCssVars, themeCss } from './css-vars';
import { semantic } from './semantic';

describe('css-vars', () => {
  it('cssVarName troca pontos por hífen e prefixa --', () => {
    expect(cssVarName('text.primary')).toBe('--text-primary');
    expect(cssVarName('bg.surface')).toBe('--bg-surface');
  });

  it('themeCssVars cobre todos os tokens do tema', () => {
    const vars = themeCssVars(semantic.light);
    expect(Object.keys(vars)).toHaveLength(Object.keys(semantic.light).length);
    expect(vars['--text-primary']).toBe(semantic.light['text.primary']);
  });

  it('themeCss inclui blocos :root e .dark com as variáveis', () => {
    const css = themeCss();
    expect(css).toContain(':root {');
    expect(css).toContain('.dark {');
    expect(css).toContain(`--accent: ${semantic.light.accent};`);
    expect(css).toContain(`--accent: ${semantic.dark.accent};`);
  });
});
