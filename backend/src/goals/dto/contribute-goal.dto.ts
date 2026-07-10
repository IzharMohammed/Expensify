import { z } from 'zod';

export const contributeGoalSchema = z.object({
  amount: z.coerce.number().positive('Contribution amount must be greater than 0'),
  date: z.string().datetime().optional(),
  note: z.string().trim().max(240).optional().nullable(),
});

export type ContributeGoalDto = z.infer<typeof contributeGoalSchema>;
