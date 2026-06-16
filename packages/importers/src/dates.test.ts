import { describe, it, expect } from 'vitest';
import { parseStatementDate } from './dates';

describe('parseStatementDate', () => {
  it('dd/mm/yyyy', () => {
    expect(parseStatementDate('05/02/2026', 'dd/mm/yyyy')).toBe('2026-02-05');
  });
  it('yyyy-mm-dd (passa direto)', () => {
    expect(parseStatementDate('2026-02-05', 'yyyy-mm-dd')).toBe('2026-02-05');
  });
  it('dd/mm/yyyy com dia/mês de 1 dígito', () => {
    expect(parseStatementDate('5/2/2026', 'dd/mm/yyyy')).toBe('2026-02-05');
  });
  it('data inválida lança erro', () => {
    expect(() => parseStatementDate('xx/yy/zzzz', 'dd/mm/yyyy')).toThrow();
  });
  it('parseia dd-mm-yyyy (Mercado Pago)', () => {
    expect(parseStatementDate('02-06-2026', 'dd-mm-yyyy')).toBe('2026-06-02');
  });
});
