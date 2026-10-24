import { CheckCircle2, Inbox, Send } from 'lucide-react';
import { PageSection } from '../../../components/common/Page';
import type { TrackingMessage } from '../../../lib/schemas';
import { analyzeMessage } from '../lib/analysis';
import { messageTimestamp } from '../lib/presentation';

export function MessageTimeline({
  message,
  analysis,
}: {
  message: TrackingMessage;
  analysis: ReturnType<typeof analyzeMessage>;
}) {
  const timeline = [
    ...(message.sentAt
      ? [
          {
            title: 'Published',
            service: message.sentBy ?? 'Publisher',
            at: message.sentAt,
            icon: Send,
          },
        ]
      : []),
    ...analysis.timings.flatMap((delivery) => [
      ...(delivery.receivedAt
        ? [
            {
              title: 'Received',
              service: `${delivery.service} · ${delivery.subscription}`,
              at: delivery.receivedAt,
              icon: Inbox,
            },
          ]
        : []),
      ...(delivery.completedAt
        ? [
            {
              title: 'Completed',
              service: `${delivery.service} · ${delivery.subscription}`,
              at: delivery.completedAt,
              icon: CheckCircle2,
            },
          ]
        : []),
    ]),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
  return (
    <PageSection title="Reported timeline">
      {!timeline.length ? (
        <p className="text-sm text-muted-foreground">No timestamps reported.</p>
      ) : (
        <ol className="space-y-5">
          {timeline.map((event, index) => (
            <li key={index} className="flex flex-wrap items-start gap-3">
              <div className="rounded-full bg-muted p-2">
                <event.icon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{event.title}</p>
                <p className="break-all text-xs text-muted-foreground">
                  {event.service}
                </p>
              </div>
              <time
                dateTime={event.at.toISOString()}
                className="shrink-0 text-xs text-muted-foreground"
              >
                {messageTimestamp(event.at)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </PageSection>
  );
}
