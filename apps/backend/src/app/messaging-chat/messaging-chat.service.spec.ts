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
import { MessagingChatService } from './messaging-chat.service';

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
      status: 'completed',
      output: [
        {
          type: 'message',
          content: [{ type: 'output_text', text: JSON.stringify(value) }],
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
      OPENAI_API_KEY: 'test-key',
      OPENAI_MODEL: 'gpt-4.1-mini',
    });
    queues.mockResolvedValue([{ name: 'orders' }]);
    service = new MessagingChatService(
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
      { listQueueResources: queues } as unknown as AwsSqsService,
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
      model: 'gpt-4.1-mini',
      store: false,
      input: messages,
      text: { format: { type: 'json_schema', strict: true } },
    });
    expect(payload.instructions).toContain('orders');
    expect(JSON.stringify(payload)).not.toContain('test-key');
    expect(request?.headers).toEqual(
      expect.objectContaining({ Authorization: 'Bearer test-key' }),
    );
    expect(service.getStatus()).toEqual({
      configured: true,
      model: 'gpt-4.1-mini',
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
  it('accepts known AWS queues and tolerates AWS discovery failure for Azure', async () => {
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
    queues.mockRejectedValueOnce(new Error('LocalStack offline'));
    expect((await service.reply(messages)).draft?.provider).toBe('azure');
  });
  it('fails clearly without credentials and makes no AI request', async () => {
    config.set('OPENAI_API_KEY', '');
    await expect(service.reply(messages)).rejects.toThrow('Set OPENAI_API_KEY');
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
      new Response('{"status":"incomplete","output":[]}'),
    );
    await expect(service.reply(messages)).rejects.toThrow('incomplete');
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 'completed',
          output: [
            { type: 'message', content: [{ type: 'refusal', refusal: 'No' }] },
          ],
        }),
      ),
    );
    await expect(service.reply(messages)).resolves.toMatchObject({
      draft: null,
    });
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 'completed',
          output: [
            {
              type: 'message',
              content: [{ type: 'output_text', text: 'not json' }],
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
