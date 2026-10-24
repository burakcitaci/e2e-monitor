import { useParams } from 'react-router';
import { useTrackingMessage } from '../../hooks/api/tracking-messages';
import { ApiError } from '../../lib/api-client';
import { Badge } from '../../components/ui/badge';
import { BackLink, PageHeader, PageState } from '../../components/common/Page';
import { DetailPage, DetailStat } from '../../components/common/DetailPage';
import { MessageActions } from '../messages/components/MessageActions';
import { analyzeMessage, formatDuration } from './lib/analysis';
import { MessagePayload } from './components/MessagePayload';
import { MessageInformation } from './components/MessageInformation';
import { SubscriberDeliveries } from './components/SubscriberDeliveries';
import { MessageTimeline } from './components/MessageTimeline';

export default function MessageDetailPage() {
  const { id = '' } = useParams();
  const { data: message, isLoading, error, refetch } = useTrackingMessage(id);
  const back = <BackLink to="/">Back to messages</BackLink>;
  if (isLoading)
    return (
      <DetailPage>
        {back}
        <PageState title="Loading message details…" />
      </DetailPage>
    );
  if (!message) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <DetailPage>
        {back}
        <PageState
          title={notFound ? 'Message not found' : 'Could not load message'}
          description={
            notFound
              ? 'This message may have been removed, or the link is invalid.'
              : error?.message
          }
          retry={() => void refetch()}
        />
      </DetailPage>
    );
  }

  const analysis = analyzeMessage(message);
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

  return (
    <DetailPage>
      {back}
      <PageHeader
        title="Message details"
        description={
          <>
            {message.sentBy ?? 'Unknown publisher'} →{' '}
            {message.queue ?? 'Unknown destination'}
          </>
        }
        badge={
          <Badge variant="outline">
            {message.trackingSource === 'capture'
              ? 'Application capture'
              : 'Broker history'}
          </Badge>
        }
        actions={<MessageActions message={message} />}
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          Refresh failed. Showing the last loaded data.{' '}
          <button className="underline" onClick={() => void refetch()}>
            Retry
          </button>
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statistics.map((stat) => (
          <DetailStat key={stat.label} {...stat} />
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
      <SubscriberDeliveries deliveries={analysis.timings} />
      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <MessagePayload body={message.body} />
        <MessageInformation
          message={message}
          payloadBytes={analysis.payloadBytes}
        />
      </div>
      <MessageTimeline message={message} analysis={analysis} />
    </DetailPage>
  );
}
