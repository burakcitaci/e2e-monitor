import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import type {
  MessageHandlers,
  ServiceBusReceivedMessage,
} from '@azure/service-bus';
import { ServiceBusWorker } from './service-bus.worker';
import type { ServiceBusService } from './service-bus.service';
import { PendingDeliveriesService } from '../messages/pending-deliveries.service';
import type { MessageService } from '../messages/messages.service';
import type { AppConfigService } from '../common/app-config.service';
import type { AppLogger } from '../common/logger.service';

describe('Service Bus manual processing', () => {
  let pending: PendingDeliveriesService;
  let worker: ServiceBusWorker;
  let handlers: MessageHandlers;
  const receiver = {
    completeMessage: jest.fn<() => Promise<void>>(),
    abandonMessage: jest.fn<() => Promise<void>>(),
    deferMessage: jest.fn<() => Promise<void>>(),
    deadLetterMessage: jest.fn<() => Promise<void>>(),
    close: jest.fn<() => Promise<void>>(),
    subscribe: jest.fn((value: MessageHandlers) => {
      handlers = value;
      return {
        close: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      };
    }),
  };
  beforeEach(async () => {
    jest.clearAllMocks();
    const messages = {
      ensureTracking: jest
        .fn<() => Promise<{ _id: string }>>()
        .mockResolvedValue({ _id: 'id' }),
      updateTracking: jest
        .fn<MessageService['updateTracking']>()
        .mockResolvedValue({ status: 'received' }),
    } as unknown as MessageService;
    pending = new PendingDeliveriesService(messages);
    worker = new ServiceBusWorker(
      { createReceiver: () => receiver } as unknown as ServiceBusService,
      messages,
      {
        manualProcessing: true,
        getServiceBusConfiguration: () => ({
          UserConfig: { Namespaces: [{ Queues: [{ Name: 'orders' }] }] },
        }),
      } as unknown as AppConfigService,
      {
        setContext: jest.fn(),
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      } as unknown as AppLogger,
      pending,
    );
    await worker.onModuleInit();
  });
  afterEach(async () => {
    pending.releaseAll();
    await worker.onModuleDestroy();
  });

  it.each([
    ['complete', 'completeMessage'],
    ['abandon', 'abandonMessage'],
    ['defer', 'deferMessage'],
    ['deadletter', 'deadLetterMessage'],
  ] as const)(
    'holds the received broker message until %s is requested',
    async (disposition, method) => {
      const message = {
        messageId: 'broker-id',
        body: 'hello',
        applicationProperties: {},
      } as unknown as ServiceBusReceivedMessage;
      const processing = handlers.processMessage(message);
      await Promise.resolve();
      const [delivery] = pending.list('id');
      expect(delivery.queue).toBe('orders');
      expect(receiver[method]).not.toHaveBeenCalled();
      await pending.settle('id', delivery.token, disposition);
      await processing;
      expect(receiver[method]).toHaveBeenCalledWith(message);
    },
  );
});
