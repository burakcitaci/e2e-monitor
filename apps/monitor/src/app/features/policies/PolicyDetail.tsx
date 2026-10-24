import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Clock3 } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { apiClient } from '../../lib/api-client';
import { PolicyEvidence } from './PolicyEvidence';
import { PolicyLatencyChart } from './PolicyLatencyChart';
import { DetailPage, DetailStat } from '../../components/common/DetailPage';

const statusLabel = {
  pass: 'Passing',
  fail: 'Failing',
  no_data: 'No data',
  insufficient_data: 'Insufficient data',
  disabled: 'Disabled',
};

const ranges = [
  [15, 'Last 15 minutes'],
  [30, 'Last 30 minutes'],
  [60, 'Last 1 hour'],
  [240, 'Last 4 hours'],
  [1440, 'Last 1 day'],
  [10080, 'Last 1 week'],
] as const;

export default function PolicyDetail() {
  const { id = '' } = useParams();
  const [minutes, setMinutes] = React.useState(30);
  const {
    data: detail,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['policies', id, 'analysis', minutes],
    queryFn: () => apiClient.getPolicy(id, minutes),
    enabled: Boolean(id),
    refetchInterval: 30_000,
  });

  if (!detail) {
    return (
      <DetailPage>
        <Link
          to="/policies"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to policies
        </Link>
        <p role={error ? 'alert' : 'status'}>
          {error?.message ?? 'Loading policy monitor…'}
        </p>
        {error && (
          <Button variant="outline" onClick={() => void refetch()}>
            Retry
          </Button>
        )}
      </DetailPage>
    );
  }

  const { policy, latestEvaluation, analysis } = detail;
  const stats = analysis
    ? [
        [
          'Success rate',
          analysis.successPercentage === null
            ? '—'
            : `${analysis.successPercentage.toFixed(1)}%`,
        ],
        [
          'p95 latency',
          analysis.p95Seconds === null
            ? '—'
            : `${analysis.p95Seconds.toFixed(3)}s`,
        ],
        ['Evaluated messages', String(analysis.counts.eligible)],
        [
          'Selected range',
          ranges.find(([value]) => value === minutes)?.[1] ?? '',
        ],
      ]
    : [];
  return (
    <DetailPage>
      <Link
        to="/policies"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to policies
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">{policy.name}</h1>
            {latestEvaluation && (
              <Badge
                variant={
                  latestEvaluation.status === 'pass'
                    ? 'default'
                    : latestEvaluation.status === 'fail'
                      ? 'destructive'
                      : 'outline'
                }
              >
                {statusLabel[latestEvaluation.status]}
              </Badge>
            )}
          </div>
          <p className="break-all text-sm text-muted-foreground">
            {policy.sourceService} → {policy.destinationService} ·{' '}
            {policy.destination}/subscriptions/{policy.subscription}
          </p>
        </div>
        {latestEvaluation && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock3 className="size-4" /> Automatically evaluated every 30
            seconds
          </p>
        )}
      </header>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          Refresh failed: {error.message}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-5">
        <div className="space-y-1">
          <h2>Historical analysis</h2>
          <p className="text-xs text-muted-foreground">
            Current policy rules applied to messages sent in the selected range.
            Live monitor status uses its configured{' '}
            {policy.evaluationWindowMinutes}-minute window.
          </p>
          {analysis && (
            <p className="text-xs text-muted-foreground">
              {new Date(analysis.from).toLocaleString()} –{' '}
              {new Date(analysis.to).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="policy-time-range" className="sr-only">
            Time range
          </label>
          <select
            id="policy-time-range"
            value={minutes}
            onChange={(event) => setMinutes(Number(event.target.value))}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          >
            {ranges.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            {isFetching ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
      </div>
      {analysis ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map(([label, value]) => (
              <DetailStat key={label} label={label} value={value} />
            ))}
          </div>
          <section className="rounded-xl border bg-card p-5 space-y-4">
            <div>
              <h2 className="font-semibold">Delivery latency</h2>
              <p className="text-sm text-muted-foreground">
                Each point is a captured message at its sent time. The dashed
                line is the {policy.thresholdSeconds}s policy threshold.
              </p>
            </div>
            <PolicyLatencyChart
              evaluation={analysis}
              from={analysis.from}
              to={analysis.to}
            />
          </section>
          <PolicyEvidence policy={policy} evaluation={analysis} />
        </>
      ) : (
        <section className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          The automatic evaluator has not produced a snapshot yet. This page
          refreshes every 30 seconds.
        </section>
      )}
    </DetailPage>
  );
}
