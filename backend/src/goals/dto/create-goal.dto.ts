import { z } from 'zod';

export const createGoalSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120, 'Name is too long'),
  targetAmount: z.coerce.number().positive('Target amount must be greater than 0'),
  currentAmount: z.coerce.number().min(0, 'Current amount cannot be negative').optional().default(0),
  targetDate: z.string().datetime().optional().nullable(),
});

export type CreateGoalDto = z.infer<typeof createGoalSchema>;
