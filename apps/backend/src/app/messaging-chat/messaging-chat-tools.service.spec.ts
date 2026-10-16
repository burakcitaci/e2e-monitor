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
import type { AwsSqsService } from '../aws-sqs/aws-sqs.service';
import { MessagingChatRuntime } from './messaging-chat.runtime';
import { MessagingChatToolsService } from './messaging-chat-tools.service';

const draft = {
  provider: 'aws',
  destinationType: 'queue',
  destination: 'orders',
  body: 'hello',
};
const messages = [
  { role: 'user' as const, content: 'Send hello to AWS queue orders' },
];
const response = (parts: unknown[], finishReason = 'STOP') =>
  new Response(
    JSON.stringify({
      candidates: [{ finishReason, content: { role: 'model', parts } }],
    }),
  );
const call = (name: string, args: unknown = {}) =>
  response([
    {
      functionCall: { name, args, id: 'call-1' },
      thoughtSignature: 'opaque-signature',
    },
  ]);

describe('Separate Gemini tool-calling planner', () => {
  const fetchMock = jest.spyOn(globalThis, 'fetch');
  let service: MessagingChatToolsService;
  let config: ConfigService;
  beforeEach(() => {
    config = new ConfigService({ GEMINI_API_KEY: 'test-key' });
    const runtime = new MessagingChatRuntime(
      config,
      {
        getServiceBusConfiguration: () => ({ UserConfig: { Namespaces: [] } }),
      } as unknown as AppConfigService,
      {
        listQueueResources: async () => [{ name: 'orders' }],
      } as unknown as AwsSqsService,
    );
    service = new MessagingChatToolsService(runtime);
  });
  afterEach(() => {
    fetchMock.mockReset();
  });

  it('executes lookup and preparation, sends tool results back and preserves signatures', async () => {
    fetchMock
      .mockResolvedValueOnce(call('list_destinations'))
      .mockResolvedValueOnce(call('prepare_message', draft))
      .mockResolvedValueOnce(response([{ text: 'Please review.' }]));
    await expect(service.reply(messages)).resolves.toMatchObject({
      draft,
      reply: expect.stringContaining('Review'),
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const payloads = fetchMock.mock.calls.map(([, request]) =>
      JSON.parse(request?.body as string),
    );
    expect(payloads[0].generationConfig.responseJsonSchema).toBeUndefined();
    expect(
      payloads[0].tools[0].functionDeclarations.map(
        (tool: { name: string }) => tool.name,
      ),
    ).toEqual(['list_destinations', 'prepare_message']);
    expect(payloads[1].contents[1].parts[0]).toMatchObject({
      thoughtSignature: 'opaque-signature',
      functionCall: { id: 'call-1' },
    });
    expect(payloads[1].contents[2].parts[0].functionResponse).toMatchObject({
      name: 'list_destinations',
      id: 'call-1',
      response: {
        destinations: [
          { provider: 'aws', destinationType: 'queue', destination: 'orders' },
        ],
      },
    });
    expect(
      payloads[2].contents[4].parts[0].functionResponse.response,
    ).toMatchObject({ prepared: true, requiresUserConfirmation: true, draft });
    expect(
      fetchMock.mock.calls.every(([url]) =>
        String(url).startsWith('https://generativelanguage.googleapis.com/'),
      ),
    ).toBe(true);
    expect(JSON.stringify(payloads)).not.toContain('test-key');
    expect(
      new Set(fetchMock.mock.calls.map(([, request]) => request?.signal)).size,
    ).toBe(1);
  });
  it('answers a follow-up without inventing a draft or executing thought parts', async () => {
    fetchMock.mockResolvedValueOnce(
      response([
        { thought: true, functionCall: { name: 'send_message', args: {} } },
        { text: 'Which destination?' },
      ]),
    );
    await expect(service.reply(messages)).resolves.toEqual({
      reply: 'Which destination?',
      draft: null,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each([
    { ...draft, destination: 'invented' },
    { ...draft, body: ' ' },
    { ...draft, destinationType: 'topic' },
    { ...draft, shell: 'execute' },
  ])(
    'rejects invalid preparation arguments without producing a sendable draft',
    async (args) => {
      fetchMock
        .mockResolvedValueOnce(call('prepare_message', args))
        .mockResolvedValueOnce(
          response([{ text: 'Please provide a valid destination and body.' }]),
        );
      await expect(service.reply(messages)).resolves.toMatchObject({
        draft: null,
      });
      const second = JSON.parse(fetchMock.mock.calls[1][1]?.body as string);
      expect(
        second.contents[2].parts[0].functionResponse.response.error,
      ).toBeTruthy();
    },
  );
  it('rejects undeclared tools rather than dispatching arbitrary actions', async () => {
    fetchMock.mockResolvedValueOnce(call('send_message', draft));
    await expect(service.reply(messages)).rejects.toThrow('unsupported tool');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('bounds repeated tool rounds and rejects excessive or ambiguous batches', async () => {
    fetchMock.mockImplementation(async () => call('list_destinations'));
    await expect(service.reply(messages)).rejects.toThrow('tool limit');
    expect(fetchMock).toHaveBeenCalledTimes(4);
    fetchMock.mockReset().mockResolvedValueOnce(
      response(
        Array.from({ length: 9 }, () => ({
          functionCall: { name: 'list_destinations', args: {} },
        })),
      ),
    );
    await expect(service.reply(messages)).rejects.toThrow('too many tools');
    fetchMock.mockReset().mockResolvedValueOnce(
      response(
        Array.from({ length: 2 }, () => ({
          functionCall: { name: 'prepare_message', args: draft },
        })),
      ),
    );
    await expect(service.reply(messages)).rejects.toThrow('too many tools');
  });
  it('discards preparations on blocked responses and propagates provider errors without retry', async () => {
    fetchMock
      .mockResolvedValueOnce(call('prepare_message', draft))
      .mockResolvedValueOnce(response([], 'SAFETY'));
    await expect(service.reply(messages)).resolves.toMatchObject({
      draft: null,
    });
    fetchMock
      .mockReset()
      .mockResolvedValueOnce(new Response('{}', { status: 429 }));
    await expect(service.reply(messages)).rejects.toThrow('free-tier limits');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('requires a configured key and rejects empty model replies', async () => {
    config.set('GEMINI_API_KEY', '');
    await expect(service.reply(messages)).rejects.toThrow('Set GEMINI_API_KEY');
    expect(fetchMock).not.toHaveBeenCalled();
    config.set('GEMINI_API_KEY', 'test-key');
    fetchMock.mockResolvedValueOnce(response([{ text: ' ' }]));
    await expect(service.reply(messages)).rejects.toThrow(
      'invalid tool response',
    );
  });
});
