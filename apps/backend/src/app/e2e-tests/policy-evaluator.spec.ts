import { describe, expect, it } from '@jest/globals';
import type { ScenarioPolicy, TestEvidence } from '@e2e-monitor/entities';
import { evaluatePolicy } from './policy-evaluator';

const policy: ScenarioPolicy = {
  publisher: 'finance-api',
  consumer: 'payment-worker',
  messageType: 'PaymentRequested',
  provider: 'sqs',
  destination: 'payments',
  timeoutSeconds: 30,
};
const now = '2026-10-15T10:00:01.000Z';
const deadline = '2026-10-15T10:00:30.000Z';
const published: TestEvidence = {
  eventId: 'a',
  correlationId: 'run-correlation',
  messageId: 'payment-1',
  messageType: policy.messageType,
  provider: 'sqs',
  destination: 'payments',
  service: policy.publisher,
  kind: 'published',
  receivedAt: now,
};
const processed: TestEvidence = {
  ...published,
  eventId: 'b',
  service: policy.consumer,
  kind: 'processed',
};
const evaluate = (events: TestEvidence[], at = now) =>
  evaluatePolicy(policy, events, 'run-correlation', at, deadline);

describe('Publish-to-process policy', () => {
  it('requires evidence from both applications', () => {
    expect(evaluate([]).status).toBe('running');
    expect(evaluate([published]).status).toBe('running');
    expect(evaluate([processed]).status).toBe('running');
    expect(evaluate([published, processed]).status).toBe('passed');
  });
  it('allows evidence delivery in reverse arrival order', () => {
    expect(evaluate([processed, published]).status).toBe('passed');
  });
  it.each([
    { correlationId: 'other-run' },
    { messageId: 'other-message' },
    { messageType: 'OtherEvent' },
    { service: 'other-backend' },
    { destination: 'other-queue' },
    { provider: 'azure-service-bus' as const },
  ])('does not combine unrelated consumer evidence: %j', (change) => {
    expect(evaluate([published, { ...processed, ...change }]).status).toBe(
      'running',
    );
  });
  it('does not treat duplicate publish events as processing success', () => {
    expect(evaluate([published, published]).status).toBe('running');
  });
  it('fails on relevant consumer failure and ignores unrelated failure', () => {
    expect(evaluate([{ ...processed, kind: 'failed' }]).status).toBe('failed');
    expect(
      evaluate([{ ...processed, kind: 'failed', correlationId: 'other-run' }])
        .status,
    ).toBe('running');
  });
  it('times out at the exact deadline and never passes late evidence', () => {
    expect(evaluate([], deadline).status).toBe('timed_out');
    expect(evaluate([published, processed], deadline).status).toBe('timed_out');
  });
});
