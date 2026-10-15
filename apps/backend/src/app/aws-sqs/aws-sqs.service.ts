import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  SQSClient,
  ListQueuesCommand,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  GetQueueUrlCommand,
  CreateQueueCommand,
  ChangeMessageVisibilityCommand,
  Message,
} from '@aws-sdk/client-sqs';
import { randomUUID } from 'crypto';
import { AWS_SQS_CLIENT } from './aws-sqs.constants';
import { SendSqsMessageDto } from './dto/send-sqs-message.dto';
import { ReceiveSqsMessageDto } from './dto/receive-sqs-message.dto';
import { AppConfigService } from '../common/app-config.service';
import { AppLogger } from '../common/logger.service';
import { MessageService } from '../messages/messages.service';
import { AwsSqsConnectionException } from '../common/exceptions';
import type { TrackingMessage } from '../messages/message.schema';
import { MessageProcessor, DispositionActions } from '../common/message-processor';
import { PendingDeliveriesService } from '../messages/pending-deliveries.service';

@Injectable()
export class AwsSqsService implements OnModuleInit, OnModuleDestroy {
  private readonly queueUrlCache = new Map<string, string>();
  private readonly pollingIntervals = new Map<string, NodeJS.Timeout>();
  private readonly pollingTasks = new Map<string, Promise<void>>();
  private readonly messageProcessor: MessageProcessor;
  private isShuttingDown = false;

  constructor(
    @Inject(AWS_SQS_CLIENT) private readonly client: SQSClient,
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
    private readonly messageService: MessageService,
    private readonly pendingDeliveries: PendingDeliveriesService,
  ) {
    this.logger.setContext(AwsSqsService.name);
    this.messageProcessor = new MessageProcessor(messageService, logger);
  }

  async listQueueResources() {
    const urls = new Set<string>();
    let nextToken: string | undefined;
    do {
      const page = await this.client.send(new ListQueuesCommand({
        MaxResults: 1000,
        ...(nextToken && { NextToken: nextToken }),
      }));
      for (const url of page.QueueUrls ?? []) urls.add(url);
      nextToken = page.NextToken;
    } while (nextToken);
    return [...urls].map((url) => ({
      id: `aws-sqs:${encodeURIComponent(url)}`,
      name: this.extractQueueNameFromUrl(url),
      provider: 'aws' as const,
      type: 'queue' as const,
      status: 'active' as const,
    }));
  }

