import { PageSection } from '../../../components/common/Page';
import { Badge } from '../../../components/ui/badge';
import { analyzeMessage, formatDuration } from '../lib/analysis';
import { messageTimestamp } from '../lib/presentation';

type Delivery = ReturnType<typeof analyzeMessage>['timings'][number];

function SubscriberDelivery({ delivery }: { delivery: Delivery }) {
  const durations: [string, number | null][] = [
    ['Delivery', delivery.deliveryMs],
    ['Processing', delivery.processingMs],
    ['End to end', delivery.totalMs],
  ];
  return (
    <article className="space-y-3 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="break-all text-sm font-medium">{delivery.service}</h3>
          <p className="break-all text-xs text-muted-foreground">
            {delivery.subscription}
          </p>
        </div>
        <Badge variant={delivery.completionReported ? 'default' : 'outline'}>
          {delivery.completionReported ? 'Complete' : 'Receipt observed'}
        </Badge>
      </div>
      <dl className="grid grid-cols-3 gap-3 text-sm">
        {durations.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 tabular-nums">{formatDuration(value)}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">
        Received: {messageTimestamp(delivery.receivedAt)}
        <br />
        Completed: {messageTimestamp(delivery.completedAt)}
      </p>
    </article>
  );
}

export function SubscriberDeliveries({
  deliveries,
}: {
  deliveries: Delivery[];
}) {
  return (
    <PageSection title="Subscriber deliveries">
      {!deliveries.length ? (
        <p className="text-sm text-muted-foreground">
          No subscriber reports yet.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {deliveries.map((delivery) => (
            <SubscriberDelivery
              key={JSON.stringify([delivery.subscription, delivery.service])}
              delivery={delivery}
            />
          ))}
        </div>
      )}
    </PageSection>
  );
}
