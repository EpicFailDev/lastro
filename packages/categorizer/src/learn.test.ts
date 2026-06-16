import { describe, it, expect } from 'vitest';
import { suggestRuleFromCorrection } from './learn';
import { categorize } from './categorize';

describe('suggestRuleFromCorrection', () => {
  it('cria regra contains de peso alto a partir da correção', () => {
    const rule = suggestRuleFromCorrection(
      'Pagamento com QR Pix ZHU PASTELARIA LTDA',
      'Alimentação',
    );
    expect(rule.matchType).toBe('contains');
    expect(rule.category).toBe('Alimentação');
    expect(rule.weight).toBeGreaterThan(1);
    expect(rule.pattern).toContain('zhu');
  });

  it('a regra gerada classifica a mesma descrição', () => {
    const desc = 'Pagamento com QR Pix ZHU PASTELARIA LTDA';
    const rule = suggestRuleFromCorrection(desc, 'Alimentação');
    expect(categorize(desc, [rule]).category).toBe('Alimentação');
  });

  it('remove prefixos de transferência e sufixos de empresa', () => {
    const rule = suggestRuleFromCorrection('Pix enviado Hns Representacoes Ltda', 'Outros');
    expect(rule.pattern).toBe('hns representacoes');
  });

  it('descrição vazia após limpeza lança erro', () => {
    expect(() => suggestRuleFromCorrection('Pix enviado', 'Outros')).toThrow();
  });
});
