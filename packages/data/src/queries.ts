import { queryOptions } from '@tanstack/react-query';
import type { DataClient } from './client';
import { unwrap } from './errors';
import { dataKeys } from './keys';
import type { Account, Category, CategoryRuleRow, Transaction, TransactionFilter } from './types';

export const accountsQuery = (c: DataClient) =>
  queryOptions({
    queryKey: dataKeys.accounts(),
    queryFn: async (): Promise<Account[]> =>
      unwrap(await c.from('accounts').select('*').order('created_at')),
  });

export const categoriesQuery = (c: DataClient) =>
  queryOptions({
    queryKey: dataKeys.categories(),
    queryFn: async (): Promise<Category[]> =>
      unwrap(await c.from('categories').select('*').order('name')),
  });

export const rulesQuery = (c: DataClient) =>
  queryOptions({
    queryKey: dataKeys.rules(),
    queryFn: async (): Promise<CategoryRuleRow[]> =>
      unwrap(await c.from('category_rules').select('*')),
  });

export const transactionsQuery = (c: DataClient, filter?: TransactionFilter) =>
  queryOptions({
    queryKey: dataKeys.transactions(filter),
    queryFn: async (): Promise<Transaction[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = c.from('transactions').select('*').order('occurred_at', { ascending: false });
      if (filter?.accountId) q = q.eq('account_id', filter.accountId);
      if (filter?.from) q = q.gte('occurred_at', filter.from);
      if (filter?.to) q = q.lte('occurred_at', filter.to);
      return unwrap(await q);
    },
  });
