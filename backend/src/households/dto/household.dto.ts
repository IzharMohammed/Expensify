import { z } from 'zod';

export const createHouseholdSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export const joinHouseholdSchema = z.object({
  code: z.string().min(20),
});

export const createSettlementSchema = z
  .object({
    householdId: z.string().uuid(),
    fromUserId: z.string().uuid(),
    toUserId: z.string().uuid(),
    amount: z.union([z.string(), z.number()]).transform(String),
  })
  .refine((value) => value.fromUserId !== value.toUserId, {
    message: 'Settlement users must be different',
    path: ['toUserId'],
  })
  .refine((value) => Number.isFinite(Number(value.amount)) && Number(value.amount) > 0, {
    message: 'Amount must be greater than zero',
    path: ['amount'],
  });

export type CreateHouseholdDto = z.infer<typeof createHouseholdSchema>;
export type CreateSettlementDto = z.infer<typeof createSettlementSchema>;
export type JoinHouseholdDto = z.infer<typeof joinHouseholdSchema>;
