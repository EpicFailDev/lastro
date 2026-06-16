import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { commitImportMutation, updateTransactionCategoryMutation } from './mutations';
import { makeFakeClient } from './_fake';
import type { CommitImportResult } from './types';

describe('mutations', () => {
  it('commitImportMutation invalida transactions no sucesso', async () => {
    const { client } = makeFakeClient({
      tables: { category_rules: [], categories: [] },
      rpcResult: { import_id: 'imp-1', inserted: 1, duplicates: 0 },
    });
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const opts = commitImportMutation(client, qc);

    const fn = opts.mutationFn as (v: unknown) => Promise<CommitImportResult>;
    const res = await fn({
      accountId: '00000000-0000-0000-0000-0000000000c2',
      format: 'csv',
      transactions: [
        { occurredAt: '2026-05-01', amountCents: -100, description: 'X', dedupHash: 'h1' },
      ],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onSuccess = opts.onSuccess as ((d: unknown, v: unknown, c: unknown) => void) | undefined;
    await onSuccess?.(res, {}, {});

    expect(res.inserted).toBe(1);
    expect(spy).toHaveBeenCalledWith({ queryKey: ['transactions'] });
  });

  it('updateTransactionCategoryMutation chama update na tabela', async () => {
    const { client, updateCalls } = makeFakeClient({ tables: { transactions: [] } });
    const qc = new QueryClient();
    const opts = updateTransactionCategoryMutation(client, qc);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fn2 = opts.mutationFn as (v: unknown) => Promise<void>;
    await fn2({ id: 't1', categoryId: 'cat-1' });
    expect(updateCalls).toContainEqual({
      table: 'transactions',
      values: { category_id: 'cat-1' },
      eqId: 't1',
    });
  });
});
