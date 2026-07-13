import { z } from 'zod';

export const uploadAttachmentSchema = z.object({
  label: z.enum(['receipt', 'invoice', 'warranty', 'other']),
});

export type UploadAttachmentDto = z.infer<typeof uploadAttachmentSchema>;
