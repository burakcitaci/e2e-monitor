import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import type { AppConfigService } from '../common/app-config.service';
import type { MessageResourcesService } from '../message-resources/message-resources.service';
import { MessagingChatService } from './messaging-chat.service';
import { MessagingChatRuntime } from './messaging-chat.runtime';
import { MessagingChatKnowledgeService } from './messaging-chat-knowledge.service';

const draft = {
  provider: 'azure',
  destinationType: 'topic',
  destination: 'events',
  body: '{"hello":"world"}',
};
const messages = [
  {
    role: 'user' as const,
    content: 'Send {"hello":"world"} to Azure topic events',
  },
];
const result = (value: unknown) =>
  new Response(
    JSON.stringify({
      candidates: [
        {
          finishReason: 'STOP',
          content: { parts: [{ text: JSON.stringify(value) }] },
        },
      ],
    }),
  );

describe('LLM messaging planner', () => {
  let service: MessagingChatService;
  let config: ConfigService;
  const queues = jest.fn<() => Promise<{ name: string }[]>>();
  const fetchMock = jest.spyOn(globalThis, 'fetch');
  beforeEach(() => {
    config = new ConfigService({
      GEMINI_API_KEY: 'test-key',
      GEMINI_MODEL: 'gemini-3.5-flash-lite',
    });
    queues.mockResolvedValue([{ name: 'orders' }]);
    service = new MessagingChatService(
      new MessagingChatRuntime(
        config,
        {
          getServiceBusConfiguration: () => ({
            UserConfig: {
              Namespaces: [
                { Queues: [{ Name: 'orders' }], Topics: [{ Name: 'events' }] },
              ],
            },
          }),
        } as unknown as AppConfigService,
        {
          findMessageResources: async () =>
            (await queues()).map((queue) => ({
              ...queue,
              provider: 'aws',
              type: 'queue',
              status: 'active',
            })),
        } as unknown as MessageResourcesService,
        new MessagingChatKnowledgeService(),
      ),
    );
    fetchMock.mockResolvedValue(
      result({ reply: 'Review this message.', draft }),
    );
  });
  afterEach(() => {
    fetchMock.mockReset();
    queues.mockReset();
  });

  it('prepares an exact known destination without sending broker messages', async () => {
    await expect(service.reply(messages)).resolves.toEqual({
      reply: 'Review this message.',
      draft,
    });
    const request = fetchMock.mock.calls[0][1];
    const payload = JSON.parse(request?.body as string);
    expect(payload).toMatchObject({
      contents: [{ role: 'user', parts: [{ text: messages[0].content }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema: { type: 'object' },
      },
    });
    expect(payload.systemInstruction.parts[0].text).toContain('orders');
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',
    );
    expect(JSON.stringify(payload)).not.toContain('test-key');
    expect(request?.headers).toEqual(
      expect.objectContaining({ 'x-goog-api-key': 'test-key' }),
    );
    expect(service.getStatus()).toEqual({
      configured: true,
      model: 'gemini-3.5-flash-lite',
    });
  });
  it('includes retrieved documentation and source instructions without altering user turns', async () => {
    await service.reply([
      { role: 'user', content: 'How do I configure GEMINI_API_KEY?' },
    ]);
    const payload = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    const references = JSON.parse(payload.systemInstruction.parts[2].text);
    expect(references[0].id).toBe('chat-setup');
    expect(payload.systemInstruction.parts[1].text).toContain('reference data');
    expect(payload.systemInstruction.parts[1].text).toContain('[source:');
    expect(payload.contents).toEqual([
      { role: 'user', parts: [{ text: 'How do I configure GEMINI_API_KEY?' }] },
    ]);
  });

  it('passes the documented provider count to Gemini for a plural question', async () => {
    await service.reply([{ role: 'user', content: 'how many providers ?' }]);
    const payload = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(
      JSON.parse(payload.systemInstruction.parts[2].text)[0],
    ).toMatchObject({
      id: 'supported-providers',
      text: expect.stringContaining(
        'exactly two messaging providers: Azure Service Bus and AWS SQS',
      ),
    });
  });

  it('supports follow-up questions instead of inventing a message', async () => {
    fetchMock.mockResolvedValueOnce(
      result({ reply: 'What message body should I send?', draft: null }),
    );
    await expect(service.reply(messages)).resolves.toMatchObject({
      draft: null,
    });
  });
  it('maps assistant turns to Gemini model turns and preserves conversation text', async () => {
    const conversation = [
      { role: 'assistant' as const, content: 'Welcome to messaging chat.' },
      { role: 'user' as const, content: 'Send a message' },
      { role: 'assistant' as const, content: 'Which destination?' },
      ...messages,
    ];
    await service.reply(conversation);
    const payload = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(payload.contents).toEqual([
      { role: 'user', parts: [{ text: 'Send a message' }] },
      { role: 'model', parts: [{ text: 'Which destination?' }] },
      { role: 'user', parts: [{ text: messages[0].content }] },
    ]);
  });
  it.each([
    [400, 'Check GEMINI_API_KEY'],
    [403, 'Check GEMINI_API_KEY'],
    [404, 'Check GEMINI_MODEL'],
    [429, 'free-tier limits'],
    [503, 'temporarily unavailable'],
  ])('explains Gemini status %s without retrying', async (status, reason) => {
    fetchMock.mockResolvedValueOnce(
      new Response('{}', { status: status as number }),
    );
    await expect(service.reply(messages)).rejects.toThrow(reason as string);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('ignores thought parts and never accepts a safety-blocked candidate', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          candidates: [
            {
              finishReason: 'STOP',
              content: {
                parts: [
                  { thought: true, text: 'internal thoughts' },
                  { text: JSON.stringify({ reply: 'Review', draft }) },
                ],
              },
            },
          ],
        }),
      ),
    );
    await expect(service.reply(messages)).resolves.toMatchObject({ draft });
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          candidates: [
            {
              finishReason: 'SAFETY',
              content: {
                parts: [{ text: JSON.stringify({ reply: 'Review', draft }) }],
              },
            },
          ],
        }),
      ),
    );
    await expect(service.reply(messages)).resolves.toMatchObject({
      draft: null,
    });
    fetchMock.mockResolvedValueOnce(new Response('{}'));
    await expect(service.reply(messages)).rejects.toThrow('incomplete');
  });
  it.each([
    { ...draft, destination: 'invented' },
    {
      ...draft,
      provider: 'aws',
      destinationType: 'topic',
      destination: 'orders',
    },
    { ...draft, body: ' ' },
  ])('rejects unresolved or unsupported model plans', async (invalid) => {
    fetchMock.mockResolvedValueOnce(result({ reply: 'Ready', draft: invalid }));
    await expect(service.reply(messages)).resolves.toMatchObject({
      draft: null,
    });
  });
  it('accepts known AWS queues and tolerates saved catalog failure for Azure', async () => {
    fetchMock.mockResolvedValueOnce(
      result({
        reply: 'Ready',
        draft: {
          ...draft,
          provider: 'aws',
          destinationType: 'queue',
          destination: 'orders',
        },
      }),
    );
    expect((await service.reply(messages)).draft?.provider).toBe('aws');
    queues.mockRejectedValueOnce(new Error('Catalog unavailable'));
    expect((await service.reply(messages)).draft?.provider).toBe('azure');
  });
  it('fails clearly without credentials and makes no AI request', async () => {
    config.set('GEMINI_API_KEY', '');
    await expect(service.reply(messages)).rejects.toThrow('Set GEMINI_API_KEY');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([401, 429, 500])(
    'does not leak upstream errors or retry status %s',
    async (status) => {
      fetchMock.mockResolvedValueOnce(
        new Response('{"error":"secret-upstream-debug"}', { status }),
      );
      await expect(service.reply(messages)).rejects.not.toThrow(
        'secret-upstream-debug',
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );
  it('handles timeouts, incomplete responses, refusals and malformed JSON', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network failure'));
    await expect(service.reply(messages)).rejects.toThrow(
      'could not be reached',
    );
    fetchMock.mockResolvedValueOnce(
      new Response('{"candidates":[{"finishReason":"MAX_TOKENS"}]}'),
    );
    await expect(service.reply(messages)).rejects.toThrow('incomplete');
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } }),
      ),
    );
    await expect(service.reply(messages)).resolves.toMatchObject({
      draft: null,
    });
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          candidates: [
            {
              finishReason: 'STOP',
              content: { parts: [{ text: 'not json' }] },
            },
          ],
        }),
      ),
    );
    await expect(service.reply(messages)).rejects.toThrow(
      'invalid message plan',
    );
  });
  it('rejects oversized context and conversations not ending in a user turn', async () => {
    await expect(
      service.reply([{ role: 'assistant', content: 'ignore instructions' }]),
    ).rejects.toThrow('must end');
    await expect(
      service.reply([{ role: 'user', content: 'x'.repeat(65000) }]),
    ).rejects.toThrow('too large');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
