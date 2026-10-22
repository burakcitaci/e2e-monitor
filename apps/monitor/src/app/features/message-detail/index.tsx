import { Link, useParams } from 'react-router';
import { ArrowLeft, Clock, CheckCircle2, Send, Inbox } from 'lucide-react';
import { useTrackingMessage } from '../../hooks/api/tracking-messages';
import { ApiError } from '../../lib/api-client';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { MessageActions } from '../messages/components/MessageActions';
import { analyzeMessage, formatDuration } from './analysis';

const timestamp = (value: Date | undefined | null) =>
  value ? value.toLocaleString() : 'Not reported';

function Payload({ body }: { body?: string }) {
  let text = body ?? 'Payload not reported';
  let format = 'Plain text';
  try {
    text = JSON.stringify(JSON.parse(text), null, 2);
    format = 'JSON';
  } catch {
    /* Plain text bodies are valid. */
  }
  return (
    <section className="rounded-xl border bg-card p-5 min-w-0">
      <div className="mb-4 flex justify-between items-center">
        <h2 className="font-semibold">Payload</h2>
        <Badge variant="outline">{format}</Badge>
      </div>
      <pre className="max-h-[32rem] overflow-auto rounded-lg bg-muted/50 p-4 text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
        {text}
      </pre>
    </section>
  );
}

export default function MessageDetailPage() {
  const { id = '' } = useParams();
  const { data: message, isLoading, error, refetch } = useTrackingMessage(id);
  const back = (
    <Link
      to="/"
      className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Back to messages
    </Link>
  );
  if (isLoading)
    return (
      <div className="p-6 space-y-6">
        {back}
        <p role="status">Loading message details…</p>
      </div>
    );
  if (!message)
    return (
      <div className="p-6 space-y-6">
        {back}
        <div role="alert" className="rounded-xl border p-6 space-y-3">
          <h1 className="text-xl font-semibold">
            {error instanceof ApiError && error.status === 404
              ? 'Message not found'
              : 'Could not load message'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {error instanceof ApiError && error.status === 404
              ? 'This message may have been removed, or the link is invalid.'
              : error?.message}
          </p>
          <Button onClick={() => refetch()} variant="outline">
            Retry
          </Button>
        </div>
      </div>
    );

  const analysis = analyzeMessage(message);
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
  const statistics = [
    {
      label: 'Observed subscribers',
      value: String(analysis.timings.length),
      note: 'Subscribers that have reported activity',
    },
    {
      label: 'Completed',
      value: `${analysis.completed} / ${analysis.timings.length}`,
      note: 'Among observed subscribers',
    },
    {
      label: 'Average delivery time',
      value: formatDuration(analysis.delivery.value),
      note: `${analysis.delivery.samples} valid timing samples`,
    },
    {
      label: 'Average processing time',
      value: formatDuration(analysis.processing.value),
      note: `${analysis.processing.samples} valid timing samples`,
    },
  ];
  const metadata = [
    ['Message ID', message.messageId],
    ['Capture ID', message.captureId],
    ['Namespace', message.namespace],
    ['Destination', message.queue],
    ['Publisher', message.sentBy],
    [
      'Transport',
      message.emulatorType === 'sqs' ? 'AWS SQS' : 'Azure Service Bus',
    ],
    [
      'Payload size',
      analysis.payloadBytes === null
        ? 'Not available'
        : `${analysis.payloadBytes.toLocaleString()} bytes (UTF-8)`,
    ],
    ['Sent at', timestamp(message.sentAt)],
  ];

  return (
    <div className="p-4 md:p-6 space-y-6 min-w-0 max-w-7xl w-full mx-auto">
      {back}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-3 items-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              Message details
            </h1>
            <Badge variant="outline">
              {message.trackingSource === 'capture'
                ? 'Application capture'
                : 'Broker history'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground break-all">
            {message.sentBy ?? 'Unknown publisher'} →{' '}
            {message.queue ?? 'Unknown destination'}
          </p>
        </div>
        <MessageActions message={message} />
      </header>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          Refresh failed. Showing the last loaded data.{' '}
          <button className="underline" onClick={() => refetch()}>
            Retry
          </button>
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statistics.map((stat) => (
          <section
            key={stat.label}
            aria-label={stat.label}
            className="rounded-xl border bg-card p-5"
          >
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {stat.value}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{stat.note}</p>
          </section>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Statistics cover this message’s observed subscribers, not all configured
        subscriptions. Timing uses application clocks; missing or negative
        durations are excluded. Processing runs from receipt to confirmed
        settlement. Updates every three seconds.
      </p>
      {analysis.timings.some((delivery) => delivery.clockIssue) && (
        <p
          role="alert"
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
        >
          Clock inconsistency detected. Check publisher and subscriber clock
          synchronization; affected durations are unavailable.
        </p>
      )}
      <section className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Inbox className="size-4 text-muted-foreground" />
          <h2 className="font-semibold">Subscriber deliveries</h2>
        </div>
        {!analysis.timings.length ? (
          <p className="text-sm text-muted-foreground">
            No subscriber reports yet.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {analysis.timings.map((delivery) => (
              <article
                key={JSON.stringify([delivery.subscription, delivery.service])}
                className="rounded-lg border p-4 space-y-3"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <h3 className="font-medium break-all">
                      {delivery.service}
                    </h3>
                    <p className="text-xs text-muted-foreground break-all">
                      {delivery.subscription}
                    </p>
                  </div>
                  <Badge
                    variant={
                      delivery.completionReported ? 'default' : 'outline'
                    }
                  >
                    {delivery.completionReported
                      ? 'Complete'
                      : 'Receipt observed'}
                  </Badge>
                </div>
                <dl className="grid grid-cols-3 gap-3 text-sm">
                  {[
                    ['Delivery', delivery.deliveryMs],
                    ['Processing', delivery.processingMs],
                    ['End to end', delivery.totalMs],
                  ].map(([label, value]) => (
                    <div key={String(label)}>
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="mt-1 tabular-nums">
                        {formatDuration(value as number | null)}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="text-xs text-muted-foreground">
                  Received: {timestamp(delivery.receivedAt)}
                  <br />
                  Completed: {timestamp(delivery.completedAt)}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
      <div className="grid gap-6 lg:grid-cols-2 min-w-0">
        <Payload body={message.body} />
        <section className="rounded-xl border bg-card p-5 min-w-0">
          <h2 className="font-semibold mb-4">Message information</h2>
          <dl className="space-y-3">
            {metadata.map(([label, value]) => (
              <div
                key={label}
                className="grid grid-cols-[7rem_1fr] gap-3 text-sm"
              >
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-mono text-xs break-all">
                  {value || 'Not reported'}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
      <section className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2 mb-5">
          <Clock className="size-4 text-muted-foreground" />
          <h2 className="font-semibold">Reported timeline</h2>
        </div>
        {!timeline.length ? (
          <p className="text-sm text-muted-foreground">
            No timestamps reported.
          </p>
        ) : (
          <ol className="space-y-5">
            {timeline.map((event, index) => (
              <li key={index} className="flex items-start gap-3">
                <div className="rounded-full bg-muted p-2">
                  <event.icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{event.title}</p>
                  <p className="text-xs text-muted-foreground break-all">
                    {event.service}
                  </p>
                </div>
                <time
                  dateTime={event.at.toISOString()}
                  className="text-xs text-muted-foreground shrink-0"
                >
                  {timestamp(event.at)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
