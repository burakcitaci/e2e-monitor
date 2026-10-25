import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServiceBusAdministrationClient } from '@azure/service-bus';
import { CreateQueueCommand, SQSClient } from '@aws-sdk/client-sqs';
import { CreateTopicCommand, SNSClient } from '@aws-sdk/client-sns';
import { CreateMessageResourceDto } from './dto/create-message.dto';
import { Provider, ResourceType } from './message-resources.schema';

@Injectable()
export class BrokerProvisionerService implements OnModuleDestroy {
  private readonly azure: ServiceBusAdministrationClient;
  private readonly azureEndpoint: string;
  private readonly sqs: SQSClient;
  private readonly sns: SNSClient;

  constructor(config: ConfigService) {
    const connection = config.get<string>(
      'SERVICE_BUS_ADMIN_CONNECTION_STRING',
      'Endpoint=sb://localhost:5300;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=SAS_KEY_VALUE;UseDevelopmentEmulator=true;',
    );
    this.azureEndpoint = /Endpoint=([^;]+)/i.exec(connection)?.[1] ?? '';
    this.azure = new ServiceBusAdministrationClient(connection, {
      retryOptions: { maxRetries: 1 },
    });
    const endpoint = config.get<string>(
      'AWS_ENDPOINT_URL',
      'http://localhost:4566',
    );
    const options = {
      endpoint: endpoint || undefined,
      region: config.get<string>('AWS_REGION', 'us-east-1'),
      ...(endpoint
        ? {
            credentials: {
              accessKeyId: config.get<string>('AWS_ACCESS_KEY_ID', 'test'),
              secretAccessKey: config.get<string>(
                'AWS_SECRET_ACCESS_KEY',
                'test',
              ),
            },
          }
        : {}),
      maxAttempts: 2,
    };
    this.sqs = new SQSClient(options);
    this.sns = new SNSClient(options);
  }

  async ensure(resource: CreateMessageResourceDto): Promise<string> {
    if (
      resource.subscriptions?.length &&
      (resource.provider !== Provider.AZURE ||
        resource.type !== ResourceType.TOPIC)
    ) {
      throw new BadRequestException(
        'Subscriptions can only be specified for Azure topics.',
      );
    }
    try {
      if (resource.provider === Provider.AWS) {
        const signal = AbortSignal.timeout(15000);
        if (resource.type === ResourceType.QUEUE) {
          const result = await this.sqs.send(
            new CreateQueueCommand({
              QueueName: resource.name,
              ...(resource.name.endsWith('.fifo')
                ? { Attributes: { FifoQueue: 'true' } }
                : {}),
            }),
            { abortSignal: signal },
          );
          if (!result.QueueUrl) throw new Error('Missing queue URL');
          return result.QueueUrl;
        }
        const result = await this.sns.send(
          new CreateTopicCommand({
            Name: resource.name,
            ...(resource.name.endsWith('.fifo')
              ? { Attributes: { FifoTopic: 'true' } }
              : {}),
          }),
          { abortSignal: signal },
        );
        if (!result.TopicArn) throw new Error('Missing topic ARN');
        return result.TopicArn;
      }
      const operation = { abortSignal: AbortSignal.timeout(15000) };
      const exists =
        resource.type === ResourceType.TOPIC
          ? await this.azure.topicExists(resource.name, operation)
          : await this.azure.queueExists(resource.name, operation);
      if (!exists) {
        await this.createAzureEntity(
          () =>
            resource.type === ResourceType.TOPIC
              ? this.azure.createTopic(resource.name, operation)
              : this.azure.createQueue(resource.name, operation),
          () =>
            resource.type === ResourceType.TOPIC
              ? this.azure.topicExists(resource.name, operation)
              : this.azure.queueExists(resource.name, operation),
        );
      }
      for (const subscription of new Set(resource.subscriptions ?? [])) {
        if (
          !(await this.azure.subscriptionExists(
            resource.name,
            subscription,
            operation,
          ))
        ) {
          await this.createAzureEntity(
            () =>
              this.azure.createSubscription(
                resource.name,
                subscription,
                operation,
              ),
            () =>
              this.azure.subscriptionExists(
                resource.name,
                subscription,
                operation,
              ),
          );
        }
      }
      return `${this.azureEndpoint.replace(/\/$/, '')}/${resource.name}`;
    } catch (error) {
      // SDK errors may contain connection details: expose only the provider error code.
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String(error.code)
          : error instanceof Error
            ? error.name
            : 'UnknownError';
      throw new BadGatewayException(
        `Could not provision ${resource.provider} ${resource.type} (${code}). Check the broker endpoint, credentials and entity name. The MongoDB record was not saved; retrying is safe.`,
      );
    }
  }

  private async createAzureEntity(
    create: () => Promise<unknown>,
    exists: () => Promise<boolean>,
  ) {
    try {
      await create();
    } catch (error) {
      if (
        !error ||
        typeof error !== 'object' ||
        !('statusCode' in error) ||
        error.statusCode !== 409 ||
        !(await exists())
      )
        throw error;
    }
  }

  onModuleDestroy() {
    this.sqs.destroy();
    this.sns.destroy();
  }
}
