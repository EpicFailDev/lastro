import { z } from 'zod';

export const categoryRuleSchema = z.object({
  matchType: z.enum(['contains', 'equals', 'regex']),
  pattern: z.string().min(1),
  category: z.string().min(1),
  weight: z.number().int().positive(),
});
export type CategoryRule = z.infer<typeof categoryRuleSchema>;

export type CategorizeResult = {
  category: string | null;
  rule: CategoryRule | null;
};
