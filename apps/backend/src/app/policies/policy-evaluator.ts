import { CaptureState } from '../capture/capture-state';

export type PolicyOutcome = 'pending' | 'passed' | 'late' | 'missing';

export interface EvaluationPolicy {
  provider?: 'azure' | 'aws';
  namespace?: string;
  destination: string;
  subscription: string;
  sourceService: string;
  destinationService: string;
  thresholdSeconds: number;
  requiredSuccessPercentage: number;
  evaluationWindowMinutes: number;
  minimumSampleCount: number;
  effectiveFrom: Date;
  enabled: boolean;
}

export function evaluatePolicy(
  policy: EvaluationPolicy,
  captures: { id: string; state: CaptureState }[],
  now = new Date(),
) {
  const windowStart = Math.max(
    now.getTime() - policy.evaluationWindowMinutes * 60_000,
    new Date(policy.effectiveFrom).getTime(),
  );
  const messages = captures.flatMap(({ id, state }) => {
    if (
      !state.sent ||
      (policy.provider && (state.provider ?? 'azure') !== policy.provider) ||
      (policy.namespace && state.namespace !== policy.namespace) ||
      state.destination !== policy.destination ||
      state.sent.service !== policy.sourceService ||
      !Number.isFinite(Date.parse(state.sent.occurredAt)) ||
      Date.parse(state.sent.occurredAt) < windowStart ||
      Date.parse(state.sent.occurredAt) > now.getTime()
    ) {
      return [];
    }
    const sentAt = Date.parse(state.sent.occurredAt);
    const deadline = sentAt + policy.thresholdSeconds * 1000;
    const delivery = state.deliveries.find(
      (item) =>
        item.subscription === policy.subscription &&
        item.service === policy.destinationService,
    );
    const receivedAt = delivery?.receivedAt
      ? Date.parse(delivery.receivedAt)
      : undefined;
    const latencySeconds = receivedAt ? (receivedAt - sentAt) / 1000 : null;
    let outcome: PolicyOutcome;
    if (receivedAt !== undefined) {
      outcome = receivedAt <= deadline ? 'passed' : 'late';
    } else {
      outcome = now.getTime() <= deadline ? 'pending' : 'missing';
    }
    return [
      {
        messageId: state.messageId,
        detailId: id,
        sentAt: state.sent.occurredAt,
        receivedAt: delivery?.receivedAt,
        latencySeconds,
        outcome,
      },
    ];
  });
  const eligible = messages.filter((message) => message.outcome !== 'pending');
  const passed = eligible.filter(
    (message) => message.outcome === 'passed',
  ).length;
  const late = eligible.filter((message) => message.outcome === 'late').length;
  const missing = eligible.filter(
    (message) => message.outcome === 'missing',
  ).length;
  const receivedLatencies = eligible
    .map((message) => message.latencySeconds)
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);
  const p95Index = receivedLatencies.length
    ? Math.ceil(receivedLatencies.length * 0.95) - 1
    : -1;
  const successPercentage = eligible.length
    ? (passed / eligible.length) * 100
    : null;
  const status = !policy.enabled
    ? 'disabled'
    : eligible.length === 0
      ? 'no_data'
      : eligible.length < policy.minimumSampleCount
        ? 'insufficient_data'
        : (successPercentage ?? 0) >= policy.requiredSuccessPercentage
          ? 'pass'
          : 'fail';
  return {
    status,
    counts: {
      total: messages.length,
      eligible: eligible.length,
      pending: messages.length - eligible.length,
      passed,
      late,
      missing,
    },
    successPercentage,
    p95Seconds: p95Index >= 0 ? receivedLatencies[p95Index] : null,
    messages,
  };
}
