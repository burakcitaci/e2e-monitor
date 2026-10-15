import type { RunStatus } from '@e2e-monitor/entities';

export const runStatusLabels: Record<RunStatus, string> = {
  running: 'Running',
  passed: 'Passed',
  failed: 'Failed',
  timed_out: 'Timed out',
};
