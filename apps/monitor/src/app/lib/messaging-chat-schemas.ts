import { z } from 'zod';

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
