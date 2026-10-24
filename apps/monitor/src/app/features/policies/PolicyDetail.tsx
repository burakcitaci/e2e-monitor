import React from 'react';
import { ArrowLeft, Clock3 } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { apiClient } from '../../lib/api-client';
import type { PolicyDetail as PolicyDetailModel } from '../../lib/schemas';
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

export default function PolicyDetail() {
  const { id = '' } = useParams();
  const [detail, setDetail] = React.useState<PolicyDetailModel>();
  const [error, setError] = React.useState<string>();
  const load = React.useCallback(async () => {
    try {
      setDetail(await apiClient.getPolicy(id));
      setError(undefined);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Could not load policy',
      );
    }
  }, [id]);
  React.useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 30_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [load]);

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
          {error ?? 'Loading policy monitor…'}
        </p>
        {error && (
          <Button variant="outline" onClick={() => void load()}>
            Retry
          </Button>
        )}
      </DetailPage>
    );
  }

  const { policy, latestEvaluation } = detail;
  const stats = latestEvaluation
    ? [
        [
          'Success rate',
          latestEvaluation.successPercentage === null
            ? '—'
            : `${latestEvaluation.successPercentage.toFixed(1)}%`,
        ],
        [
          'p95 latency',
          latestEvaluation.p95Seconds === null
            ? '—'
            : `${latestEvaluation.p95Seconds.toFixed(3)}s`,
        ],
        ['Evaluated messages', String(latestEvaluation.counts.eligible)],
        ['Evaluation window', `${policy.evaluationWindowMinutes} min`],
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
          Refresh failed: {error}
        </p>
      )}
      {latestEvaluation ? (
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
            <PolicyLatencyChart evaluation={latestEvaluation} />
          </section>
          <PolicyEvidence policy={policy} evaluation={latestEvaluation} />
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
