import { describe, expect, it } from 'vitest';
import { analyzeMessage, durationMs } from './analysis';

describe('Message timing analysis', () => {
  const sentAt = new Date('2026-10-22T19:00:00Z');
  it('calculates subscriber timings and averages from reported timestamps', () => {
    const result = analyzeMessage({
      body: '€',
      sentAt,
      deliveries: [
        {
          subscription: 'one',
          service: 'B',
          receivedAt: new Date(+sentAt + 100),
          completedAt: new Date(+sentAt + 150),
        },
        {
          subscription: 'two',
          service: 'C',
          receivedAt: new Date(+sentAt + 300),
        },
      ],
    });
    expect(result.completed).toBe(1);
    expect(result.delivery).toEqual({ value: 200, samples: 2 });
    expect(result.processing).toEqual({ value: 50, samples: 1 });
    expect(result.timings[0].totalMs).toBe(150);
    expect(result.payloadBytes).toBe(3);
  });
  it('excludes negative and missing durations without inventing zeroes', () => {
    const result = analyzeMessage({
      sentAt,
      deliveries: [
        {
          subscription: 'one',
          service: 'B',
          receivedAt: new Date(+sentAt - 100),
        },
        {
          subscription: 'two',
          service: 'C',
          completedAt: new Date(+sentAt + 100),
        },
      ],
    });
    expect(result.delivery).toEqual({ value: null, samples: 0 });
    expect(result.processing).toEqual({ value: null, samples: 0 });
    expect(result.timings[0].clockIssue).toBe(true);
    expect(result.timings[1].receivedAt).toBeUndefined();
    expect(result.payloadBytes).toBeNull();
    expect(durationMs(sentAt, sentAt)).toBe(0);
  });
  it('does not infer completed-at timestamps from legacy dispositions', () => {
    const result = analyzeMessage({
      sentAt,
      receivedAt: new Date(+sentAt + 200),
      receivedBy: 'legacy',
      disposition: 'complete',
    });
    expect(result.delivery.value).toBe(200);
    expect(result.processing.value).toBeNull();
    expect(result.completed).toBe(1);
  });
  it('shows unavailable payload size while a sender report is missing', () => {
    expect(
      analyzeMessage({
        trackingSource: 'capture',
        body: '(waiting for publisher report)',
      }).payloadBytes,
    ).toBeNull();
  });
});
