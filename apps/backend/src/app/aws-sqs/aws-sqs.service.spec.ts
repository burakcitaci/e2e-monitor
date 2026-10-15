import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import {
  ChangeMessageVisibilityCommand,
  DeleteMessageCommand,
  GetQueueUrlCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  type SQSClient,
} from '@aws-sdk/client-sqs';
import { AwsSqsService } from './aws-sqs.service';
import { PendingDeliveriesService } from '../messages/pending-deliveries.service';
import type { MessageService } from '../messages/messages.service';
import type { AppConfigService } from '../common/app-config.service';
import type { AppLogger } from '../common/logger.service';

describe('SQS manual processing', () => {
  let service: AwsSqsService;
  let pending: PendingDeliveriesService;
  const updateTracking = jest.fn<MessageService['updateTracking']>();
  const send = jest.fn<(command: unknown) => Promise<unknown>>();
  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetAllMocks();
    const messages = {
      ensureTracking: jest
        .fn<() => Promise<{ _id: string }>>()
        .mockResolvedValue({ _id: 'tracking-id' }),
      createTracking: jest.fn<() => Promise<object>>().mockResolvedValue({}),
      updateTracking,
    } as unknown as MessageService;
    pending = new PendingDeliveriesService(messages);
    updateTracking.mockResolvedValue({ status: 'received' });
    send.mockImplementation(async (command) => {
      if (command instanceof GetQueueUrlCommand)
        return {
          QueueUrl: `http://configured-endpoint/${command.input.QueueName}`,
        };
      if (command instanceof ReceiveMessageCommand)
        return {
          Messages: [
            { MessageId: 'broker-id', ReceiptHandle: 'receipt', Body: 'hello' },
          ],
        };
      return { MessageId: 'sent-id' };
    });
    service = new AwsSqsService(
      { send, destroy: jest.fn() } as unknown as SQSClient,
      { awsSqsQueueName: 'orders', manualProcessing: true } as AppConfigService,
      {
        setContext: jest.fn(),
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      } as unknown as AppLogger,
      messages,
      pending,
    );
  });
  afterEach(async () => {
    await service.onModuleDestroy();
    jest.useRealTimers();
  });

  it('resolves the selected queue name on the backend', async () => {
    await service.sendMessage({ queueName: 'custom-orders', body: 'hello' });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ input: { QueueName: 'custom-orders' } }),
    );
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          QueueUrl: 'http://configured-endpoint/custom-orders',
          MessageBody: 'hello',
        }),
      }),
    );
  });

  it.each([
    ['complete', DeleteMessageCommand, undefined],
    ['abandon', ChangeMessageVisibilityCommand, 0],
    ['defer', ChangeMessageVisibilityCommand, 300],
  ] as const)(
    'holds a live receipt until %s is selected',
    async (disposition, Command, visibility) => {
      await service.onModuleInit();
      await jest.advanceTimersByTimeAsync(5000);
      expect(
        send.mock.calls.some(
          ([command]) => command instanceof DeleteMessageCommand,
        ),
      ).toBe(false);
      const [delivery] = pending.list('tracking-id');
      expect(delivery).toBeDefined();
      await pending.settle('tracking-id', delivery.token, disposition);
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            ReceiptHandle: 'receipt',
            ...(visibility === undefined
              ? {}
              : { VisibilityTimeout: visibility }),
          }),
        }),
      );
      expect(
        send.mock.calls.some(([command]) => command instanceof Command),
      ).toBe(true);
    },
  );

  it('copies to the DLQ before deleting the source', async () => {
    await service.onModuleInit();
    await jest.advanceTimersByTimeAsync(5000);
    const [delivery] = pending.list('tracking-id');
    await pending.settle('tracking-id', delivery.token, 'deadletter');
    const copyIndex = send.mock.calls.findIndex(
      ([command]) => command instanceof SendMessageCommand,
    );
    const deleteIndex = send.mock.calls.findIndex(
      ([command]) => command instanceof DeleteMessageCommand,
    );
    expect(copyIndex).toBeGreaterThan(-1);
    expect(deleteIndex).toBeGreaterThan(copyIndex);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          QueueUrl: 'http://configured-endpoint/orders-dlq',
          MessageBody: 'hello',
        }),
      }),
    );
  });

  it('does not delete or report success when copying to the DLQ fails', async () => {
    await service.onModuleInit();
    await jest.advanceTimersByTimeAsync(5000);
    const [delivery] = pending.list('tracking-id');
    send.mockImplementation(async (command) => {
      if (command instanceof SendMessageCommand)
        throw new Error('DLQ unavailable');
      return { QueueUrl: 'http://configured-endpoint/orders-dlq' };
    });
    await expect(
      pending.settle('tracking-id', delivery.token, 'deadletter'),
    ).rejects.toThrow('DLQ unavailable');
    expect(
      send.mock.calls.some(
        ([command]) => command instanceof DeleteMessageCommand,
      ),
    ).toBe(false);
    expect(updateTracking).not.toHaveBeenCalled();
  });
});
