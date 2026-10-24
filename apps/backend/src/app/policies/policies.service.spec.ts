import { PoliciesService } from './policies.service';

describe('PoliciesService serialization', () => {
  it('normalizes MongoDB policy IDs to API strings', async () => {
    const mongoId = { toString: () => 'policy-id' };
    const exec = jest
      .fn()
      .mockResolvedValue([{ _id: mongoId, name: 'Policy' }]);
    const model = {
      find: () => ({
        sort: () => ({ lean: () => ({ exec }) }),
      }),
    };
    const evaluator = {
      latest: jest.fn().mockResolvedValue(new Map()),
    };
    const service = new PoliciesService(model as never, evaluator as never);

    await expect(service.list()).resolves.toEqual([
      { _id: 'policy-id', name: 'Policy', latestEvaluation: undefined },
    ]);
  });

  it('rejects a policy with the same delivery contract', async () => {
    const model = {
      findOne: () => ({
        select: () => ({
          lean: () => ({ exec: jest.fn().mockResolvedValue({ _id: 'old' }) }),
        }),
      }),
      create: jest.fn(),
    };
    const service = new PoliciesService(model as never, {} as never);

    await expect(
      service.create({
        name: 'Duplicate',
        namespace: 'local',
        sourceService: 'financing-api',
        destinationService: 'orders-consumer',
        destination: 'application-events',
        subscription: 'logging-service',
        thresholdSeconds: 1,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(model.create).not.toHaveBeenCalled();
  });
});
