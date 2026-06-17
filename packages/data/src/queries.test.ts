import { describe, expect, it } from 'vitest';
import { accountsQuery, transactionsQuery } from './queries';
import { makeFakeClient } from './_fake';

describe('queries', () => {
  it('accountsQuery usa a chave certa e busca a tabela', async () => {
    const { client } = makeFakeClient({ tables: { accounts: [{ id: 'a1', name: 'Nubank' }] } });
    const opts = accountsQuery(client);
    expect(opts.queryKey).toEqual(['accounts']);
    const data = await opts.queryFn!({} as never);
    expect(data).toEqual([{ id: 'a1', name: 'Nubank' }]);
  });

  it('transactionsQuery embute o filtro na chave', () => {
    const { client } = makeFakeClient({ tables: { transactions: [] } });
    const opts = transactionsQuery(client, { accountId: 'a1' });
    expect(opts.queryKey).toEqual(['transactions', { accountId: 'a1' }]);
  });
});
