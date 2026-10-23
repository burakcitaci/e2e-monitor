import { useState } from 'react';
import type { PolicyDraft } from '@e2e-monitor/entities';
import { Button } from '../../../components/ui/button';
import { apiClient } from '../../../lib/api-client';

export function PolicyPreview({
  draft,
  pending,
  onDismiss,
}: {
  draft: PolicyDraft;
  pending: boolean;
  onDismiss: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(false);
  const [error, setError] = useState<string>();
  const create = async () => {
    setSaving(true);
    setError(undefined);
    try {
      await apiClient.createPolicy({ ...draft, enabled: true });
      setCreated(true);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Policy could not be created.',
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <section
      aria-labelledby="policy-review-title"
      className="rounded-lg border p-4 space-y-3"
    >
      <h2 id="policy-review-title" className="font-semibold">
        Review policy
      </h2>
      <p className="text-sm">
        <strong>{draft.name}</strong>
      </p>
      <p className="text-sm">
        When <strong>{draft.sourceService}</strong> sends to{' '}
        <strong>{draft.destination}</strong>,{' '}
        <strong>{draft.destinationService}</strong> on subscription{' '}
        <strong>{draft.subscription}</strong> must receive it within{' '}
        <strong>{draft.thresholdSeconds}s</strong>.
      </p>
      <p className="text-sm text-muted-foreground">
        Pass when {draft.requiredSuccessPercentage}% succeed in the last{' '}
        {draft.evaluationWindowMinutes} minutes, with at least{' '}
        {draft.minimumSampleCount} eligible message
        {draft.minimumSampleCount === 1 ? '' : 's'}. Namespace:{' '}
        {draft.namespace}.
      </p>
      {created ? (
        <p role="status" className="text-sm text-green-600">
          Policy created.
        </p>
      ) : (
        <div className="flex gap-2">
          <Button disabled={pending || saving} onClick={() => void create()}>
            {saving ? 'Creating…' : 'Create policy'}
          </Button>
          <Button
            variant="outline"
            disabled={pending || saving}
            onClick={onDismiss}
          >
            Discard draft
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
