import { describe, expect, it } from 'vitest';
import { commitImport } from './imports';
import { makeFakeClient } from './_fake';

const ACCOUNT = '00000000-0000-0000-0000-0000000000c2';

describe('commitImport', () => {
  it('categoriza via defaultRules, mapeia nome→id e chama a RPC', async () => {
    const { client, rpcCalls } = makeFakeClient({
      tables: {
        category_rules: [],
        categories: [
          { id: 'cat-transporte', name: 'Transporte' },
          { id: 'cat-alimentacao', name: 'Alimentação' },
        ],
      },
      rpcResult: { import_id: 'imp-1', inserted: 2, duplicates: 0 },
    });

    const result = await commitImport(client, {
      accountId: ACCOUNT,
      format: 'csv',
      fileName: 'extrato.csv',
      transactions: [
        { occurredAt: '2026-05-01', amountCents: -1500, description: 'UBER *TRIP', dedupHash: 'h1' },
        { occurredAt: '2026-05-02', amountCents: -3000, description: 'SUSHI BAR', dedupHash: 'h2' },
      ],
    });

    expect(result).toEqual({ importId: 'imp-1', inserted: 2, duplicates: 0 });
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0]!.fn).toBe('commit_import');
    const items = rpcCalls[0]!.args.p_items as Array<{ dedup_hash: string; category_id: string | null }>;
    expect(items.find((i) => i.dedup_hash === 'h1')!.category_id).toBe('cat-transporte');
    expect(items.find((i) => i.dedup_hash === 'h2')!.category_id).toBe('cat-alimentacao');
  });

  it('category_id = null quando nenhuma regra casa', async () => {
    const { client, rpcCalls } = makeFakeClient({
      tables: { category_rules: [], categories: [] },
      rpcResult: { import_id: 'imp-2', inserted: 1, duplicates: 0 },
    });
    await commitImport(client, {
      accountId: ACCOUNT,
      format: 'csv',
      transactions: [
        { occurredAt: '2026-05-01', amountCents: -100, description: 'XYZ DESCONHECIDO', dedupHash: 'h9' },
      ],
    });
    const items = rpcCalls[0]!.args.p_items as Array<{ category_id: string | null }>;
    expect(items[0]!.category_id).toBeNull();
  });
});
