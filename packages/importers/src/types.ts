import { z } from 'zod';

export const parsedTransactionSchema = z.object({
  occurredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data deve ser YYYY-MM-DD'),
  amountCents: z.number().int(),
  description: z.string(),
  dedupHash: z.string().min(1),
});
export type ParsedTransaction = z.infer<typeof parsedTransactionSchema>;

export const importResultSchema = z.object({
  format: z.enum(['csv', 'ofx']),
  transactions: z.array(parsedTransactionSchema),
  rowCount: z.number().int().nonnegative(),
});
export type ImportResult = z.infer<typeof importResultSchema>;

export type CsvTemplate = {
  name: string;
  delimiter?: string;
  dateColumn: string;
  amountColumn: string;
  descriptionColumn: string;
  dateFormat: 'dd/mm/yyyy' | 'yyyy-mm-dd';
  decimalSeparator: ',' | '.';
  invertSign?: boolean;
};
