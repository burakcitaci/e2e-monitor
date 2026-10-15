import { z } from 'zod';

export const scenarioPolicySchema = z.object({
  publisher: z.string(),
  consumer: z.string(),
  messageType: z.string(),
  provider: z.enum(['sqs', 'azure-service-bus']),
  destination: z.string(),
  timeoutSeconds: z.number().int().min(1).max(3600),
});
export const testScenarioSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  policy: scenarioPolicySchema,
  createdAt: z.string().datetime(),
});
export const testRunSummarySchema = z.object({
  id: z.string().uuid(),
  mode: z.literal('demo'),
  scenarioId: z.string().uuid(),
  scenarioName: z.string(),
  policy: scenarioPolicySchema,
  correlationId: z.string().uuid(),
  status: z.enum(['running', 'passed', 'failed', 'timed_out']),
  reason: z.string(),
  startedAt: z.string().datetime(),
  deadlineAt: z.string().datetime(),
});
export const testRunSchema = testRunSummarySchema.extend({
  evidence: z.array(
    z.object({
      eventId: z.string(),
      correlationId: z.string().uuid(),
      messageId: z.string(),
      messageType: z.string(),
      service: z.string(),
      kind: z.enum(['published', 'processed', 'failed']),
      provider: z.enum(['sqs', 'azure-service-bus']),
      destination: z.string(),
      detail: z.string().optional(),
      receivedAt: z.string().datetime(),
    }),
  ),
});
