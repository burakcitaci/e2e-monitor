import { evaluatePolicy, EvaluationPolicy } from './policy-evaluator';
import { CaptureState } from '../capture/capture-state';

const policy: EvaluationPolicy = {
  namespace: 'local',
  destination: 'application-events',
  subscription: 'logging-service',
  sourceService: 'financing-api',
  destinationService: 'orders-consumer',
  thresholdSeconds: 1,
  requiredSuccessPercentage: 95,
  evaluationWindowMinutes: 30,
  minimumSampleCount: 1,
  effectiveFrom: new Date('2026-01-01T00:00:00Z'),
  enabled: true,
};

const capture = (
  id: string,
  sentAt: string,
  receivedAt?: string,
): { id: string; state: CaptureState } => ({
  id,
  state: {
    captureId: id,
    messageId: `message-${id}`,
    namespace: 'local',
    destination: 'application-events',
    sent: { service: 'financing-api', occurredAt: sentAt, body: 'body' },
    deliveries: receivedAt
      ? [
          {
            service: 'orders-consumer',
            subscription: 'logging-service',
            receivedAt,
          },
        ]
      : [],
  },
});

describe('policy evaluator', () => {
  const now = new Date('2026-10-23T10:00:10Z');

  it('classifies received, late, missing, and pending messages', () => {
    const result = evaluatePolicy(
      policy,
      [
        capture('passed', '2026-10-23T10:00:05Z', '2026-10-23T10:00:05.500Z'),
        capture('late', '2026-10-23T10:00:05Z', '2026-10-23T10:00:06.500Z'),
        capture('missing', '2026-10-23T10:00:05Z'),
        capture('pending', '2026-10-23T10:00:09.500Z'),
      ],
      now,
    );

    expect(result.counts).toEqual({
      total: 4,
      eligible: 3,
      pending: 1,
      passed: 1,
      late: 1,
      missing: 1,
    });
    expect(result.successPercentage).toBeCloseTo(33.33, 1);
    expect(result.status).toBe('fail');
  });

  it('ignores messages that do not match the policy route', () => {
    const other = capture('other', '2026-10-23T10:00:05Z');
    other.state.destination = 'another-topic';
    expect(evaluatePolicy(policy, [other], now).status).toBe('no_data');
  });

  it('requires the configured minimum sample count', () => {
    const result = evaluatePolicy(
      { ...policy, minimumSampleCount: 2 },
      [capture('passed', '2026-10-23T10:00:05Z', '2026-10-23T10:00:05.500Z')],
      now,
    );
    expect(result.status).toBe('insufficient_data');
  });
});
