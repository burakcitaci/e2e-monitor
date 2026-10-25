import { PageSection } from '../../../components/common/Page';
import type { TrackingMessage } from '../../../lib/schemas';
import { messageTimestamp } from '../lib/presentation';

export function MessageInformation({
  message,
  payloadBytes,
}: {
  message: TrackingMessage;
  payloadBytes: number | null;
}) {
  const metadata = [
    ['Message ID', message.messageId],
    ['Capture ID', message.captureId],
    ['Namespace', message.namespace],
    ['Destination', message.queue],
    ['Publisher', message.sentBy],
    [
      'Transport',
      message.emulatorType === 'sns'
        ? 'AWS SNS'
        : message.emulatorType === 'sqs'
          ? 'AWS SQS'
          : 'Azure Service Bus',
    ],
    [
      'Payload size',
      payloadBytes === null
        ? 'Not available'
        : `${payloadBytes.toLocaleString()} bytes (UTF-8)`,
    ],
    ['Sent at', messageTimestamp(message.sentAt)],
  ];
  return (
    <PageSection title="Message information">
      <dl className="space-y-3">
        {metadata.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[7rem_1fr] gap-3 text-sm">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="break-all font-mono text-xs">
              {value || 'Not reported'}
            </dd>
          </div>
        ))}
      </dl>
    </PageSection>
  );
}
