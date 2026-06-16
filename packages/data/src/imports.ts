import { categorize, defaultRules, type CategoryRule } from '@lastro/categorizer';
import type { DataClient } from './client';
import { unwrap } from './errors';
import { commitImportInputSchema, type CommitImportInput, type CommitImportResult } from './types';

/** Importa um lote de transações: categoriza em TS e grava via RPC atômica. */
export async function commitImport(
  c: DataClient,
  input: CommitImportInput,
): Promise<CommitImportResult> {
  const parsed = commitImportInputSchema.parse(input);

  const ruleRows = unwrap(await c.from('category_rules').select('*')) as Array<{
    match_type: string;
    pattern: string;
    category_id: string;
    weight: number;
  }>;
  const categories = unwrap(await c.from('categories').select('id, name')) as Array<{
    id: string;
    name: string;
  }>;

  const nameById = new Map(categories.map((r) => [r.id, r.name]));
  const idByName = new Map(categories.map((r) => [r.name, r.id]));

  const userRules: CategoryRule[] = ruleRows.flatMap((r) => {
    const name = nameById.get(r.category_id);
    return name
      ? [
          {
            matchType: r.match_type as CategoryRule['matchType'],
            pattern: r.pattern,
            category: name,
            weight: r.weight,
          },
        ]
      : [];
  });
  const rules = [...userRules, ...defaultRules];

  const items = parsed.transactions.map((t) => {
    const { category } = categorize(t.description, rules);
    return {
      amount_cents: t.amountCents,
      description: t.description,
      occurred_at: t.occurredAt,
      dedup_hash: t.dedupHash,
      category_id: category ? (idByName.get(category) ?? null) : null,
    };
  });

  const res = await c.rpc('commit_import', {
    p_account_id: parsed.accountId,
    p_format: parsed.format,
    p_file_name: parsed.fileName ?? null,
    p_items: items,
  } as Parameters<typeof c.rpc>[1]);
  const out = unwrap(res) as { import_id: string; inserted: number; duplicates: number };
  return { importId: out.import_id, inserted: out.inserted, duplicates: out.duplicates };
}
