import { Provider, ResourceType, type MessagingResource } from './entities';

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
    ...(resource.subscriptions?.length
      ? { subscriptions: resource.subscriptions }
      : {}),
  };
}
