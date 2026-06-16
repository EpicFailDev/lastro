import { mutationOptions, type QueryClient } from '@tanstack/react-query';
import type { PostgrestError } from '@supabase/supabase-js';
import type { DataClient } from './client';
import { unwrap } from './errors';
import { commitImport } from './imports';
import { dataKeys } from './keys';
import type {
  Account,
  Category,
  CommitImportInput,
  CommitImportResult,
  NewAccount,
  NewCategory,
  NewManualTransaction,
  NewRule,
  Transaction,
} from './types';

type SingleResult<T> = Promise<{ data: T | null; error: PostgrestError | null }>;
type VoidResult = Promise<{ data: unknown; error: PostgrestError | null }>;

export const createAccountMutation = (c: DataClient, qc: QueryClient) =>
  mutationOptions({
    mutationFn: async (input: NewAccount): Promise<Account> =>
      unwrap(await (c.from('accounts').insert(input as never).select().single() as unknown as SingleResult<Account>)),
    onSuccess: () => qc.invalidateQueries({ queryKey: dataKeys.accounts() }),
  });

export const archiveAccountMutation = (c: DataClient, qc: QueryClient) =>
  mutationOptions({
    mutationFn: async (id: string): Promise<void> => {
      unwrap(await (c.from('accounts').update({ archived: true } as never).eq('id', id) as unknown as VoidResult));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: dataKeys.accounts() }),
  });

export const createCategoryMutation = (c: DataClient, qc: QueryClient) =>
  mutationOptions({
    mutationFn: async (input: NewCategory): Promise<Category> =>
      unwrap(await (c.from('categories').insert(input as never).select().single() as unknown as SingleResult<Category>)),
    onSuccess: () => qc.invalidateQueries({ queryKey: dataKeys.categories() }),
  });

export const insertManualTransactionMutation = (c: DataClient, qc: QueryClient) =>
  mutationOptions({
    mutationFn: async (input: NewManualTransaction): Promise<Transaction> =>
      unwrap(await (c.from('transactions').insert({ ...input, is_manual: true } as never).select().single() as unknown as SingleResult<Transaction>)),
    onSuccess: () => qc.invalidateQueries({ queryKey: dataKeys.transactions() }),
  });

export const updateTransactionCategoryMutation = (c: DataClient, qc: QueryClient) =>
  mutationOptions({
    mutationFn: async (input: { id: string; categoryId: string | null }): Promise<void> => {
      unwrap(await (c.from('transactions').update({ category_id: input.categoryId } as never).eq('id', input.id) as unknown as VoidResult));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: dataKeys.transactions() }),
  });

export const deleteTransactionMutation = (c: DataClient, qc: QueryClient) =>
  mutationOptions({
    mutationFn: async (id: string): Promise<void> => {
      unwrap(await (c.from('transactions').delete().eq('id', id) as unknown as VoidResult));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: dataKeys.transactions() }),
  });

export const createRuleMutation = (c: DataClient, qc: QueryClient) =>
  mutationOptions({
    mutationFn: async (input: NewRule) =>
      unwrap(await (c.from('category_rules').insert(input as never).select().single() as unknown as VoidResult)),
    onSuccess: () => qc.invalidateQueries({ queryKey: dataKeys.rules() }),
  });

export const deleteRuleMutation = (c: DataClient, qc: QueryClient) =>
  mutationOptions({
    mutationFn: async (id: string): Promise<void> => {
      unwrap(await (c.from('category_rules').delete().eq('id', id) as unknown as VoidResult));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: dataKeys.rules() }),
  });

export const commitImportMutation = (c: DataClient, qc: QueryClient) =>
  mutationOptions({
    mutationFn: (input: CommitImportInput): Promise<CommitImportResult> => commitImport(c, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: dataKeys.transactions() }),
  });
