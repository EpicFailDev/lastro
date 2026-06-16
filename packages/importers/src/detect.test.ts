import { describe, it, expect } from 'vitest';
import { detectAndParse } from './detect';
import type { CsvTemplate } from './types';

const csvTemplate: CsvTemplate = {
  name: 'teste',
  delimiter: ';',
  dateColumn: 'Data',
  amountColumn: 'Valor',
  descriptionColumn: 'Descrição',
  dateFormat: 'dd/mm/yyyy',
  decimalSeparator: ',',
};

describe('detectAndParse', () => {
  it('detecta OFX pelo conteúdo', () => {
    const ofx = '<OFX><STMTTRN><DTPOSTED>20260205<TRNAMT>-15.00<MEMO>iFood</STMTTRN></OFX>';
    const result = detectAndParse(ofx, {});
    expect(result.format).toBe('ofx');
    expect(result.rowCount).toBe(1);
  });

  it('usa o template de CSV quando informado', () => {
    const csv = 'Data;Valor;Descrição\n05/02/2026;-15,00;iFood\n';
    const result = detectAndParse(csv, { csvTemplate });
    expect(result.format).toBe('csv');
    expect(result.transactions[0]?.amountCents).toBe(-1500);
  });

  it('erro claro se for CSV sem template', () => {
    const csv = 'Data;Valor;Descrição\n05/02/2026;-15,00;iFood\n';
    expect(() => detectAndParse(csv, {})).toThrow(/template/i);
  });
});
