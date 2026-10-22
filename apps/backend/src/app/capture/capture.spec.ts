import 'reflect-metadata';
import { describe, expect, it, jest } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import { CaptureEventDto } from './capture-event.dto';
import {
  applyCaptureEvent,
  captureTrackingRows,
  CaptureState,
} from './capture-state';
import { CaptureController } from './capture.controller';
import { CaptureService } from './capture.service';
import { ServiceBusModule } from '../service-bus/service-bus.module';
import { ServiceBusWorker } from '../service-bus/service-bus.worker';

const sent: CaptureEventDto = {
  schemaVersion: 1,
  eventId: 'e381f3c6-71de-4b1a-9213-b4dd5aaaf589',
  captureId: '1c0b1ac8-f2c6-422e-9921-3e438801b2d1',
  messageId: 'broker-id',
  namespace: 'localhost',
  destination: 'application-events',
  type: 'sent',
  service: 'financing-api',
  occurredAt: '2026-10-22T19:00:00.000Z',
  body: 'Hello from financing',
};
const received: CaptureEventDto = {
  ...sent,
  eventId: 'a87f183f-81e2-41f6-af79-aea5f77b5f19',
  type: 'received',
  service: 'orders-consumer',
  subscription: 'logging-service',
  occurredAt: '2026-10-22T19:00:00.100Z',
  body: undefined,
};
const completed: CaptureEventDto = {
  ...received,
  eventId: 'e23cabfe-5578-4a7a-a6ce-77a1b4c4a2f7',
  type: 'completed',
  occurredAt: '2026-10-22T19:00:00.200Z',
};

describe('Application capture', () => {
  it.each([
    [sent, received, completed],
    [sent, completed, received],
    [received, sent, completed],
    [received, completed, sent],
    [completed, sent, received],
    [completed, received, sent],
  ])(
    'retains the complete message regardless of report order (%p)',
    (...events) => {
      let state: CaptureState | undefined;
      for (const event of events) state = applyCaptureEvent(state, event);
      const rows = captureTrackingRows('id', state!);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        body: 'Hello from financing',
        sentBy: 'financing-api',
        receivedBy: 'orders-consumer',
        status: 'received',
        disposition: 'complete',
        receivedAt: received.occurredAt,
        completedAt: completed.occurredAt,
        queue: 'application-events/subscriptions/logging-service',
      });
    },
  );

  it('keeps retries idempotent and retains the first receipt', () => {
    let state = applyCaptureEvent(undefined, received);
    state = applyCaptureEvent(state, completed);
    state = applyCaptureEvent(state, {
      ...received,
      occurredAt: '2026-10-22T19:00:01.000Z',
    });
    expect(applyCaptureEvent(state, completed)).toEqual(state);
    expect(state.deliveries).toHaveLength(1);
    expect(state.deliveries[0].receivedAt).toBe(received.occurredAt);
  });

  it('does not complete other subscribers when one subscriber completes', () => {
    let state = applyCaptureEvent(undefined, sent);
    state = applyCaptureEvent(state, completed);
    state = applyCaptureEvent(state, {
      ...received,
      subscription: 'analytics-processor',
      service: 'analytics',
    });
    const rows = captureTrackingRows('id', state);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveProperty('disposition', 'complete');
    expect(rows[1]).toHaveProperty('disposition', undefined);
    expect(rows[0]._id).not.toBe(rows[1]._id);
  });

  it('shows a sent message before any subscriber reports', () => {
    expect(
      captureTrackingRows('id', applyCaptureEvent(undefined, sent))[0],
    ).toMatchObject({
      status: 'sent',
      body: sent.body,
      trackingSource: 'capture',
    });
  });

  it('rejects reuse of a capture ID for another broker message', () => {
    expect(() =>
      applyCaptureEvent(applyCaptureEvent(undefined, sent), {
        ...received,
        messageId: 'other',
      }),
    ).toThrow('another broker message');
  });

  it.each([sent, received, completed])(
    'accepts the valid %p report',
    async (event) => {
      expect(
        await validate(plainToInstance(CaptureEventDto, event)),
      ).toHaveLength(0);
    },
  );

  it.each([
    { ...sent, body: undefined },
    { ...received, subscription: undefined },
    { ...completed, occurredAt: 'yesterday' },
    { ...sent, captureId: 'invalid' },
    { ...sent, unexpected: true },
    { ...sent, schemaVersion: 2 },
  ])('rejects malformed reports (%p)', async (event) => {
    expect(
      (
        await validate(plainToInstance(CaptureEventDto, event), {
          whitelist: true,
          forbidNonWhitelisted: true,
        })
      ).length,
    ).toBeGreaterThan(0);
  });

  it('rejects unauthorized reports before writing', async () => {
    const ingest = jest.fn<CaptureService['ingest']>();
    const controller = new CaptureController(
      { ingest } as unknown as CaptureService,
      new ConfigService({ CAPTURE_TOKEN: 'test-secret' }),
    );
    await expect(controller.ingest('Bearer wrong', sent)).rejects.toThrow(
      'Invalid capture token',
    );
    expect(ingest).not.toHaveBeenCalled();
    ingest.mockResolvedValue({ captureId: sent.captureId });
    await expect(
      controller.ingest('Bearer test-secret', sent),
    ).resolves.toMatchObject({ success: true });
  });

  it('does not register the automatic Service Bus consumer', () => {
    expect(Reflect.getMetadata('providers', ServiceBusModule)).not.toContain(
      ServiceBusWorker,
    );
  });
});
