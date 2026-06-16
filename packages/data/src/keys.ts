import type { TransactionFilter } from './types';

/** Chaves de cache do TanStack — fonte única, compartilhada por Web e Mobile. */
export const dataKeys = {
  accounts: () => ['accounts'] as const,
  categories: () => ['categories'] as const,
  rules: () => ['rules'] as const,
  transactions: (filter?: TransactionFilter) =>
    filter === undefined ? (['transactions'] as const) : (['transactions', filter] as const),
};
