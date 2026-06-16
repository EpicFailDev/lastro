import type { ImportResult, ParsedTransaction } from './types';
import { parseAmountToCents } from './money';
import { makeDedupHash } from './dedup';

/** Lê o valor de uma tag SGML simples (<TAG>valor) de dentro de um bloco. */
function tag(block: string, name: string): string | undefined {
  const m = new RegExp(`<${name}>([^<\r\n]*)`, 'i').exec(block);
  return m ? m[1]!.trim() : undefined;
}

/** Converte DTPOSTED (YYYYMMDD[hhmmss]) para 'YYYY-MM-DD'. */
function ofxDate(raw: string): string {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(raw.trim());
  if (!m) throw new Error(`DTPOSTED inválido: "${raw}"`);
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export function parseOfx(content: string): ImportResult {
  const blocks = content.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? [];
  const transactions: ParsedTransaction[] = blocks.map((block) => {
    const dtposted = tag(block, 'DTPOSTED');
    const trnamt = tag(block, 'TRNAMT');
    if (!dtposted || !trnamt) {
      throw new Error('Bloco STMTTRN sem DTPOSTED ou TRNAMT');
    }
    const occurredAt = ofxDate(dtposted);
    const amountCents = parseAmountToCents(trnamt, '.');
    const description = (tag(block, 'MEMO') ?? tag(block, 'NAME') ?? '').trim();
    const externalId = tag(block, 'FITID');
    return {
      occurredAt,
      amountCents,
      description,
      dedupHash: makeDedupHash({ occurredAt, amountCents, description }),
      externalId,
    };
  });

  return { format: 'ofx', transactions, rowCount: transactions.length };
}
