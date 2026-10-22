import type { TrackingMessage } from '@e2e-monitor/entities';

export function messageDetailPath(message: TrackingMessage) {
  const id =
    message.detailId ??
    (message.trackingSource === 'capture'
      ? message._id.split(':')[0]
      : message._id);
  return `/messages/${encodeURIComponent(id)}`;
}

export function messageStatus(message: TrackingMessage): string {
  if (message.pendingDeliveries?.length) return 'pending';
  if (message.disposition === 'complete') return 'completed';
  return message.disposition ?? message.status;
}

export const messageStatusLabels: Record<string, string> = {
  pending: 'Pending',
  completed: 'Completed',
  sent: 'Sent',
  processing: 'Processing',
  received: 'Received',
  abandon: 'Abandoned',
  defer: 'Deferred',
  deadletter: 'Dead-lettered',
};
