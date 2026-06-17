import { z } from 'zod';
import type { Database } from './database.types';

type Tables = Database['public']['Tables'];

export type Account = Tables['accounts']['Row'];
export type Category = Tables['categories']['Row'];
export type Transaction = Tables['transactions']['Row'];
export type CategoryRuleRow = Tables['category_rules']['Row'];

export type NewAccount = Pick<Tables['accounts']['Insert'], 'name' | 'type' | 'institution'>;
export type NewCategory = Pick<Tables['categories']['Insert'], 'name' | 'icon' | 'color' | 'kind'>;
export type NewManualTransaction = Pick<
  Tables['transactions']['Insert'],
  'account_id' | 'amount_cents' | 'description' | 'occurred_at' | 'category_id'
> & { dedup_hash: string };
export type NewRule = Pick<
  Tables['category_rules']['Insert'],
  'match_type' | 'pattern' | 'category_id' | 'weight'
>;

export type TransactionFilter = { accountId?: string; from?: string; to?: string };

/** Input validado de uma importação (transações vêm de @lastro/importers). */
export const commitImportInputSchema = z.object({
  accountId: z.string().uuid(),
  format: z.enum(['csv', 'ofx']),
  fileName: z.string().optional(),
  transactions: z.array(
    z.object({
      occurredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      amountCents: z.number().int(),
      description: z.string(),
      dedupHash: z.string().min(1),
    }),
  ),
});
export type CommitImportInput = z.infer<typeof commitImportInputSchema>;
export type CommitImportResult = { importId: string; inserted: number; duplicates: number };
