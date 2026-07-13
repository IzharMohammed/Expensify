import { z } from 'zod';

export const updateExpenseTagsSchema = z
  .object({
    tagIds: z.array(z.string().uuid()).max(20).default([]),
    names: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  })
  .refine((value) => value.tagIds.length > 0 || value.names.length > 0, {
    message: 'Provide at least one tag ID or name',
  });

export type UpdateExpenseTagsDto = z.infer<typeof updateExpenseTagsSchema>;
