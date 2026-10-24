import { readFileSync } from 'fs';
import { join } from 'path';

export interface ServiceBusConfig {
  UserConfig: { Namespaces: ServiceBusNamespace[]; Logging: LoggingConfig };
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

export function defaultServiceBusConfig(namespace: string): ServiceBusConfig {
  return {
    UserConfig: {
      Namespaces: [
        {
          Name: namespace,
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
      Logging: { Type: 'console' },
    },
  };
}

/** Loads metadata for AI context; this does not connect to a broker. */
export function loadServiceBusConfig(namespace: string): ServiceBusConfig {
  const candidates = [
    join(process.cwd(), '..', '..', 'config', 'servicebus-config.json'),
    join(process.cwd(), 'config', 'servicebus-config.json'),
    join(__dirname, '..', '..', '..', '..', 'config', 'servicebus-config.json'),
    join(__dirname, '..', '..', 'config', 'servicebus-config.json'),
  ];
  try {
    let content: string | undefined;
    for (const file of candidates) {
      try {
        content = readFileSync(file, 'utf8');
        break;
      } catch {
        /* Try the next supported location. */
      }
    }
    if (!content)
      throw new Error(
        'Configuration file not found in any expected location. Expected: root/config/servicebus-config.json',
      );
    const config = JSON.parse(content) as ServiceBusConfig;
    if (!config.UserConfig?.Namespaces)
      throw new Error(
        'Invalid configuration structure: missing UserConfig.Namespaces',
      );
    return config;
  } catch (error) {
    console.error('Failed to load Service Bus configuration from file:', error);
    return defaultServiceBusConfig(namespace);
  }
}
