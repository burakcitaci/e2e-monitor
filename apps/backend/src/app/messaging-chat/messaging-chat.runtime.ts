import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import type { ChatReply, ChatTurn } from '@e2e-monitor/entities';
import { AppConfigService } from '../config/app-config.service';
import { MessageResourcesService } from '../message-resources/message-resources.service';
import { MessagingChatKnowledgeService } from './messaging-chat-knowledge.service';

export const replySchema = z
  .object({
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
    policyDraft: z
      .object({
        name: z.string().min(1).max(120),
        namespace: z.string().min(1).max(260),
        sourceService: z.string().min(1).max(120),
        destinationService: z.string().min(1).max(120),
        destination: z.string().min(1).max(260),
        subscription: z.string().min(1).max(260),
        thresholdSeconds: z.number().positive(),
        requiredSuccessPercentage: z.number().min(0).max(100),
        evaluationWindowMinutes: z.number().int().positive(),
        minimumSampleCount: z.number().int().positive(),
      })
      .strict()
      .nullable()
      .optional(),
  })
  .strict();

export const outputFormat = {
  type: 'json_schema',
  name: 'message_plan',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['reply', 'draft', 'policyDraft'],
    properties: {
      reply: {
        type: 'string',
        description:
          'Answer the latest user question with relevant recommendations, explanations, or troubleshooting steps. Do not replace the answer with a generic draft-review sentence.',
      },
      draft: {
        anyOf: [
          { type: 'null' },
          {
            type: 'object',
            additionalProperties: false,
            required: ['provider', 'destinationType', 'destination', 'body'],
            properties: {
              provider: { type: 'string', enum: ['azure', 'aws'] },
              destinationType: { type: 'string', enum: ['queue', 'topic'] },
              destination: { type: 'string' },
              body: { type: 'string' },
            },
          },
        ],
      },
      policyDraft: {
        description:
          'Null for recommendations, questions, troubleshooting, or discussion of an existing draft. Populate only for a requested complete new or revised policy draft.',
        anyOf: [
          { type: 'null' },
          {
            type: 'object',
            additionalProperties: false,
            required: [
              'name',
              'namespace',
              'sourceService',
              'destinationService',
              'destination',
              'subscription',
              'thresholdSeconds',
              'requiredSuccessPercentage',
              'evaluationWindowMinutes',
              'minimumSampleCount',
            ],
            properties: {
              name: { type: 'string' },
              namespace: { type: 'string' },
              sourceService: { type: 'string' },
              destinationService: { type: 'string' },
              destination: { type: 'string' },
              subscription: { type: 'string' },
              thresholdSeconds: { type: 'number', exclusiveMinimum: 0 },
              requiredSuccessPercentage: {
                type: 'number',
                minimum: 0,
                maximum: 100,
              },
              evaluationWindowMinutes: { type: 'integer', minimum: 1 },
              minimumSampleCount: { type: 'integer', minimum: 1 },
            },
          },
        ],
      },
    },
  },
};

const responseSchema = z.object({
  promptFeedback: z.object({ blockReason: z.string().optional() }).optional(),
  candidates: z
    .array(
      z.object({
        finishReason: z.string(),
        content: z
          .object({
            parts: z.array(
              z
                .object({
                  text: z.string().optional(),
                  thought: z.boolean().optional(),
                  functionCall: z
                    .object({
                      name: z.string(),
                      args: z.unknown().optional(),
                      id: z.string().optional(),
                    })
                    .optional(),
                  thoughtSignature: z.string().optional(),
                })
                .passthrough(),
            ),
          })
          .optional(),
      }),
    )
    .optional(),
});

export type GeminiContent = NonNullable<
  NonNullable<z.infer<typeof responseSchema>['candidates']>[number]['content']
>;
export type Destination = {
  provider: string;
  destinationType: string;
  destination: string;
};
export const blockedReply: ChatReply = {
  reply: 'I could not prepare that message. Please rephrase your request.',
  draft: null,
};
export function contentText(content: GeminiContent): string {
  return content.parts
    .filter((part) => !part.thought)
    .map((part) => part.text ?? '')
    .join('');
}

@Injectable()
export class MessagingChatRuntime {
  constructor(
    private readonly config: ConfigService,
    private readonly appConfig: AppConfigService,
    private readonly resources: MessageResourcesService,
    private readonly knowledge: MessagingChatKnowledgeService,
  ) {}

  getStatus() {
    return {
      configured: Boolean(this.config.get<string>('GEMINI_API_KEY')?.trim()),
      model: this.config.get<string>('GEMINI_MODEL', 'gemini-3.5-flash-lite'),
    };
  }

