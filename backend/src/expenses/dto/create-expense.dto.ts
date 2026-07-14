import { z } from 'zod';

const equalSplitSchema = z.object({
  type: z.literal('equal'),
  memberIds: z.array(z.string().uuid()).min(1),
});

const amountShareSchema = z.object({
  userId: z.string().uuid(),
  amount: z.union([z.string(), z.number()]).transform(String),
});

const percentageShareSchema = z.object({
  userId: z.string().uuid(),
  percentage: z.number().positive().max(100),
});

const splitSchema = z.discriminatedUnion('type', [
  equalSplitSchema,
  z.object({ type: z.literal('custom'), shares: z.array(amountShareSchema).min(1) }),
  z.object({ type: z.literal('percentage'), shares: z.array(percentageShareSchema).min(1) }),
]);

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
  householdId: z.string().uuid().nullable().optional(),
  split: splitSchema.nullable().optional(),
}).superRefine((value, context) => {
  if (value.householdId && !value.split) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Split is required', path: ['split'] });
  }
  if (!value.householdId && value.split) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'A split requires a household',
      path: ['householdId'],
    });
  }
});

export type CreateExpenseDto = z.infer<typeof createExpenseSchema>;
