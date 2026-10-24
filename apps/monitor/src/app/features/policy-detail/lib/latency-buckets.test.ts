import { describe, expect, it } from 'vitest';
import type { PolicyEvaluation } from '../../../lib/schemas';
import { latencyBuckets } from './latency-buckets';

describe('latencyBuckets', () => {
  const from = Date.parse('2026-10-24T00:00:00Z');
  it('preserves empty buckets and computes nearest-rank p95 without hiding missing messages', () => {
    const messages = Array.from({ length: 21 }, (_, index) => ({
      sentAt: new Date(from + 1000).toISOString(),
      latencySeconds: index === 20 ? null : index + 1,
    })) as PolicyEvaluation['messages'];
    const result = latencyBuckets(messages, from, from + 86_400_000);
    expect(result.minutes).toBe(15);
    expect(result.points).toHaveLength(96);
    expect(result.points[0]).toMatchObject({
      total: 21,
      received: 20,
      latency: 19,
      maximum: 20,
    });
    expect(result.points[1]).toMatchObject({
      total: 0,
      received: 0,
      latency: null,
    });
  });
  it('bounds long ranges and includes messages at the end boundary', () => {
    for (const [days, minutes, count] of [
      [7, 60, 168],
      [30, 360, 120],
    ]) {
      const to = from + days * 86_400_000;
      const result = latencyBuckets(
        [
          { sentAt: new Date(to).toISOString(), latencySeconds: 1 },
        ] as PolicyEvaluation['messages'],
        from,
        to,
      );
      expect(result.minutes).toBe(minutes);
      expect(result.points).toHaveLength(count);
      expect(result.points.at(-1)?.received).toBe(1);
    }
  });
});