  async prepare(messages: ChatTurn[]) {
    const key = this.config.get<string>('GEMINI_API_KEY')?.trim();
    if (!key)
      throw new ServiceUnavailableException(
        'Set GEMINI_API_KEY in the backend environment and restart the API to enable chat.',
      );
    if (Buffer.byteLength(JSON.stringify(messages)) > 64000)
      throw new BadRequestException(
        'Conversation is too large. Start a new chat.',
      );
    if (
      messages.at(-1)?.role !== 'user' ||
      messages.some((message) => !message.content.trim())
    )
      throw new BadRequestException(
        'A conversation must end with a nonempty user message.',
      );
    const azure = this.appConfig.getServiceBusConfiguration();
    const destinations = azure.UserConfig.Namespaces.flatMap((namespace) => [
      ...(namespace.Queues ?? []).map((queue) => ({
        provider: 'azure',
        destinationType: 'queue',
        destination: queue.Name,
      })),
      ...(namespace.Topics ?? []).map((topic) => ({
        provider: 'azure',
        destinationType: 'topic',
        destination: topic.Name,
      })),
    ]);
    let catalogAvailable = true;
    try {
      const resources = await this.resources.findMessageResources();
      destinations.push(
        ...resources
          .filter(
            (resource) =>
              resource.status === 'active' &&
              (resource.provider === 'azure' ||
                (resource.provider === 'aws' && resource.type === 'queue')),
          )
          .map((resource) => ({
            provider: resource.provider,
            destinationType: resource.type,
            destination: resource.name,
          })),
      );
    } catch {
      catalogAvailable = false;
    }
    const catalog = [
      ...new Map(
        destinations.map((destination) => [
          JSON.stringify(destination),
          destination,
        ]),
      ).values(),
    ].slice(0, 200);
    return {
      key,
      catalog,
      catalogAvailable,
      knowledge: this.knowledge.retrieve(messages.at(-1)?.content ?? ''),
      contents: messages
        .slice(messages.findIndex((message) => message.role === 'user'))
        .map((message) => ({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: message.content }],
        })),
    };
  }

  async generate(
    key: string,
    payload: unknown,
    signal: AbortSignal,
  ): Promise<GeminiContent | null> {
    let response: Response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.getStatus().model)}:generateContent`,
        {
          method: 'POST',
          signal,
          headers: {
            'x-goog-api-key': key,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );
    } catch {
      throw new ServiceUnavailableException(
        'The AI service could not be reached within 30 seconds. Try again.',
      );
    }
    if (!response.ok) {
      const message =
        response.status === 400 ||
        response.status === 401 ||
        response.status === 403
          ? 'Gemini rejected the request. Check GEMINI_API_KEY, model access, and regional availability.'
          : response.status === 429
            ? 'Gemini quota or rate limit reached. Check your free-tier limits in Google AI Studio and try again later.'
            : response.status === 404
              ? 'The configured Gemini model is unavailable. Check GEMINI_MODEL.'
              : 'Gemini is temporarily unavailable. Try again later.';
      throw new ServiceUnavailableException(message);
    }
    const parsed = responseSchema.safeParse(
      await response.json().catch(() => null),
    );
    if (!parsed.success)
      throw new BadGatewayException(
        'The AI service returned an incomplete response. Please try again.',
      );
    const candidate = parsed.data.candidates?.[0];
    if (
      parsed.data.promptFeedback?.blockReason ||
      [
        'SAFETY',
        'RECITATION',
        'BLOCKLIST',
        'PROHIBITED_CONTENT',
        'SPII',
        'IMAGE_SAFETY',
      ].includes(candidate?.finishReason ?? '')
    )
      return null;
    if (candidate?.finishReason !== 'STOP' || !candidate.content)
      throw new BadGatewayException(
        'The AI service returned an incomplete response. Please try again.',
      );
    return candidate.content;
  }

  parseReply(text: string, catalog: Destination[]): ChatReply {
    let result: ChatReply;
    try {
      result = replySchema.parse(JSON.parse(text));
    } catch {
      throw new BadGatewayException(
        'The AI service returned an invalid message plan. Please try again.',
      );
    }
    const draft = result.draft;
    if (
      draft &&
      (!draft.body.trim() ||
        !catalog.some(
          (destination) =>
            destination.provider === draft.provider &&
            destination.destinationType === draft.destinationType &&
            destination.destination === draft.destination,
        ))
    ) {
      return {
        reply:
          'I could not resolve that destination and message. Please specify a known Azure queue/topic or AWS SQS queue, and the message body.',
        draft: null,
      };
    }
    return result;
  }
}
