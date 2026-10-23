import { PoliciesController } from './policies.controller';
import { PoliciesService } from './policies.service';

describe('PoliciesController', () => {
  it('awaits creation and returns a serializable policy object', async () => {
    const policy = {
      _id: 'policy-id',
      name: 'Financing delivery',
      namespace: 'local.servicebus',
      sourceService: 'financing-api',
      destinationService: 'orders-consumer',
      destination: 'application-events',
      subscription: 'logging-service',
      thresholdSeconds: 1,
      requiredSuccessPercentage: 95,
      evaluationWindowMinutes: 30,
      minimumSampleCount: 1,
      enabled: true,
      effectiveFrom: new Date('2026-10-23T18:00:00Z'),
    };
    const service = { create: jest.fn().mockResolvedValue(policy) };
    const controller = new PoliciesController(
      service as unknown as PoliciesService,
    );

    await expect(controller.create(policy)).resolves.toEqual({
      success: true,
      data: policy,
    });
  });
});
