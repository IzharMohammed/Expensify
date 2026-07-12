import { z } from 'zod';

export const spendingRangeSchema = z.object({
  range: z.enum(['daily', 'weekly', 'monthly', 'yearly']).default('daily'),
});

export type SpendingRangeDto = z.infer<typeof spendingRangeSchema>;

export const monthQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format')
    .default(new Date().toISOString().slice(0, 7)),
});

export type MonthQueryDto = z.infer<typeof monthQuerySchema>;

export const yearQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).default(new Date().getUTCFullYear()),
});

export type YearQueryDto = z.infer<typeof yearQuerySchema>;
