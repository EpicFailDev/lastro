import { describe, it, expect } from 'vitest';
import { semantic } from './semantic';
import { tokenKeys } from './themes';

const HEX = /^#[0-9A-F]{6}$/;

describe('tokens semânticos', () => {
  it('light e dark têm exatamente as mesmas chaves', () => {
    const l = Object.keys(semantic.light).sort();
    const d = Object.keys(semantic.dark).sort();
    expect(l).toEqual(d);
  });

  it('tokenKeys cobre todas as chaves do tema', () => {
    expect([...tokenKeys].sort()).toEqual(Object.keys(semantic.light).sort());
  });

  it('todo valor resolve para um hex válido nos dois temas', () => {
    for (const theme of [semantic.light, semantic.dark]) {
      for (const v of Object.values(theme)) expect(v).toMatch(HEX);
    }
  });

  it('accent (coral) difere de amount.negative (vermelho)', () => {
    expect(semantic.light.accent).not.toBe(semantic.light['amount.negative']);
  });
});
