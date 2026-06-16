import { describe, it, expect } from 'vitest';
import { parseOfx } from './ofx';

const sample = `OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260205<TRNAMT>-15.00<FITID>A1<MEMO>iFood</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260206120000<TRNAMT>1000.00<FITID>A2<NAME>Salario</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

describe('parseOfx', () => {
  it('extrai transações dos blocos STMTTRN', () => {
    const result = parseOfx(sample);
    expect(result.format).toBe('ofx');
    expect(result.rowCount).toBe(2);
    expect(result.transactions[0]).toMatchObject({
      occurredAt: '2026-02-05',
      amountCents: -1500,
      description: 'iFood',
    });
    expect(result.transactions[1]).toMatchObject({
      occurredAt: '2026-02-06',
      amountCents: 100000,
      description: 'Salario',
    });
  });

  it('usa o dedupHash determinístico', () => {
    expect(parseOfx(sample).transactions[0]?.dedupHash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('extrai FITID como externalId', () => {
    const ofx =
      '<OFX><STMTTRN><DTPOSTED>20260602<TRNAMT>15.00' +
      '<FITID>6a1ed812-0057-447a-ac58-b9bb4ce35866<MEMO>Pix</STMTTRN></OFX>';
    expect(parseOfx(ofx).transactions[0]?.externalId).toBe('6a1ed812-0057-447a-ac58-b9bb4ce35866');
  });
});
