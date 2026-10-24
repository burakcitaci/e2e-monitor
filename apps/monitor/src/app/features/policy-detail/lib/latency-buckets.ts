import type { PolicyEvaluation } from '../../../lib/schemas';

export function latencyBuckets(
  messages: PolicyEvaluation['messages'],
  from: number,
  to: number,
) {
  const duration = to - from;
  const seconds =
    duration < 86_400_000
      ? ([10, 15, 30, 60, 120, 300, 600, 900].find(
          (interval) => duration / (interval * 1000) <= 120,
        ) ?? 900)
      : duration <= 86_400_000
        ? 900
        : duration <= 604_800_000
          ? 3600
          : 21600;
  const minutes = seconds / 60;
  const width = seconds * 1000;
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
    label:
      seconds < 60
        ? `${seconds} seconds`
        : seconds < 3600
          ? `${minutes} minute${minutes === 1 ? '' : 's'}`
          : `${seconds / 3600} hour${seconds === 3600 ? '' : 's'}`,
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
