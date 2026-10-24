import type { TrackingMessage } from '../../../lib/schemas';

export function durationMs(
  start: Date | undefined | null,
  end: Date | undefined | null,
): number | null {
  if (!start || !end) return null;
  const duration = end.getTime() - start.getTime();
  return Number.isFinite(duration) && duration >= 0 ? duration : null;
}

export function formatDuration(value: number | null): string {
  if (value === null) return 'Not available';
  return value >= 1000
    ? `${(value / 1000).toFixed(2)} s`
    : `${Math.round(value)} ms`;
}

export function analyzeMessage(message: TrackingMessage) {
  const deliveries =
    message.deliveries ??
    (message.receivedBy
      ? [
          {
            service: message.receivedBy,
            subscription: message.queue ?? 'Broker delivery',
            receivedAt: message.receivedAt ?? undefined,
            completedAt: message.completedAt,
          },
        ]
      : []);
  const timings = deliveries.map((delivery) => ({
    ...delivery,
    completionReported: Boolean(
      delivery.completedAt ||
      (!message.deliveries && message.disposition === 'complete'),
    ),
    deliveryMs: durationMs(message.sentAt, delivery.receivedAt),
    processingMs: durationMs(delivery.receivedAt, delivery.completedAt),
    totalMs: durationMs(message.sentAt, delivery.completedAt),
    clockIssue: Boolean(
      (message.sentAt &&
        delivery.receivedAt &&
        delivery.receivedAt < message.sentAt) ||
      (delivery.receivedAt &&
        delivery.completedAt &&
        delivery.completedAt < delivery.receivedAt) ||
      (message.sentAt &&
        delivery.completedAt &&
        delivery.completedAt < message.sentAt),
    ),
  }));
  const average = (values: (number | null)[]) => {
    const known = values.filter((value): value is number => value !== null);
    return {
      value: known.length
        ? known.reduce((a, b) => a + b, 0) / known.length
        : null,
      samples: known.length,
    };
  };
  return {
    timings,
    completed: timings.filter((delivery) => delivery.completionReported).length,
    delivery: average(timings.map((delivery) => delivery.deliveryMs)),
    processing: average(timings.map((delivery) => delivery.processingMs)),
    payloadBytes:
      message.body === undefined ||
      (!message.sentAt && message.trackingSource === 'capture')
        ? null
        : new TextEncoder().encode(message.body).length,
  };
}
