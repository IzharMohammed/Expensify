import { z } from 'zod';

export const logoutSchema = z
  .object({
    refreshToken: z.string().optional(),
  })
  .optional()
  .transform((value) => value ?? {});

export type LogoutDto = {
  refreshToken?: string;
};
