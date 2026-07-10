import { z } from 'zod';

export const updateGoalSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  targetAmount: z.coerce.number().positive().optional(),
  currentAmount: z.coerce.number().min(0).optional(),
  targetDate: z.string().datetime().optional().nullable(),
});

export type UpdateGoalDto = z.infer<typeof updateGoalSchema>;
