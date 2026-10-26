import { z } from 'zod';

// Base API response schema
export const apiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    message: z.string().optional(),
    data: dataSchema.optional(),
  });

// Unified Tracking Message schema - AWS as source of truth
export const trackingMessageSchema = z.preprocess(
  (data: unknown) => {
    // Normalize _id from MongoDB ObjectId buffer format to string
    if (typeof data === 'object' && data !== null && '_id' in data) {
      const id = (data as { _id: unknown })._id;
      if (
        typeof id === 'object' &&
        id !== null &&
        'buffer' in id &&
        typeof (id as { buffer: unknown }).buffer === 'object'
      ) {
        const buffer = (id as { buffer: { data?: number[] } }).buffer;
        if (buffer?.data && Array.isArray(buffer.data)) {
          // Convert buffer to hex string (MongoDB ObjectId format)
          const hex = buffer.data
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
          return { ...(data as Record<string, unknown>), _id: hex };
        }
      }
    }
    return data;
  },
  z.object({
    _id: z.string().optional(),
    messageId: z.string().optional(),
    detailId: z.string().optional(),
    deliveries: z
      .array(
        z.object({
          subscription: z.string(),
          service: z.string(),
          receivedAt: z.coerce.date().optional(),
          completedAt: z.coerce.date().optional(),
        }),
      )
      .optional(),
    captureId: z.string().optional(),
    namespace: z.string().optional(),
    trackingSource: z.literal('capture').optional(),
    completedAt: z.coerce.date().optional(),
    body: z.string().optional(),
    sentBy: z.string().optional(),
    sentAt: z.coerce.date().optional(),
    status: z.enum(['sent', 'processing', 'received']).optional(),
    queue: z.string().optional().nullable(),
    receivedAt: z.coerce.date().optional().nullable(),
    receivedBy: z.string().optional().nullable(),
    disposition: z
      .enum(['complete', 'abandon', 'deadletter', 'defer'])
      .optional()
      .nullable(),
    emulatorType: z
      .enum(['sqs', 'sns', 'azure-service-bus'])
      .optional()
      .nullable(),
    // Azure Service Bus optional fields
    contentType: z.string().optional(),
    subject: z.string().optional(),
    sessionId: z.string().optional(),
    replyTo: z.string().optional(),
    timeToLive: z.number().optional(),
    scheduledEnqueueTime: z.coerce.date().optional(),
    applicationProperties: z.record(z.string(), z.any()).optional(),
  }),
);

export type TrackingMessage = z.infer<typeof trackingMessageSchema>;

export const policyEvaluationSchema = z.object({
  policyId: z.string(),
  status: z.enum(['disabled', 'no_data', 'insufficient_data', 'pass', 'fail']),
  counts: z.object({
    total: z.number(),
    eligible: z.number(),
    pending: z.number(),
    passed: z.number(),
    late: z.number(),
    missing: z.number(),
  }),
  successPercentage: z.number().nullable(),
  p95Seconds: z.number().nullable(),
  thresholdSeconds: z.number(),
  requiredSuccessPercentage: z.number(),
  evaluatedAt: z.string(),
  messages: z.array(
    z.object({
      messageId: z.string(),
      detailId: z.string(),
      sentAt: z.string(),
      receivedAt: z.string().optional(),
      latencySeconds: z.number().nullable(),
      outcome: z.enum(['pending', 'passed', 'late', 'missing']),
    }),
  ),
});
export type PolicyEvaluation = z.infer<typeof policyEvaluationSchema>;
export const policySchema = z.object({
  _id: z.string(),
  name: z.string(),
  provider: z.enum(['azure', 'aws']).default('azure'),
  namespace: z.string(),
  sourceService: z.string(),
  destinationService: z.string(),
  destination: z.string(),
  subscription: z.string(),
  thresholdSeconds: z.number(),
  requiredSuccessPercentage: z.number(),
  evaluationWindowMinutes: z.number(),
  minimumSampleCount: z.number(),
  enabled: z.boolean(),
  effectiveFrom: z.coerce.date(),
  latestEvaluation: policyEvaluationSchema.optional(),
});
export const policiesResponseSchema = apiResponseSchema(z.array(policySchema));
export const policyResponseSchema = apiResponseSchema(policySchema);
export const policyDetailSchema = z.object({
  analysis: policyEvaluationSchema
    .extend({ from: z.string(), to: z.string() })
    .optional(),
  policy: policySchema,
  latestEvaluation: policyEvaluationSchema.optional(),
  evaluations: z.array(policyEvaluationSchema),
});
export type Policy = z.infer<typeof policySchema>;
export type PolicyDetail = z.infer<typeof policyDetailSchema>;

// API response types - handle both wrapped and unwrapped responses
// Try wrapped format first (what backend returns), then fallback to array
export const trackingMessagesResponseSchema = z.union([
  z.object({
    success: z.boolean(),
    message: z.string().optional(),
    data: z.array(trackingMessageSchema), // Required data field for list endpoint
  }),
  z.array(trackingMessageSchema), // Fallback for unwrapped arrays
]);

export const trackingMessageResponseSchema = apiResponseSchema(
  trackingMessageSchema,
);

export const deleteMessageResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

// Message Resources schema - handle MongoDB ObjectId and date formats
export const messageResourcesSchema = z.preprocess(
  (data: unknown) => {
    // Normalize _id from MongoDB ObjectId buffer format to string
    if (typeof data === 'object' && data !== null && '_id' in data) {
      const id = (data as { _id: unknown })._id;
      if (
        typeof id === 'object' &&
        id !== null &&
        'buffer' in id &&
        typeof (id as { buffer: unknown }).buffer === 'object'
      ) {
        const buffer = (id as { buffer: { data?: number[] } }).buffer;
        if (buffer?.data && Array.isArray(buffer.data)) {
          // Convert buffer to hex string (MongoDB ObjectId format)
          const hex = buffer.data
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
          return { ...(data as Record<string, unknown>), _id: hex };
        }
      }
    }
    return data;
  },
  z.object({
    id: z.string(),
    name: z.string(),
    provider: z.enum(['aws', 'azure']),
    type: z.enum(['queue', 'topic']),
    status: z.enum(['active', 'inactive']),
    subscriptions: z.array(z.string()).optional(),
    brokerAddress: z.string().optional(),
  }),
);

export type MessageResources = z.infer<typeof messageResourcesSchema>;

// Message Resources Response schema (for GET - returns array)
export const messageResourcesResponseSchema = apiResponseSchema(
  z.array(messageResourcesSchema),
);

export type MessageResourcesResponse = z.infer<
  typeof messageResourcesResponseSchema
>;

// Single Message Resource Response schema (for POST/PUT - returns single object)
export const messageResourceResponseSchema = apiResponseSchema(
  messageResourcesSchema,
);

export type MessageResourceResponse = z.infer<
  typeof messageResourceResponseSchema
>;
