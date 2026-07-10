import { z } from 'zod';

export const chatRequestSchema = z
  .object({
    message: z.string().trim().min(1, 'Message is required').max(1000, 'Message is too long'),
    conversationId: z.string().uuid('Conversation ID must be a valid UUID').optional(),
    conversation_id: z.string().uuid('Conversation ID must be a valid UUID').optional(),
  })
  .transform((value) => ({
    message: value.message,
    conversationId: value.conversationId ?? value.conversation_id ?? '',
  }))
  .refine((value) => !!value.conversationId, {
    message: 'Conversation ID must be a valid UUID',
    path: ['conversationId'],
  });

export type ChatRequestDto = z.infer<typeof chatRequestSchema>;
