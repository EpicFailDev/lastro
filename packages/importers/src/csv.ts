import Papa from 'papaparse';
import type { CsvTemplate, ImportResult, ParsedTransaction } from './types';
import { parseAmountToCents } from './money';
import { parseStatementDate } from './dates';
import { makeDedupHash } from './dedup';

export function parseCsv(content: string, template: CsvTemplate): ImportResult {
  const parsed = Papa.parse<Record<string, string>>(content.trim(), {
    header: true,
    delimiter: template.delimiter ?? ',',
    skipEmptyLines: true,
  });

  const rows = parsed.data;
  const transactions: ParsedTransaction[] = rows.map((row, i) => {
    for (const col of [template.dateColumn, template.amountColumn, template.descriptionColumn]) {
      if (!(col in row)) {
        throw new Error(`Coluna "${col}" não encontrada no CSV (linha ${i + 1})`);
      }
    }
    const occurredAt = parseStatementDate(row[template.dateColumn]!, template.dateFormat);
    let amountCents = parseAmountToCents(row[template.amountColumn]!, template.decimalSeparator);
    if (template.invertSign) amountCents = -amountCents;
    const description = (row[template.descriptionColumn] ?? '').trim();
    const externalId = template.idColumn ? row[template.idColumn]?.trim() || undefined : undefined;
    return {
      occurredAt,
      amountCents,
      description,
      dedupHash: makeDedupHash({ occurredAt, amountCents, description }),
      externalId,
    };
  });

  return { format: 'csv', transactions, rowCount: transactions.length };
}
