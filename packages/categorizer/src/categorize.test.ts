import { describe, it, expect } from 'vitest';
import { categorize } from './categorize';
import { defaultRules } from './rules';
import type { CategoryRule } from './types';

describe('categorize', () => {
  it('Uber → Transporte', () => {
    expect(
      categorize('Pagamento com QR Pix UBER DO BRASIL TECNOLOGIA LTDA.', defaultRules).category,
    ).toBe('Transporte');
  });
  it('Sushi → Alimentação', () => {
    expect(categorize('Pagamento com QR Pix OSHENT SUSHI LTDA', defaultRules).category).toBe(
      'Alimentação',
    );
  });
  it('Rendimentos → Renda', () => {
    expect(categorize('Rendimentos', defaultRules).category).toBe('Renda');
  });
  it('Claro → Contas', () => {
    expect(categorize('Pagamento Claro', defaultRules).category).toBe('Contas');
  });
  it('sem regra → null', () => {
    expect(categorize('Pix enviado Jenifer Fernanda Rojas', defaultRules).category).toBeNull();
  });
  it('regra de maior peso vence', () => {
    const userRule: CategoryRule = {
      matchType: 'contains',
      pattern: 'jenifer',
      category: 'Outros',
      weight: 10,
    };
    expect(
      categorize('Pix enviado Jenifer Fernanda Rojas', [...defaultRules, userRule]).category,
    ).toBe('Outros');
  });
  it('equals exige igualdade exata (normalizada)', () => {
    const rule: CategoryRule = {
      matchType: 'equals',
      pattern: 'rendimentos',
      category: 'Renda',
      weight: 5,
    };
    expect(categorize('Rendimentos', [rule]).category).toBe('Renda');
    expect(categorize('Rendimentos do mês', [rule]).category).toBeNull();
  });
  it('regex funciona', () => {
    const rule: CategoryRule = {
      matchType: 'regex',
      pattern: 'uber|99|cabify',
      category: 'Transporte',
      weight: 5,
    };
    expect(categorize('viagem 99 app', [rule]).category).toBe('Transporte');
  });
});