  async sendMessage(dto: SendSqsMessageDto) {
    const queueName = dto.queueUrl
      ? this.extractQueueNameFromUrl(dto.queueUrl)
      : (dto.queueName ?? this.config.awsSqsQueueName);

    const queueUrl = await this.getOrCreateQueueUrl(dto.queueUrl || queueName);
    const messageId = dto.messageId ?? randomUUID();
    const body = this.parseBody(dto.body);

    const command = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: typeof body === 'string' ? body : JSON.stringify(body),
      MessageAttributes: {
        ...(dto.messageAttributes || {}),
        sentBy: { DataType: 'String', StringValue: dto.sentBy ?? 'aws-sqs-api' },
        ...(dto.messageDisposition && {
          messageDisposition: { DataType: 'String', StringValue: dto.messageDisposition },
        }),
      },
      ...(dto.messageGroupId && { MessageGroupId: dto.messageGroupId }),
      ...(dto.messageDeduplicationId && { MessageDeduplicationId: dto.messageDeduplicationId }),
      ...(dto.delaySeconds !== undefined && { DelaySeconds: dto.delaySeconds }),
    });

    let response;
    try {
      response = await this.client.send(command);
    } catch (error) {
      response = await this.handleSendError(error, dto, queueName, queueUrl, body);
    }

    try {
      await this.messageService.createTracking({
        messageId: response.MessageId || messageId,
        body: typeof body === 'string' ? body : JSON.stringify(body),
        sentBy: dto.sentBy ?? 'aws-sqs-api',
        sentAt: new Date(),
        status: 'processing',
        queue: queueName,
        emulatorType: 'sqs',
      });
    } catch (error) {
      this.logger.error(`Failed to create tracking entry for message ${response.MessageId || messageId}:`,
        error,
      );
    }

    this.logger.log(
      `Sent SQS message ${response.MessageId || messageId} to ${queueName}`,
    );
    if (this.config.manualProcessing && !this.isShuttingDown) {
      await this.startPolling(queueName);
    }

    return {
      queueName,
      queueUrl,
      messageId: response.MessageId || messageId,
      md5OfBody: response.MD5OfMessageBody,
    };
  }

  async getMessages(): Promise<TrackingMessage[]> {
    const messages =
      await this.messageService.findTrackingMessagesByEmulator('sqs');
    return messages.map((message) => ({
      ...message,
      pendingDeliveries: this.pendingDeliveries.list(
        String((message as { _id?: unknown })._id),
      ),
    }));
  }

  async receiveMessage(dto: ReceiveSqsMessageDto) {
    const queueName = dto.queueUrl
      ? this.extractQueueNameFromUrl(dto.queueUrl)
      : this.config.awsSqsQueueName;

    const queueUrl = await this.getOrCreateQueueUrl(dto.queueUrl || queueName);

    const command = new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: dto.maxNumberOfMessages ?? 1,
      WaitTimeSeconds: dto.waitTimeSeconds ?? 0,
      MessageAttributeNames: ['All'],
    });

    let response;
    try {
      response = await this.client.send(command);
    } catch (error) {
      response = await this.handleReceiveError(error, dto, queueName);
    }

    if (!response.Messages || response.Messages.length === 0) {
      return { success: false, message: 'No messages available', data: null };
    }

    const message = response.Messages[0];
    const messageId = message.MessageId || message.ReceiptHandle?.substring(0, 20) || randomUUID();

    if (message.MessageId) {
      await this.messageService.markMessageReceived(
        message.MessageId,
        'sqs',
        dto.receivedBy,
      );
    }

    // Delete the message after receiving
    if (message.ReceiptHandle) {
      await this.client.send(new DeleteMessageCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: message.ReceiptHandle,
      }));
    }

    this.logger.log(`Received SQS message ${messageId} from ${queueName} by ${dto.receivedBy}`);

    return {
      success: true,
      message: 'Message received successfully',
      data: {
        queueName,
        queueUrl,
        messageId: message.MessageId,
        receiptHandle: message.ReceiptHandle,
        body: message.Body,
        messageAttributes: message.MessageAttributes,
        md5OfBody: message.MD5OfBody,
      },
    };
  }

  async ping(): Promise<void> {
    try {
      await this.client.send(
        new GetQueueUrlCommand({ QueueName: this.config.awsSqsQueueName }),
      );
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      if (this.isConnectionError(errorMessage, error)) {
        throw new AwsSqsConnectionException(
          `Cannot connect to LocalStack at ${this.config.awsSqsEndpoint}. ` +
          `Please ensure LocalStack is running: docker compose up localstack. ` +
          `Original error: ${errorMessage}`,
        );
      }
      throw error;
    }
  }

  async onModuleInit() {
    this.logger.log('Initializing SQS worker...');
    try {
      await this.startPolling(this.config.awsSqsQueueName);
      this.logger.log('SQS worker initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize SQS worker:', error);
    }
  }

  async onModuleDestroy() {
    this.isShuttingDown = true;
    this.pendingDeliveries.releaseAll();

    for (const [queueName, interval] of this.pollingIntervals) {
      clearInterval(interval);
      this.logger.log(`Stopped polling for queue: ${queueName}`);
    }
    this.pollingIntervals.clear();

    await Promise.allSettled(Array.from(this.pollingTasks.values()));
    this.pollingTasks.clear();
    this.queueUrlCache.clear();
    this.client.destroy();
  }

  private async startPolling(queueName: string) {
    if (this.pollingIntervals.has(queueName)) {
      this.logger.warn(`Already polling for queue: ${queueName}`);
      return;
    }

    this.logger.log(`Starting to poll for messages in queue: ${queueName}`);

    const interval = setInterval(() => this.schedulePoll(queueName), 5000);

    this.pollingIntervals.set(queueName, interval);
  }

  private schedulePoll(queueName: string): void {
    if (this.isShuttingDown || this.pollingTasks.has(queueName)) {
      return;
    }

    const pollingTask = this.pollAndProcessMessages(queueName)
      .catch((error) => {
        this.logger.error(`Error polling messages for queue ${queueName}:`, error);
      })
      .finally(() => {
        this.pollingTasks.delete(queueName);
      });

    this.pollingTasks.set(queueName, pollingTask);
  }

  private async pollAndProcessMessages(queueName: string) {
    try {
      const queueUrl = await this.getOrCreateQueueUrl(queueName);

      const response = await this.client.send(
        new ReceiveMessageCommand({
          QueueUrl: queueUrl,
          MaxNumberOfMessages: 1,
          WaitTimeSeconds: 0,
          MessageAttributeNames: ['All'],
          ...(this.config.manualProcessing ? { VisibilityTimeout: 120 } : {}),
          MessageSystemAttributeNames: ['All'],
        }),
      );

      if (!response.Messages || response.Messages.length === 0) {
        return;
      }

      const message = response.Messages[0];
      const messageId =
        message.MessageId ||
        message.ReceiptHandle?.substring(0, 20) ||
        randomUUID();
      const tracking = await this.messageService.ensureTracking({
        messageId,
        body: message.Body ?? '',
        sentBy:
          message.MessageAttributes?.sentBy?.StringValue ?? 'external-sqs',
        sentAt: new Date(),
        status: 'processing',
        queue: queueName,
        emulatorType: 'sqs',
      });
      if (this.config.manualProcessing) {
        const actions = this.createDispositionActions();
        const delivery = { message, queueUrl };
        let copiedToDlq = false;
        await this.pendingDeliveries.hold(String(tracking._id), queueName, {
          complete: () => actions.complete(delivery),
          abandon: () => actions.abandon(delivery),
          defer: () => actions.defer(delivery),
          deadletter: async () => {
            if (!message.ReceiptHandle)
              throw new Error('Message has no receipt handle');
            const fifo = queueName.endsWith('.fifo');
            const dlqName = fifo
              ? `${queueName.slice(0, -5).slice(0, 71)}-dlq.fifo`
              : `${queueName.slice(0, 76)}-dlq`;
            const dlqUrl = await this.getOrCreateQueueUrl(dlqName);
            if (!copiedToDlq) {
              await this.client.send(
                new SendMessageCommand({
                  QueueUrl: dlqUrl,
                  MessageBody: message.Body ?? '',
                  MessageAttributes: message.MessageAttributes,
                  ...(fifo
                    ? {
                        MessageGroupId:
                          message.Attributes?.MessageGroupId ?? 'dashboard',
                        MessageDeduplicationId: message.MessageId,
                      }
                    : {}),
                }),
              );
              copiedToDlq = true;
            }
            await actions.complete(delivery);
          },
        });
        return;
      }
      const disposition = MessageProcessor.normalizeDisposition(
        message.MessageAttributes?.messageDisposition?.StringValue,
      );

      await this.messageProcessor.processMessage(
        { message, queueUrl },
        {
          messageId,
          disposition,
          queueName,
          receivedBy: 'sqs-worker',
          emulatorType: 'sqs',
        },
        this.createDispositionActions(),
      );
    } catch (error) {
      this.logger.error(
        `Error processing messages for queue ${queueName}:`,
        error,
      );
    }
  }

  private createDispositionActions(): DispositionActions<{
    message: Message;
    queueUrl: string;
  }> {
    return {
      complete: async ({ message, queueUrl }) => {
        if (message.ReceiptHandle) {
          await this.client.send(
            new DeleteMessageCommand({
              QueueUrl: queueUrl,
              ReceiptHandle: message.ReceiptHandle,
            }),
          );
        }
      },
      abandon: async ({ message, queueUrl }) => {
        if (message.ReceiptHandle) {
          await this.client.send(
            new ChangeMessageVisibilityCommand({
              QueueUrl: queueUrl,
              ReceiptHandle: message.ReceiptHandle,
              VisibilityTimeout: 0,
            }),
          );
        }
      },
      deadletter: async () => {
        // Don't delete - configure redrive policy for DLQ
      },
      defer: async ({ message, queueUrl }) => {
        if (message.ReceiptHandle) {
          await this.client.send(
            new ChangeMessageVisibilityCommand({
              QueueUrl: queueUrl,
              ReceiptHandle: message.ReceiptHandle,
              VisibilityTimeout: 300, // 5 minutes
            }),
          );
        }
      },
    };
  }

  private parseBody(body: string): unknown {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }

  private extractQueueNameFromUrl(queueUrl: string): string {
    const parts = queueUrl.split('/');
    return parts[parts.length - 1];
  }

  private async getOrCreateQueueUrl(queueNameOrUrl: string): Promise<string> {
    if (queueNameOrUrl.startsWith('http://') || queueNameOrUrl.startsWith('https://')) {
      return queueNameOrUrl;
    }

    const cached = this.queueUrlCache.get(queueNameOrUrl);
    if (cached) return cached;

    try {
      const response = await this.client.send(new GetQueueUrlCommand({ QueueName: queueNameOrUrl }));
      if (response.QueueUrl) {
        this.queueUrlCache.set(queueNameOrUrl, response.QueueUrl);
        return response.QueueUrl;
      }
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);

      if (this.isConnectionError(errorMessage, error)) {
        throw new AwsSqsConnectionException(
          `Cannot connect to LocalStack at ${this.config.awsSqsEndpoint}. ` +
          `Please ensure LocalStack is running: docker compose up localstack.`,
        );
      }

      if (!this.isQueueNotExistError(error, errorMessage)) {
        throw error;
      }

      this.logger.log(`Queue ${queueNameOrUrl} not found, attempting to create...`);
    }

    return this.createQueue(queueNameOrUrl);
  }

  private async createQueue(queueName: string): Promise<string> {
    try {
      const createResponse = await this.client.send(
        new CreateQueueCommand({
          QueueName: queueName,
          ...(queueName.endsWith('.fifo')
            ? {
                Attributes: {
                  FifoQueue: 'true',
                  ContentBasedDeduplication: 'true',
                },
              }
            : {}),
        }),
      );

      if (!createResponse.QueueUrl) {
        throw new Error(
          `Queue creation succeeded but no QueueUrl was returned for ${queueName}`,
        );
      }

      // Verify queue exists
      let verifiedUrl = createResponse.QueueUrl;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0)
          await new Promise((resolve) => setTimeout(resolve, 100));
        try {
          const verifyResponse = await this.client.send(
            new GetQueueUrlCommand({ QueueName: queueName }),
          );
          if (verifyResponse.QueueUrl) {
            verifiedUrl = verifyResponse.QueueUrl;
            break;
          }
        } catch {
          // Continue retrying
        }
      }

      this.queueUrlCache.set(queueName, verifiedUrl);
      this.logger.log(`Created queue ${queueName} with URL: ${verifiedUrl}`);
      return verifiedUrl;
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);

      if (this.isConnectionError(errorMessage, error)) {
        throw new AwsSqsConnectionException(
          `Cannot connect to LocalStack at ${this.config.awsSqsEndpoint}. ` +
            `Please ensure LocalStack is running: docker compose up localstack.`,
        );
      }

      throw new AwsSqsConnectionException(
        `Failed to create queue ${queueName}: ${errorMessage}`,
      );
    }
  }

  private extractErrorMessage(error: unknown): string {
    if (error && typeof error === 'object' && 'errors' in error && Array.isArray((error as { errors: unknown[] }).errors)) {
      const firstError = (error as { errors: unknown[] }).errors[0];
      return firstError instanceof Error ? firstError.message : String(firstError);
    }
    return error instanceof Error ? error.message : String(error);
  }

  private isConnectionError(errorMessage: string, error: unknown): boolean {
  return (
    errorMessage.includes('ECONNREFUSED') ||
    errorMessage.includes('connect') ||
    errorMessage.includes('AggregateError') ||
    errorMessage.includes('ENOTFOUND') ||
    errorMessage.includes('ETIMEDOUT') ||
    errorMessage.includes('getaddrinfo') ||
    errorMessage.includes('EAI_AGAIN') ||
    (error instanceof Error && error.name === 'AggregateError') ||
    Boolean(error && typeof error === 'object' && 'errors' in error)
  );
}

  private isQueueNotExistError(error: unknown, errorMessage: string): boolean {
    const errorName = (error as { name?: string })?.name || '';
    const errorCode = (error as { Code?: string })?.Code || '';

    return (
      errorMessage.includes('does not exist') ||
      errorMessage.includes('NonExistentQueue') ||
      errorMessage.includes('AWS.SimpleQueueService.NonExistentQueue') ||
      errorName === 'QueueDoesNotExist' ||
      errorName === 'AWS.SimpleQueueService.NonExistentQueue' ||
      errorCode === 'AWS.SimpleQueueService.NonExistentQueue' ||
      errorCode === 'NonExistentQueue'
    );
  }

  private async handleSendError(
    error: unknown,
    dto: SendSqsMessageDto,
    queueName: string,
    queueUrl: string,
    body: unknown,
  ) {
    const errorMessage = this.extractErrorMessage(error);

    if (!this.isQueueNotExistError(error, errorMessage)) {
      this.logger.error(`Error sending message to queue ${queueName}:`, error);
      throw error;
    }

    this.logger.warn(`Queue ${queueName} not found, clearing cache and retrying...`);
    this.queueUrlCache.delete(queueName);

    const retryQueueUrl = await this.getOrCreateQueueUrl(dto.queueUrl || queueName);

    return this.client.send(new SendMessageCommand({
      QueueUrl: retryQueueUrl,
      MessageBody: typeof body === 'string' ? body : JSON.stringify(body),
      MessageAttributes: {
        ...(dto.messageAttributes || {}),
        sentBy: { DataType: 'String', StringValue: dto.sentBy ?? 'aws-sqs-api' },
        ...(dto.messageDisposition && {
          messageDisposition: { DataType: 'String', StringValue: dto.messageDisposition },
        }),
      },
      ...(dto.messageGroupId && { MessageGroupId: dto.messageGroupId }),
      ...(dto.messageDeduplicationId && { MessageDeduplicationId: dto.messageDeduplicationId }),
      ...(dto.delaySeconds !== undefined && { DelaySeconds: dto.delaySeconds }),
    }));
  }

  private async handleReceiveError(error: unknown, dto: ReceiveSqsMessageDto, queueName: string) {
    const errorMessage = this.extractErrorMessage(error);

    if (!this.isQueueNotExistError(error, errorMessage)) {
      throw error;
    }

    this.logger.warn(`Queue ${queueName} not found when receiving message, clearing cache and retrying...`);
    this.queueUrlCache.delete(queueName);

    const retryQueueUrl = await this.getOrCreateQueueUrl(dto.queueUrl || queueName);

    return this.client.send(new ReceiveMessageCommand({
      QueueUrl: retryQueueUrl,
      MaxNumberOfMessages: dto.maxNumberOfMessages ?? 1,
      WaitTimeSeconds: dto.waitTimeSeconds ?? 0,
      MessageAttributeNames: ['All'],
    }));
  }
}
