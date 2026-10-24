import { EvaluatorService } from './evaluator.service';

describe('historical policy analysis', () => {
  it('uses the requested range independently of the live window and creation time without persisting an evaluation', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-24T12:00:00Z'));
    try {
      const capture = {
        statesInRange: jest.fn().mockResolvedValue([
          {
            id: 'old-message',
            state: {
              namespace: 'local',
              destination: 'events',
              messageId: 'message',
              sent: { service: 'sender', occurredAt: '2026-10-24T10:00:00Z' },
              deliveries: [
                {
                  subscription: 'sub',
                  service: 'receiver',
                  receivedAt: '2026-10-24T10:00:00.500Z',
                },
              ],
            },
          },
        ]),
      };
      const evaluations = { create: jest.fn() };
      const service = new EvaluatorService(
        {} as never,
        evaluations as never,
        capture as never,
      );
      const result = await service.analyzeRange(
        {
          _id: 'policy',
          name: 'Policy',
          namespace: 'local',
          destination: 'events',
          sourceService: 'sender',
          destinationService: 'receiver',
          subscription: 'sub',
          thresholdSeconds: 1,
          requiredSuccessPercentage: 95,
          minimumSampleCount: 1,
          evaluationWindowMinutes: 30,
          effectiveFrom: new Date('2026-10-24T11:00:00Z'),
          enabled: true,
        },
        240,
      );
      expect(result.from).toBe('2026-10-24T08:00:00.000Z');
      expect(result.counts.passed).toBe(1);
      expect(evaluations.create).not.toHaveBeenCalled();
      expect(capture.statesInRange).toHaveBeenCalledWith(
        'local',
        'events',
        new Date(result.from),
        new Date(result.to),
      );
    } finally {
      jest.useRealTimers();
    }
  });
});
