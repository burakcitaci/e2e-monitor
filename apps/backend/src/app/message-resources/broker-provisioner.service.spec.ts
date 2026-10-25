import { ConfigService } from '@nestjs/config';
import { ServiceBusAdministrationClient } from '@azure/service-bus';
import { SQSClient, CreateQueueCommand } from '@aws-sdk/client-sqs';
import { SNSClient, CreateTopicCommand } from '@aws-sdk/client-sns';
import { BrokerProvisionerService } from './broker-provisioner.service';
import { Provider, ResourceType } from './message-resources.schema';

describe('broker provisioning', () => {
  let service: BrokerProvisionerService;
  beforeEach(() => {
    service = new BrokerProvisionerService(new ConfigService());
  });
  afterEach(() => {
    service.onModuleDestroy();
    jest.restoreAllMocks();
  });
  it('creates an Azure topic and each missing subscription, while reusing existing ones', async () => {
    jest
      .spyOn(ServiceBusAdministrationClient.prototype, 'topicExists')
      .mockResolvedValue(false);
    const create = jest
      .spyOn(ServiceBusAdministrationClient.prototype, 'createTopic')
      .mockResolvedValue({} as never);
    jest
      .spyOn(ServiceBusAdministrationClient.prototype, 'subscriptionExists')
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const subscribe = jest
      .spyOn(ServiceBusAdministrationClient.prototype, 'createSubscription')
      .mockResolvedValue({} as never);
    await service.ensure({
      name: 'events',
      provider: Provider.AZURE,
      type: ResourceType.TOPIC,
      subscriptions: ['existing', 'logging-service'],
    });
    expect(create).toHaveBeenCalledWith('events', expect.any(Object));
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledWith(
      'events',
      'logging-service',
      expect.any(Object),
    );
  });
  it('reuses an existing Azure queue without consuming messages', async () => {
    jest
      .spyOn(ServiceBusAdministrationClient.prototype, 'queueExists')
      .mockResolvedValue(true);
    const create = jest.spyOn(
      ServiceBusAdministrationClient.prototype,
      'createQueue',
    );
    await service.ensure({
      name: 'orders',
      provider: Provider.AZURE,
      type: ResourceType.QUEUE,
    });
    expect(create).not.toHaveBeenCalled();
  });
  it('accepts a concurrent Azure create only if the requested entity actually exists', async () => {
    const exists = jest
      .spyOn(ServiceBusAdministrationClient.prototype, 'queueExists')
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    jest
      .spyOn(ServiceBusAdministrationClient.prototype, 'createQueue')
      .mockRejectedValue({ statusCode: 409 });
    await expect(
      service.ensure({
        name: 'orders',
        provider: Provider.AZURE,
        type: ResourceType.QUEUE,
      }),
    ).resolves.toContain('orders');
    exists.mockResolvedValue(false);
    await expect(
      service.ensure({
        name: 'orders',
        provider: Provider.AZURE,
        type: ResourceType.QUEUE,
      }),
    ).rejects.toThrow('Could not provision');
  });
  it('provisions AWS queues through SQS and topics through SNS', async () => {
    const queue = jest
      .spyOn(SQSClient.prototype, 'send')
      .mockResolvedValue({ QueueUrl: 'http://local/queue' } as never);
    const topic = jest
      .spyOn(SNSClient.prototype, 'send')
      .mockResolvedValue({ TopicArn: 'arn:aws:sns:topic' } as never);
    await expect(
      service.ensure({
        name: 'orders',
        provider: Provider.AWS,
        type: ResourceType.QUEUE,
      }),
    ).resolves.toBe('http://local/queue');
    await expect(
      service.ensure({
        name: 'events',
        provider: Provider.AWS,
        type: ResourceType.TOPIC,
      }),
    ).resolves.toBe('arn:aws:sns:topic');
    expect(queue.mock.calls[0][0]).toBeInstanceOf(CreateQueueCommand);
    expect(topic.mock.calls[0][0]).toBeInstanceOf(CreateTopicCommand);
  });
  it('exposes broker failure without credentials and rejects subscriptions on queues', async () => {
    jest
      .spyOn(ServiceBusAdministrationClient.prototype, 'queueExists')
      .mockRejectedValue(new Error('secret-key'));
    await expect(
      service.ensure({
        name: 'orders',
        provider: Provider.AZURE,
        type: ResourceType.QUEUE,
      }),
    ).rejects.toThrow('MongoDB record was not saved');
    await expect(
      service.ensure({
        name: 'orders',
        provider: Provider.AWS,
        type: ResourceType.QUEUE,
        subscriptions: ['sub'],
      }),
    ).rejects.toThrow('only be specified for Azure topics');
  });
});
