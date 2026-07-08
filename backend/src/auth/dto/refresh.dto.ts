import { z } from 'zod';

export const refreshSchema = z
  .object({
    refreshToken: z.string().optional(),
  })
  .optional()
  .transform((value) => value ?? {});

export type RefreshDto = {
  refreshToken?: string;
};
