import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface ServiceBusConfig {
  UserConfig: {
    Namespaces: ServiceBusNamespace[];
    Logging: LoggingConfig;
  };
}

export interface ServiceBusNamespace {
  Name: string;
  Topics?: ServiceBusTopic[];
  Queues?: ServiceBusQueue[];
}

export interface ServiceBusTopic {
  Name: string;
  Properties: TopicProperties;
  Subscriptions: ServiceBusSubscription[];
}

export interface ServiceBusQueue {
  Name: string;
  Properties: QueueProperties;
}

export interface TopicProperties {
  readonly DefaultMessageTimeToLive: string;
  readonly DuplicateDetectionHistoryTimeWindow: string;
  readonly RequiresDuplicateDetection: boolean;
}

export interface ServiceBusSubscription {
  Name: string;
  DeadLetteringOnMessageExpiration: boolean;
  MaxDeliveryCount: number;
}

export interface QueueProperties {
  readonly DefaultMessageTimeToLive: string;
  readonly MaxDeliveryCount: number;
  readonly DeadLetteringOnMessageExpiration: boolean;
}

export interface LoggingConfig {
  readonly Type: 'console' | 'file' | 'applicationInsights';
}

@Injectable()
export class AppConfigService {
  constructor(private readonly config: NestConfigService) {}

  get port(): number {
    return this.config.get<number>('PORT', 3000);
  }

  get manualProcessing(): boolean {
    return (
      this.config.get<string>('MESSAGE_PROCESSING_MODE', 'manual') === 'manual'
    );
  }

  get nodeEnv(): string {
    return this.config.get<string>('NODE_ENV', 'development');
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  get corsOrigin(): string | string[] {
    const origin = this.config.get<string>('CORS_ORIGIN', 'http://localhost:4200');
    return origin.includes(',') ? origin.split(',').map((o) => o.trim()) : origin;
  }

  get logLevel(): string {
    return this.config.get<string>('LOG_LEVEL', 'info');
  }

  get serviceBusConnectionString(): string {
    return (
      this.config.get<string>('SERVICE_BUS_CONNECTION_STRING') ||
      'Endpoint=sb://localhost;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;UseDevelopmentEmulator=true'
    );
  }

  get serviceBusNamespace(): string {
    return this.config.get<string>('SERVICE_BUS_NAMESPACE', 'sbemulatorns');
  }

  get serviceBusQueue(): string {
    return this.config.get<string>('SERVICE_BUS_QUEUE', 'orders-queue');
  }

  get mongoUri(): string {
    return this.config.get<string>('MONGO_URI', 'mongodb://testuser:testpass@localhost:27017/');
  }

  get mongoTrackingDbName(): string {
    return this.config.get<string>('MONGO_MESSAGE_DB', 'MessageTrackingDb');
  }

  get mongoAuthSource(): string {
    return this.config.get<string>('MONGO_AUTH_SOURCE', 'admin');
  }

  get serviceBusMaxRetries(): number {
    return this.config.get<number>('SERVICE_BUS_MAX_RETRIES', 3);
  }

  get serviceBusRetryDelay(): number {
    return this.config.get<number>('SERVICE_BUS_RETRY_DELAY', 1000);
  }

  get throttleTtl(): number {
    return this.config.get<number>('THROTTLE_TTL', 60);
  }

  get throttleLimit(): number {
    return this.config.get<number>('THROTTLE_LIMIT', 60);
  }

  get awsSqsEndpoint(): string {
    return this.config.get<string>('AWS_SQS_ENDPOINT', 'http://localhost:4566');
  }

  get awsRegion(): string {
    return this.config.get<string>('AWS_REGION', 'us-east-1');
  }

  get awsAccessKeyId(): string {
    return this.config.get<string>('AWS_ACCESS_KEY_ID', 'test');
  }

  get awsSecretAccessKey(): string {
    return this.config.get<string>('AWS_SECRET_ACCESS_KEY', 'test');
  }

  get awsSqsQueueName(): string {
    return this.config.get<string>('AWS_SQS_QUEUE_NAME', 'orders-queue');
  }


  getServiceBusConfig() {
    return {
      connectionString: this.serviceBusConnectionString,
      namespace: this.serviceBusNamespace,
      maxRetries: this.serviceBusMaxRetries,
      retryDelay: this.serviceBusRetryDelay,
    };
  }

  getServiceBusConfiguration(): ServiceBusConfig {
    try {
      const possiblePaths = [
        join(process.cwd(), '..', '..', 'config', 'servicebus-config.json'),
        join(process.cwd(), 'config', 'servicebus-config.json'),
        join(__dirname, '..', '..', '..', '..', 'config', 'servicebus-config.json'),
        join(__dirname, '..', '..', 'config', 'servicebus-config.json'),
      ];

      let configData: string | null = null;

      for (const filePath of possiblePaths) {
        try {
          configData = readFileSync(filePath, 'utf8');
          break;
        } catch {
          // try next path
        }
      }

      if (!configData) {
        throw new Error('Configuration file not found in any expected location. Expected: root/config/servicebus-config.json');
      }

      const config = JSON.parse(configData);
      if (!config.UserConfig?.Namespaces) {
        throw new Error('Invalid configuration structure: missing UserConfig.Namespaces');
      }

      return config;
    } catch (error) {
      console.error('Failed to load Service Bus configuration from file:', error);
      return this.getDefaultServiceBusConfig();
    }
  }

  private getDefaultServiceBusConfig(): ServiceBusConfig {
    return {
      UserConfig: {
        Namespaces: [
          {
            Name: this.serviceBusNamespace,
            Topics: [
              {
                Name: 'test-topic',
                Properties: {
                  DefaultMessageTimeToLive: 'P14D',
                  DuplicateDetectionHistoryTimeWindow: 'PT10M',
                  RequiresDuplicateDetection: false,
                },
                Subscriptions: [
                  {
                    Name: 'test-subscription',
                    DeadLetteringOnMessageExpiration: true,
                    MaxDeliveryCount: 10,
                  },
                ],
              },
            ],
            Queues: [
              {
                Name: 'test-queue',
                Properties: {
                  DefaultMessageTimeToLive: 'P14D',
                  MaxDeliveryCount: 10,
                  DeadLetteringOnMessageExpiration: true,
                },
              },
            ],
          },
        ],
        Logging: {
          Type: 'console',
        },
      },
    };
  }

  getAwsSqsConfiguration() {
    return {
      endpoint: this.awsSqsEndpoint,
      region: this.awsRegion,
      queueName: this.awsSqsQueueName,
    };
  }

}
