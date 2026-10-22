import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  MessageHandlers,
  ProcessErrorArgs,
  ServiceBusReceiver,
  ServiceBusReceivedMessage,
} from '@azure/service-bus';
import { ServiceBusService } from './service-bus.service';
import { MessageService } from '../messages/messages.service';
import { AppConfigService } from '../common/app-config.service';
import { AppLogger } from '../common/logger.service';
import { MessageProcessor, DispositionActions, MessageDisposition } from '../common/message-processor';
import { PendingDeliveriesService } from '../messages/pending-deliveries.service';
import { serializeServiceBusBody } from './message-body';

@Injectable()
export class ServiceBusWorker implements OnModuleInit, OnModuleDestroy {
  private receivers: Map<string, ServiceBusReceiver> = new Map();
  private subscriptions: Map<string, { close(): Promise<void> }> = new Map();
  private readonly messageProcessor: MessageProcessor;

  constructor(
    private readonly serviceBusService: ServiceBusService,
    private readonly messageService: MessageService,
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
    private readonly pendingDeliveries: PendingDeliveriesService,
  ) {
    this.logger.setContext(ServiceBusWorker.name);
    this.messageProcessor = new MessageProcessor(messageService, logger);
  }

  async onModuleInit() {
    try {
      const { queues, topicSubscriptions } = this.getEntitiesFromConfig();

      if (queues.length === 0 && topicSubscriptions.length === 0) {
        this.logger.warn('No queues or topics found in config. Skipping processor bootstrap.');
        return;
      }

      // Subscribe to all queues
      for (const queueName of queues) {
        await this.subscribeToQueue(queueName);
      }

      // Subscribe to all topic subscriptions
      for (const { topic, subscription, entityName } of topicSubscriptions) {
        await this.subscribeToTopic(topic, subscription, entityName);
      }

      this.logSubscriptionSummary(queues, topicSubscriptions);
    } catch (error) {
      this.logger.error('Failed to initialize Service Bus worker:', error);
    }
  }

  async onModuleDestroy() {
    this.pendingDeliveries.releaseAll();
    await Promise.all(
      Array.from(this.subscriptions.values()).map(async (subscription) => {
        try {
          await subscription.close();
        } catch (error) {
          this.logger.error('Error closing subscription:', error);
        }
      }),
    );

    await Promise.all(
      Array.from(this.receivers.values()).map(async (receiver) => {
        try {
          await receiver.close();
        } catch (error) {
          this.logger.error('Error closing receiver:', error);
        }
      }),
    );

    this.receivers.clear();
    this.subscriptions.clear();
    this.logger.log('Service Bus subscriptions stopped.');
  }

  private getEntitiesFromConfig(): {
    queues: string[];
    topicSubscriptions: Array<{ topic: string; subscription: string; entityName: string }>;
  } {
    const serviceBusConfig = this.config.getServiceBusConfiguration();
    const queues: string[] = [];
    const topicSubscriptions: Array<{ topic: string; subscription: string; entityName: string }> = [];

    if (serviceBusConfig?.UserConfig?.Namespaces) {
      serviceBusConfig.UserConfig.Namespaces.forEach((namespace) => {
        if (namespace.Queues) {
          namespace.Queues.forEach((q) => queues.push(q.Name));
        }

        if (namespace.Topics) {
          namespace.Topics.forEach((topic) => {
            if (topic.Subscriptions) {
              topic.Subscriptions.forEach((sub) => {
                topicSubscriptions.push({
                  topic: topic.Name,
                  subscription: sub.Name,
                  entityName: `${topic.Name}/subscriptions/${sub.Name}`,
                });
              });
            }
          });
        }
      });
    }

    // Fallback to default queue
    if (queues.length === 0 && topicSubscriptions.length === 0) {
      const defaultQueue = this.config.serviceBusQueue;
      if (defaultQueue) {
        queues.push(defaultQueue);
        this.logger.warn('Using default queue from SERVICE_BUS_QUEUE');
      }
    }

    return { queues, topicSubscriptions };
  }

  private async subscribeToQueue(queueName: string) {
    try {
      const receiver = this.serviceBusService.createReceiver(queueName);
      this.receivers.set(queueName, receiver);

      const handlers = this.createMessageHandlers(receiver, queueName, 'queue');

      const subscription = receiver.subscribe(handlers, {
        autoCompleteMessages: false,
        maxConcurrentCalls: 5,
      });

      this.subscriptions.set(queueName, subscription);
      this.logger.log(
        `Service Bus subscription started for queue ${queueName}`,
      );
    } catch (error) {
      this.logger.error(`Failed to subscribe to queue ${queueName}:`, error);
    }
  }

