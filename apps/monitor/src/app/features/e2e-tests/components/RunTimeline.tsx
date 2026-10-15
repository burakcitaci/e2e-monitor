import type { TestRun } from '@e2e-monitor/entities';
import { runStatusLabels } from '../lib/run-status';

interface RunTimelineProps {
  run?: TestRun;
  isLoading: boolean;
  hasSelection: boolean;
}

export function RunTimeline({
  run,
  isLoading,
  hasSelection,
}: RunTimelineProps) {
  return (
    <section
      className="rounded-lg border p-4 space-y-3 min-w-0"
      aria-labelledby="timeline-title"
    >
      <h2 id="timeline-title" className="font-semibold text-lg">
        Run timeline
      </h2>
      {!hasSelection && <p>Select a run to inspect its evidence.</p>}
      {isLoading && hasSelection && <p role="status">Loading timeline…</p>}
      {run && (
        <>
          <p role="status">
            <strong>{runStatusLabels[run.status]}</strong> · Simulated run
          </p>
          <p>{run.reason}</p>
          <dl className="text-sm space-y-1">
            <dt className="font-medium">Correlation ID</dt>
            <dd className="font-mono break-all">{run.correlationId}</dd>
            <dt className="font-medium">Deadline</dt>
            <dd>{new Date(run.deadlineAt).toLocaleString()}</dd>
            <dt className="font-medium">Policy snapshot</dt>
            <dd>
              {run.policy.publisher} → {run.policy.consumer}:{' '}
              {run.policy.messageType}, {run.policy.destination}, within{' '}
              {run.policy.timeoutSeconds}s
            </dd>
          </dl>
          {run.evidence.length === 0 && (
            <p>Waiting for simulated publisher evidence…</p>
          )}
          <ol className="space-y-3" aria-label="Evidence timeline">
            {run.evidence.map((event) => (
              <li key={event.eventId} className="border-l-2 pl-3">
                <p className="font-medium">
                  {event.service} · {event.kind}
                </p>
                <p className="text-sm">{event.detail}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(event.receivedAt).toLocaleTimeString()}
                </p>
                <p className="text-xs font-mono break-all">
                  Message: {event.messageId}
                </p>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
