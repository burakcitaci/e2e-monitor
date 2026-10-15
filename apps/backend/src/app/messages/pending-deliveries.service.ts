import { ConflictException, Injectable, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { MessageService } from './messages.service';
import type { MessageDisposition } from './message.schema';

type Actions = Record<MessageDisposition, () => Promise<void>>;
type PendingDelivery = {
  trackingId: string;
  queue: string;
  expiresAt: Date;
  actions: Actions;
  release: () => void;
  timer: NodeJS.Timeout;
  settling: boolean;
};

@Injectable()
export class PendingDeliveriesService implements OnModuleDestroy {
  private readonly deliveries = new Map<string, PendingDelivery>();

  constructor(private readonly messages: MessageService) {}

  hold(
    trackingId: string,
    queue: string,
    actions: Actions,
    lifetimeMs = 90_000,
  ): Promise<void> {
    const token = randomUUID();
    return new Promise((release) => {
      const timer = setTimeout(() => {
        if (!this.deliveries.get(token)?.settling) this.remove(token);
      }, lifetimeMs);
      this.deliveries.set(token, {
        trackingId,
        queue,
        actions,
        release,
        timer,
        expiresAt: new Date(Date.now() + lifetimeMs),
        settling: false,
      });
    });
  }

  list(trackingId: string) {
    return Array.from(this.deliveries.entries())
      .filter(
        ([, delivery]) =>
          delivery.trackingId === trackingId &&
          delivery.expiresAt.getTime() > Date.now(),
      )
      .map(([token, delivery]) => ({
        token,
        queue: delivery.queue,
        expiresAt: delivery.expiresAt,
      }));
  }

  async settle(
    trackingId: string,
    token: string,
    disposition: MessageDisposition,
  ) {
    const delivery = this.deliveries.get(token);
    if (
      !delivery ||
      delivery.trackingId !== trackingId ||
      delivery.settling ||
      delivery.expiresAt.getTime() <= Date.now()
    ) {
      throw new ConflictException(
        'This delivery is no longer available. Refresh and wait for broker redelivery.',
      );
    }
    delivery.settling = true;
    let settled = false;
    try {
      await delivery.actions[disposition]();
      settled = true;
      return await this.messages.updateTracking(trackingId, {
        status: 'received',
        disposition,
        receivedBy: 'dashboard',
        receivedAt: new Date(),
      });
    } finally {
      if (settled) this.remove(token);
      else {
        delivery.settling = false;
        if (delivery.expiresAt.getTime() <= Date.now()) this.remove(token);
      }
    }
  }

  private remove(token: string) {
    const delivery = this.deliveries.get(token);
    if (!delivery) return;
    clearTimeout(delivery.timer);
    this.deliveries.delete(token);
    delivery.release();
  }

  releaseAll() {
    for (const token of this.deliveries.keys()) this.remove(token);
  }

  onModuleDestroy() {
    this.releaseAll();
  }
}
