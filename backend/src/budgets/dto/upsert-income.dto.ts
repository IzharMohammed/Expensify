import { z } from 'zod';

export const upsertIncomeSchema = z.object({
  amount: z.union([z.string(), z.number()]).transform((value) => String(value)),
  month: z.string().regex(/^\d{4}-\d{2}$/),
});

export type UpsertIncomeDto = z.infer<typeof upsertIncomeSchema>;
