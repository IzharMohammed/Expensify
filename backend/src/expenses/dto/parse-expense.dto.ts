import { z } from 'zod';

export const parseExpenseSchema = z.object({
  text: z.string().min(1).max(2000),
});

export type ParseExpenseDto = z.infer<typeof parseExpenseSchema>;
