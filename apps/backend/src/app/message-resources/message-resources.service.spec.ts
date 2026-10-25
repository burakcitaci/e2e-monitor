import { MessageResourcesService } from './message-resources.service';
import { Provider, ResourceType } from './message-resources.schema';

describe('resource persistence after provisioning', () => {
  const dto = {
    name: 'events',
    provider: Provider.AZURE,
    type: ResourceType.TOPIC,
    subscriptions: ['logging-service'],
  };
  const exec = jest.fn();
  const findOneAndUpdate = jest.fn(() => ({ lean: () => ({ exec }) }));
  const ensure = jest.fn();
  const service = new MessageResourcesService(
    { findOneAndUpdate } as never,
    { ensure } as never,
  );
  beforeEach(() => {
    jest.clearAllMocks();
    ensure.mockResolvedValue('sb://local/events');
    exec.mockResolvedValue({ ...dto, id: 'existing-id' });
  });
  it('upserts by broker identity only after successful provisioning', async () => {
    await expect(service.createMessageResource(dto)).resolves.toMatchObject({
      id: 'existing-id',
    });
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { provider: 'azure', type: 'topic', name: 'events' },
      expect.objectContaining({
        $set: { brokerAddress: 'sb://local/events', status: 'active' },
      }),
      { new: true, upsert: true, runValidators: true },
    );
    expect(ensure.mock.invocationCallOrder[0]).toBeLessThan(
      findOneAndUpdate.mock.invocationCallOrder[0],
    );
  });
  it('does not save a success record when broker provisioning fails', async () => {
    ensure.mockRejectedValue(new Error('broker unavailable'));
    await expect(service.createMessageResource(dto)).rejects.toThrow(
      'broker unavailable',
    );
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('reports partial success and permits safe reconciliation after MongoDB failure', async () => {
    exec.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(service.createMessageResource(dto)).rejects.toThrow(
      'broker resource exists',
    );
    await expect(service.createMessageResource(dto)).resolves.toMatchObject({
      id: 'existing-id',
    });
  });
});
