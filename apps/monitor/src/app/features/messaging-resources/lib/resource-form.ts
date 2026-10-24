import { Provider, ResourceType, type MessagingResource } from './entities';
import { serviceBusConfig } from './broker-config';

export type ResourceForm = Omit<MessagingResource, 'id'>;

export const emptyResourceForm: ResourceForm = {
  name: '',
  provider: Provider.AWS,
  type: ResourceType.QUEUE,
  status: 'active',
};

export function resourceForm(resource: MessagingResource): ResourceForm {
  return {
    name: resource.name,
    provider: resource.provider,
    type: resource.type,
    status: resource.status,
  };
}

export const configuredResources: MessagingResource[] = [
  ...serviceBusConfig.Topics.map((topic) => ({
    id: `azure-topic-${topic.Name}`,
    name: topic.Name,
    provider: Provider.AZURE,
    type: ResourceType.TOPIC,
    status: 'active' as const,
  })),
  ...serviceBusConfig.Queues.map((queue) => ({
    id: `azure-queue-${queue.Name}`,
    name: queue.Name,
    provider: Provider.AZURE,
    type: ResourceType.QUEUE,
    status: 'active' as const,
  })),
];
