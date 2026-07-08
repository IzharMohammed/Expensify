import { z } from 'zod';

export const createExpenseSchema = z.object({
  amount: z.union([z.string(), z.number()]).transform((value) => String(value)),
  merchant: z.string().min(1).max(120),
  categoryId: z.string().uuid().nullable().optional(),
  paymentMethod: z.enum(['upi', 'card', 'cash', 'netbanking']).nullable().optional(),
  date: z.string().min(1),
  note: z.string().max(500).nullable().optional(),
  source: z.enum(['text', 'voice', 'ocr', 'manual']).default('manual'),
  rawInput: z.string().max(5000).nullable().optional(),
  receiptUrl: z.string().url().nullable().optional(),
});

export type CreateExpenseDto = z.infer<typeof createExpenseSchema>;
