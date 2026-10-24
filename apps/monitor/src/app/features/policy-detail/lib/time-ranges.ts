export const policyTimeRanges = [
  [15, 'Last 15 minutes'],
  [30, 'Last 30 minutes'],
  [60, 'Last 1 hour'],
  [240, 'Last 4 hours'],
  [1440, 'Last 1 day'],
  [10080, 'Last 1 week'],
] as const;

export function policyTimeRangeLabel(minutes: number) {
  return policyTimeRanges.find(([value]) => value === minutes)?.[1] ?? '';
}
