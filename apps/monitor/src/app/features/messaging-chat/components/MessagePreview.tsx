import type { MessageDraft } from '@e2e-monitor/entities';
import { Button } from '../../../components/ui/button';

export function MessagePreview({
  draft,
  pending,
  sending,
  onSend,
  onDismiss,
}: {
  draft: MessageDraft;
  pending: boolean;
  sending: boolean;
  onSend: () => void;
  onDismiss: () => void;
}) {
  return (
    <section
      aria-labelledby="message-review-title"
      className="rounded-lg border p-4 space-y-3"
    >
      <h2 id="message-review-title" className="font-semibold">
        Review message
      </h2>
      <p>
        {draft.provider === 'azure' ? 'Azure Service Bus' : 'AWS SQS'} ·{' '}
        {draft.destinationType} · <strong>{draft.destination}</strong>
      </p>
      <pre className="overflow-auto whitespace-pre-wrap break-words rounded bg-muted p-3 text-sm">
        {draft.body}
      </pre>
      <p className="text-sm text-muted-foreground">
        Nothing has been sent yet. Ask for changes, or send this message.
      </p>
      <div className="flex gap-2">
        <Button disabled={pending} onClick={onSend}>
          {sending ? 'Sending…' : 'Send message'}
        </Button>
        <Button variant="outline" disabled={pending} onClick={onDismiss}>
          Discard draft
        </Button>
      </div>
    </section>
  );
}
