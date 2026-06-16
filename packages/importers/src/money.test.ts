import { describe, it, expect } from 'vitest';
import { parseAmountToCents } from './money';

describe('parseAmountToCents', () => {
  it('valor BR com vírgula decimal', () => {
    expect(parseAmountToCents('1.234,56', ',')).toBe(123456);
  });
  it('valor com símbolo e espaços', () => {
    expect(parseAmountToCents('R$ 12,34', ',')).toBe(1234);
  });
  it('negativo explícito', () => {
    expect(parseAmountToCents('-5,00', ',')).toBe(-500);
  });
  it('parênteses significam negativo', () => {
    expect(parseAmountToCents('(7,50)', ',')).toBe(-750);
  });
  it('ponto decimal (en-US)', () => {
    expect(parseAmountToCents('1234.56', '.')).toBe(123456);
  });
  it('arredonda meio centavo', () => {
    expect(parseAmountToCents('0,005', ',')).toBe(1);
  });
});
