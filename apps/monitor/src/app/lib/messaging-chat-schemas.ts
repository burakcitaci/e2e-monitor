import { z } from 'zod';

export const savedChatTurnSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(16000),
  context: z.string().max(20000).optional(),
});
const chatSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  mode: z.enum(['structured', 'tools']),
  revision: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const savedChatSchema = chatSummarySchema.extend({
  turns: z.array(savedChatTurnSchema).max(200),
});
export const chatHistorySchema = z.object({
  items: z.array(chatSummarySchema),
  page: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  pages: z.number().int().positive(),
});

export const chatStatusSchema = z.object({
  configured: z.boolean(),
  model: z.string(),
});
export const chatReplySchema = z.object({
  reply: z.string().min(1).max(4000),
  draft: z
    .object({
      provider: z.enum(['azure', 'aws']),
      destinationType: z.enum(['queue', 'topic']),
      destination: z.string().min(1).max(260),
      body: z.string().min(1).max(8000),
    })
    .strict()
    .nullable(),
});
