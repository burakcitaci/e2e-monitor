import type { PolicyEvaluation } from '../../../lib/schemas';

export function latencyBuckets(
  messages: PolicyEvaluation['messages'],
  from: number,
  to: number,
) {
  const duration = to - from;
  const minutes =
    duration <= 86_400_000 ? 15 : duration <= 604_800_000 ? 60 : 360;
  const width = minutes * 60_000;
  const buckets = Array.from(
    { length: Math.ceil(duration / width) },
    (_, index) => ({
      timestamp: from + index * width,
      end: Math.min(to, from + (index + 1) * width),
      total: 0,
      values: [] as number[],
    }),
  );
  for (const message of messages) {
    const timestamp = Date.parse(message.sentAt);
    if (timestamp < from || timestamp > to || !Number.isFinite(timestamp))
      continue;
    const index = Math.min(
      buckets.length - 1,
      Math.floor((timestamp - from) / width),
    );
    const bucket = buckets[index];
    if (!bucket) continue;
    bucket.total++;
    if (message.latencySeconds !== null)
      bucket.values.push(message.latencySeconds);
  }
  return {
    minutes,
    points: buckets.map(({ values, ...bucket }) => {
      values.sort((a, b) => a - b);
      return {
        ...bucket,
        received: values.length,
        latency: values.length
          ? values[Math.ceil(values.length * 0.95) - 1]
          : null,
        maximum: values.length ? values[values.length - 1] : null,
      };
    }),
  };
}