  private async subscribeToTopic(
    topic: string,
    subscription: string,
    entityName: string,
  ) {
    try {
      const receiver = this.serviceBusService.createSubscriptionReceiver(
        topic,
        subscription,
      );
      this.receivers.set(entityName, receiver);

      const handlers = this.createMessageHandlers(
        receiver,
        entityName,
        'topic',
        topic,
        subscription,
      );

      const subscriptionHandle = receiver.subscribe(handlers, {
        autoCompleteMessages: false,
        maxConcurrentCalls: 5,
      });

      this.subscriptions.set(entityName, subscriptionHandle);
      this.logger.log(
        `Service Bus subscription started for topic ${topic}, subscription ${subscription}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to subscribe to topic ${topic}, subscription ${subscription}:`,
        error,
      );
    }
  }

  private createMessageHandlers(
    receiver: ServiceBusReceiver,
    entityName: string,
    type: 'queue' | 'topic',
    topic?: string,
    subscription?: string,
  ): MessageHandlers {
    return {
      processMessage: async (message) => {
        const messageId = message.messageId?.toString();
        if (!messageId) {
          this.logger.warn(
            `Received message without messageId from ${entityName}`,
          );
          await receiver.completeMessage(message);
          return;
        }

        const tracking = await this.messageService.ensureTracking({
          messageId,
          body: serializeServiceBusBody(message.body),
          sentBy:
            String(message.applicationProperties?.['sentBy'] ?? '') ||
            'external-service-bus',
          sentAt: message.enqueuedTimeUtc ?? new Date(),
          status: 'processing',
          queue: entityName,
          emulatorType: 'azure-service-bus',
        });

        if (this.config.manualProcessing) {
          const actions = this.createDispositionActions();
          const delivery = { message, receiver };
          const remainingLockMs = message.lockedUntilUtc
            ? Math.max(0, message.lockedUntilUtc.getTime() - Date.now() - 2000)
            : 90_000;
          await this.pendingDeliveries.hold(String(tracking._id), entityName, {
            complete: () => actions.complete(delivery),
            abandon: () => actions.abandon(delivery),
            defer: () => actions.defer(delivery),
            deadletter: () => actions.deadletter(delivery),
          }, Math.min(90_000, remainingLockMs));
          return;
        }

        const disposition = await this.getDisposition(messageId, message);

        await this.messageProcessor.processMessage(
          { message, receiver },
          {
            messageId,
            disposition,
            queueName: entityName,
            receivedBy: 'service-bus-worker',
            emulatorType: 'azure-service-bus',
          },
          this.createDispositionActions(),
        );
      },
      processError: async (args: ProcessErrorArgs) => {
        const location =
          type === 'topic'
            ? `topic ${topic}/subscription ${subscription}`
            : `queue ${entityName}`;
        this.logger.error(
          `Service Bus processor error for ${location}:`,
          args.error,
        );
      },
    };
  }

  private async getDisposition(
    messageId: string,
    message: ServiceBusReceivedMessage,
  ): Promise<MessageDisposition> {
    // Check database first for existing disposition
    const existingMessage =
      await this.messageService.findOneTrackingByMessageId(
        messageId,
        'azure-service-bus',
      );
    if (existingMessage?.disposition) {
      return MessageProcessor.normalizeDisposition(existingMessage.disposition);
    }

    // Fall back to application properties
    return MessageProcessor.normalizeDisposition(
      message.applicationProperties?.['messageDisposition'] as string,
    );
  }

  private createDispositionActions(): DispositionActions<{
    message: ServiceBusReceivedMessage;
    receiver: ServiceBusReceiver;
  }> {
    return {
      complete: async ({ message, receiver }) => {
        await receiver.completeMessage(message);
      },
      abandon: async ({ message, receiver }) => {
        await receiver.abandonMessage(message);
      },
      deadletter: async ({ message, receiver }) => {
        await receiver.deadLetterMessage(message);
      },
      defer: async ({ message, receiver }) => {
        await receiver.deferMessage(message);
      },
    };
  }

  private logSubscriptionSummary(
    queues: string[],
    topicSubscriptions: Array<{ topic: string; subscription: string }>,
  ) {
    const totalSubscriptions = queues.length + topicSubscriptions.length;
    const queueList = queues.length > 0 ? `queue(s): ${queues.join(', ')}` : '';
    const topicList =
      topicSubscriptions.length > 0
        ? `topic subscription(s): ${topicSubscriptions.map((ts) => `${ts.topic}/${ts.subscription}`).join(', ')}`
        : '';
    const subscriptionList = [queueList, topicList].filter(Boolean).join('; ');

    this.logger.log(`Service Bus subscriptions started for ${totalSubscriptions} entity(ies): ${subscriptionList}`,
    );
  }
}
