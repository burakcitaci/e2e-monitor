export const serviceBusConfig = {
  Topics: [
    {
      Name: 'system-messages',
      Properties: {
        DefaultMessageTimeToLive: 'PT1H',
        DuplicateDetectionHistoryTimeWindow: 'PT20S',
        RequiresDuplicateDetection: false,
      },
      Subscriptions: [
        {
          Name: 'funcapp-processor-dev',
          DeadLetteringOnMessageExpiration: true,
          MaxDeliveryCount: 10,
        },
      ],
    },
    {
      Name: 'application-events',
      Properties: {
        DefaultMessageTimeToLive: 'PT1H',
        DuplicateDetectionHistoryTimeWindow: 'PT30S',
        RequiresDuplicateDetection: true,
      },
      Subscriptions: [
        {
          Name: 'analytics-processor',
          DeadLetteringOnMessageExpiration: true,
          MaxDeliveryCount: 5,
        },
        {
          Name: 'logging-service',
          DeadLetteringOnMessageExpiration: false,
          MaxDeliveryCount: 3,
        },
      ],
    },
  ],
  Queues: [
    {
      Name: 'orders-queue',
      Properties: {
        DefaultMessageTimeToLive: 'PT1H',
        MaxDeliveryCount: 10,
        DeadLetteringOnMessageExpiration: true,
      },
    },
    {
      Name: 'notifications-queue',
      Properties: {
        DefaultMessageTimeToLive: 'PT1H',
        MaxDeliveryCount: 5,
        DeadLetteringOnMessageExpiration: true,
      },
    },
  ],
};
