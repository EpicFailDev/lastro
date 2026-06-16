import { describe, it, expect } from 'vitest';
import { parseCsv } from './csv';
import type { CsvTemplate } from './types';

const template: CsvTemplate = {
  name: 'teste',
  dateColumn: 'Data',
  amountColumn: 'Valor',
  descriptionColumn: 'Descrição',
  dateFormat: 'dd/mm/yyyy',
  decimalSeparator: ',',
};

describe('parseCsv', () => {
  it('extrai transações normalizadas', () => {
    const content =
      'Data,Valor,Descrição\n' + '05/02/2026,"-15,00",iFood\n' + '06/02/2026,"1.000,00",Salário\n';
    const result = parseCsv(content, template);
    expect(result.format).toBe('csv');
    expect(result.rowCount).toBe(2);
    expect(result.transactions[0]).toMatchObject({
      occurredAt: '2026-02-05',
      amountCents: -1500,
      description: 'iFood',
    });
    expect(result.transactions[1]?.amountCents).toBe(100000);
    expect(result.transactions[0]?.dedupHash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('invertSign transforma despesa positiva em negativa', () => {
    const t = { ...template, invertSign: true };
    const content = 'Data,Valor,Descrição\n05/02/2026,"15,00",Compra\n';
    expect(parseCsv(content, t).transactions[0]?.amountCents).toBe(-1500);
  });

  it('ignora linhas em branco', () => {
    const content = 'Data,Valor,Descrição\n05/02/2026,"-1,00",A\n\n';
    expect(parseCsv(content, template).rowCount).toBe(1);
  });

  it('lança erro se faltar coluna mapeada', () => {
    const content = 'Data,Outra,Descrição\n05/02/2026,"-1,00",A\n';
    expect(() => parseCsv(content, template)).toThrow(/Valor/);
  });
});
