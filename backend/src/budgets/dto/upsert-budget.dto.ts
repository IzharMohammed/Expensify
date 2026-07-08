import { z } from 'zod';

export const upsertBudgetSchema = z.object({
  categoryId: z.string().uuid(),
  amount: z.union([z.string(), z.number()]).transform((value) => String(value)),
  month: z.string().regex(/^\d{4}-\d{2}$/),
});

export type UpsertBudgetDto = z.infer<typeof upsertBudgetSchema>;
