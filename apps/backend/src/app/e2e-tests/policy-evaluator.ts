import type {
  ScenarioPolicy,
  TestEvidence,
  RunStatus,
} from '@e2e-monitor/entities';

export function evaluatePolicy(
  policy: ScenarioPolicy,
  evidence: TestEvidence[],
  correlationId: string,
  now: string,
  deadlineAt: string,
): { status: RunStatus; reason: string } {
  if (now >= deadlineAt)
    return {
      status: 'timed_out',
      reason:
        'The deadline expired before matching publish and processing evidence arrived.',
    };
  const matching = evidence.filter(
    (event) =>
      event.correlationId === correlationId &&
      event.provider === policy.provider &&
      event.destination === policy.destination &&
      event.messageType === policy.messageType,
  );
  if (
    matching.some(
      (event) => event.kind === 'failed' && event.service === policy.consumer,
    )
  ) {
    return {
      status: 'failed',
      reason: `${policy.consumer} reported processing failure.`,
    };
  }
  const published = new Set(
    matching
      .filter(
        (event) =>
          event.kind === 'published' && event.service === policy.publisher,
      )
      .map((event) => event.messageId),
  );
  if (
    matching.some(
      (event) =>
        event.kind === 'processed' &&
        event.service === policy.consumer &&
        published.has(event.messageId),
    )
  ) {
    return {
      status: 'passed',
      reason:
        'The publisher and consumer reported success for the same message before the deadline.',
    };
  }
  return {
    status: 'running',
    reason: 'Waiting for matching publish and successful processing evidence.',
  };
}
