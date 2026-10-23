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
    const service = new PoliciesService(model as never, {} as never);

    await expect(service.list()).resolves.toEqual([
      { _id: 'policy-id', name: 'Policy' },
    ]);
  });
});
