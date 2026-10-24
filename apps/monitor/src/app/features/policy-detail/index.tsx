import React from 'react';
import { Clock3 } from 'lucide-react';
import { useParams } from 'react-router';
import { PolicyEvidence } from './components/PolicyEvidence';
import { PolicyLatencyChart } from './components/PolicyLatencyChart';
import { DetailPage, DetailStat } from '../../components/common/DetailPage';
import {
  BackLink,
  PageHeader,
  PageSection,
  PageState,
} from '../../components/common/Page';
import { usePolicyDetail } from '../policies/api/hooks';
import { PolicyStatusBadge } from '../policies/components/PolicyStatusBadge';
import { PolicyHistoryControls } from './components/PolicyHistoryControls';
import { policyTimeRangeLabel } from './lib/time-ranges';

export default function PolicyDetail() {
  const { id = '' } = useParams();
  const [minutes, setMinutes] = React.useState(30);
  const {
    data: detail,
    error,
    refetch,
    isFetching,
  } = usePolicyDetail(id, minutes);

  if (!detail) {
    return (
      <DetailPage>
        <BackLink to="/policies">Back to policies</BackLink>
        <PageState
          title={error ? 'Could not load policy' : 'Loading policy monitor…'}
          description={error?.message}
          retry={error ? () => void refetch() : undefined}
        />
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
        ['Selected range', policyTimeRangeLabel(minutes)],
      ]
    : [];
  return (
    <DetailPage>
      <BackLink to="/policies">Back to policies</BackLink>
      <PageHeader
        title={policy.name}
        description={
          <>
            {policy.sourceService} → {policy.destinationService} ·{' '}
            {policy.destination}/subscriptions/{policy.subscription}
          </>
        }
        badge={
          latestEvaluation && (
            <PolicyStatusBadge status={latestEvaluation.status} detail />
          )
        }
        actions={
          latestEvaluation && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock3 className="size-4" /> Automatically evaluated every 30
              seconds
            </p>
          )
        }
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          Refresh failed: {error.message}
        </p>
      )}
      <PolicyHistoryControls
        minutes={minutes}
        onMinutesChange={setMinutes}
        pending={isFetching}
        onRefresh={() => void refetch()}
        windowMinutes={policy.evaluationWindowMinutes}
        analysis={analysis}
      />
      {analysis ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map(([label, value]) => (
              <DetailStat key={label} label={label} value={value} />
            ))}
          </div>
          <PageSection
            title="Delivery latency"
            description={
              <>
                Each point is a captured message at its sent time. The dashed
                line is the {policy.thresholdSeconds}s policy threshold.
              </>
            }
          >
            <PolicyLatencyChart
              evaluation={analysis}
              from={analysis.from}
              to={analysis.to}
            />
          </PageSection>
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
