import { describe, it, expect } from 'vitest';
import { formatMoney } from './money';

describe('formatMoney', () => {
  it('formata centavos como reais', () => {
    expect(formatMoney(12345)).toBe('R$ 123,45');
  });

  it('formata zero', () => {
    expect(formatMoney(0)).toBe('R$ 0,00');
  });

  it('formata valores negativos (despesa)', () => {
    expect(formatMoney(-500)).toBe('-R$ 5,00');
  });
});
