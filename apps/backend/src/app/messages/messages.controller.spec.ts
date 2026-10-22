import { describe, expect, it, jest } from '@jest/globals';
import { MessagesController } from './messages.controller';
import { MessageService } from './messages.service';
import { PendingDeliveriesService } from './pending-deliveries.service';
import { CaptureService } from '../capture/capture.service';
import { AppLogger } from '../common/logger.service';

describe('Message details', () => {
  const capturedId = 'a'.repeat(64);
  const historyId = '507f1f77bcf86cd799439011';
  function setup() {
    const detail = jest.fn<CaptureService['detail']>().mockResolvedValue(null);
    const findOneTracking = jest
      .fn<MessageService['findOneTracking']>()
      .mockResolvedValue(null);
    const list = jest
      .fn<PendingDeliveriesService['list']>()
      .mockReturnValue([]);
    const controller = new MessagesController(
      { findOneTracking } as unknown as MessageService,
      { setContext: jest.fn(), log: jest.fn() } as unknown as AppLogger,
      { list } as unknown as PendingDeliveriesService,
      { detail } as unknown as CaptureService,
    );
    return { controller, detail, findOneTracking, list };
  }
  it('loads a capture by its stable publication ID', async () => {
    const { controller, detail, findOneTracking } = setup();
    detail.mockResolvedValue({
      _id: capturedId,
      queue: 'events',
      deliveries: [
        { service: 'B', subscription: 'one' },
        { service: 'C', subscription: 'two' },
      ],
    } as Awaited<ReturnType<CaptureService['detail']>>);
    const result = await controller.getTrackingMessage(capturedId);
    expect(result.data).toMatchObject({
      _id: capturedId,
      deliveries: [
        { service: 'B', subscription: 'one' },
        { service: 'C', subscription: 'two' },
      ],
    });
    expect(findOneTracking).not.toHaveBeenCalled();
  });
  it('keeps legacy message detail and live settlement information available', async () => {
    const { controller, findOneTracking, detail, list } = setup();
    findOneTracking.mockResolvedValue({ messageId: 'legacy', body: 'hello' });
    list.mockReturnValue([
      { token: 'lease', queue: 'orders', expiresAt: new Date() },
    ]);
    const result = await controller.getTrackingMessage(historyId);
    expect(result.data).toMatchObject({
      body: 'hello',
      pendingDeliveries: [{ token: 'lease' }],
    });
    expect(detail).not.toHaveBeenCalled();
  });
  it.each(['invalid', capturedId, historyId])(
    'returns not found for unavailable messages (%s)',
    async (id) => {
      const { controller } = setup();
      await expect(controller.getTrackingMessage(id)).rejects.toMatchObject({
        status: 404,
      });
    },
  );
});
