import { BadRequestException, ConflictException } from '@nestjs/common';
import { CaptureEventDto } from './capture-event.dto';

export interface CaptureDelivery {
  subscription: string;
  service: string;
  receivedAt?: string;
  completedAt?: string;
}

export interface CaptureState {
  provider?: 'azure' | 'aws';
  destinationType?: 'topic' | 'queue';
  captureId: string;
  messageId: string;
  namespace: string;
  destination: string;
  sent?: { service: string; occurredAt: string; body: string };
  deliveries: CaptureDelivery[];
}

const earliest = (old: string | undefined, next: string) =>
  !old || Date.parse(next) < Date.parse(old) ? next : old;

/** A monotonic snapshot: duplicate and late reports cannot undo receipt or completion. */
export function applyCaptureEvent(
  state: CaptureState | undefined,
  event: CaptureEventDto,
): CaptureState {
  const provider = event.provider ?? 'azure';
  const destinationType =
    event.destinationType ?? (provider === 'aws' ? 'queue' : 'topic');
  if (provider === 'aws' && destinationType !== 'queue')
    throw new BadRequestException('AWS capture supports SQS queues only.');
  if (
    state &&
    ((state.provider ?? 'azure') !== provider ||
      (state.destinationType ??
        (state.provider === 'aws' ? 'queue' : 'topic')) !== destinationType)
  ) {
    throw new ConflictException(
      'Capture provider or destination type does not match the existing message',
    );
  }
  if (state && state.messageId !== event.messageId) {
    throw new ConflictException(
      'Capture ID already belongs to another broker message',
    );
  }
  const next: CaptureState = state
    ? structuredClone(state)
    : {
        captureId: event.captureId,
        provider,
        destinationType,
        messageId: event.messageId,
        namespace: event.namespace,
        destination: event.destination,
        deliveries: [],
      };
  if (event.type === 'sent') {
    next.sent ??= {
      service: event.service,
      occurredAt: event.occurredAt,
      body: event.body!,
    };
  } else {
    let delivery = next.deliveries.find(
      (item) =>
        item.subscription === event.subscription &&
        item.service === event.service,
    );
    if (!delivery) {
      delivery = { subscription: event.subscription!, service: event.service };
      next.deliveries.push(delivery);
    }
    if (event.type === 'received') {
      delivery.receivedAt = earliest(delivery.receivedAt, event.occurredAt);
    } else {
      delivery.completedAt = earliest(delivery.completedAt, event.occurredAt);
    }
  }
  return next;
}

export function captureTrackingRows(id: string, state: CaptureState) {
  const base = {
    messageId: state.messageId,
    detailId: id,
    captureId: state.captureId,
    namespace: state.namespace,
    trackingSource: 'capture' as const,
    emulatorType:
      state.provider === 'aws'
        ? ('sqs' as const)
        : ('azure-service-bus' as const),
    body: state.sent?.body ?? '(waiting for publisher report)',
    sentBy: state.sent?.service ?? '(waiting for publisher report)',
    sentAt: state.sent?.occurredAt,
  };
  if (!state.deliveries.length) {
    return [
      { ...base, _id: id, queue: state.destination, status: 'sent' as const },
    ];
  }
  return state.deliveries.map((delivery) => ({
    ...base,
    _id: `${id}:${delivery.subscription}:${delivery.service}`,
    queue:
      state.destinationType === 'queue' || state.provider === 'aws'
        ? state.destination
        : `${state.destination}/subscriptions/${delivery.subscription}`,
    receivedBy: delivery.service,
    receivedAt: delivery.receivedAt,
    completedAt: delivery.completedAt,
    status: 'received' as const,
    disposition: delivery.completedAt ? ('complete' as const) : undefined,
  }));
}
