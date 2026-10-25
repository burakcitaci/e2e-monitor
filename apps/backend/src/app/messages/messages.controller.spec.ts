import { describe, expect, it, jest } from '@jest/globals';
import { MessagesController } from './messages.controller';
import { MessageService } from './messages.service';
import { CaptureService } from '../capture/capture.service';
import { AppLogger } from '../common/logging/logger.service';

describe('Message details', () => {
  it.each(['sqs', 'sns', 'azure-service-bus'])(
    'includes only matching %s captures in the emulator endpoint',
    async (emulator) => {
      const controller = new MessagesController(
        {
          findTrackingMessagesByEmulator: async () => [],
        } as unknown as MessageService,
        { setContext: jest.fn(), log: jest.fn() } as unknown as AppLogger,
        {
          trackingRows: async () =>
            ['sqs', 'sns', 'azure-service-bus'].map((emulatorType) => ({
              _id: emulatorType,
              emulatorType,
            })),
        } as unknown as CaptureService,
      );
      const result = await controller.getTrackingMessagesByEmulator(emulator);
      expect(result.data).toEqual([{ _id: emulator, emulatorType: emulator }]);
    },
  );
  const capturedId = 'a'.repeat(64);
  const historyId = '507f1f77bcf86cd799439011';
  function setup() {
    const detail = jest.fn<CaptureService['detail']>().mockResolvedValue(null);
    const findOneTracking = jest
      .fn<MessageService['findOneTracking']>()
      .mockResolvedValue(null);
    const controller = new MessagesController(
      { findOneTracking } as unknown as MessageService,
      { setContext: jest.fn(), log: jest.fn() } as unknown as AppLogger,
      { detail } as unknown as CaptureService,
    );
    return { controller, detail, findOneTracking };
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
  it('keeps legacy message history available', async () => {
    const { controller, findOneTracking, detail } = setup();
    findOneTracking.mockResolvedValue({ messageId: 'legacy', body: 'hello' });
    const result = await controller.getTrackingMessage(historyId);
    expect(result.data).toMatchObject({
      body: 'hello',
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
