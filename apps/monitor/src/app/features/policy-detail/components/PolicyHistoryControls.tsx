import { PageSection } from '../../../components/common/Page';
import { Button } from '../../../components/ui/button';
import type { PolicyDetail } from '../../../lib/schemas';
import { policyTimeRanges } from '../lib/time-ranges';

export function PolicyHistoryControls({
  minutes,
  onMinutesChange,
  pending,
  onRefresh,
  windowMinutes,
  analysis,
}: {
  minutes: number;
  onMinutesChange: (minutes: number) => void;
  pending: boolean;
  onRefresh: () => void;
  windowMinutes: number;
  analysis: PolicyDetail['analysis'];
}) {
  return (
    <PageSection
      title="Historical analysis"
      description={
        <>
          Current policy rules applied to messages sent in the selected range.
          Live monitor status uses its configured {windowMinutes}-minute window.
        </>
      }
      actions={
        <div className="flex items-center gap-2">
          <label htmlFor="policy-time-range" className="sr-only">
            Time range
          </label>
          <select
            id="policy-time-range"
            value={minutes}
            onChange={(event) => onMinutesChange(Number(event.target.value))}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          >
            {policyTimeRanges.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <Button variant="outline" disabled={pending} onClick={onRefresh}>
            {pending ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
      }
    >
      {analysis && (
        <p className="text-xs text-muted-foreground">
          {new Date(analysis.from).toLocaleString()} –{' '}
          {new Date(analysis.to).toLocaleString()}
        </p>
      )}
    </PageSection>
  );
}
