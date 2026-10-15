import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { PendingDeliveriesService } from './pending-deliveries.service';
import type { MessageService } from './messages.service';

describe('Manual broker deliveries', () => {
  const updateTracking = jest.fn<MessageService['updateTracking']>();
  let service: PendingDeliveriesService;
  const actions = {
    complete: jest.fn<() => Promise<void>>(),
    abandon: jest.fn<() => Promise<void>>(),
    defer: jest.fn<() => Promise<void>>(),
    deadletter: jest.fn<() => Promise<void>>(),
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetAllMocks();
    updateTracking.mockResolvedValue({ status: 'received' });
    for (const action of Object.values(actions))
      action.mockResolvedValue(undefined);
    service = new PendingDeliveriesService({
      updateTracking,
    } as unknown as MessageService);
  });
  afterEach(() => {
    service.releaseAll();
    jest.useRealTimers();
  });

  it.each(['complete', 'abandon', 'defer', 'deadletter'] as const)(
    'waits for the user before executing %s and recording its outcome',
    async (disposition) => {
      const held = service.hold(
        'tracking-id',
        'topic/subscriptions/a',
        actions,
      );
      const [delivery] = service.list('tracking-id');
      expect(updateTracking).not.toHaveBeenCalled();
      expect(actions[disposition]).not.toHaveBeenCalled();
      await service.settle('tracking-id', delivery.token, disposition);
      await held;
      expect(actions[disposition]).toHaveBeenCalledTimes(1);
      expect(updateTracking).toHaveBeenCalledWith(
        'tracking-id',
        expect.objectContaining({ status: 'received', disposition }),
      );
      expect(service.list('tracking-id')).toEqual([]);
      await expect(
        service.settle('tracking-id', delivery.token, disposition),
      ).rejects.toThrow('no longer available');
    },
  );

  it('keeps separate tokens for topic subscriptions sharing a tracking record', async () => {
    const first = service.hold('id', 'topic/subscriptions/a', actions);
    const second = service.hold('id', 'topic/subscriptions/b', actions);
    const deliveries = service.list('id');
    expect(deliveries).toHaveLength(2);
    await service.settle('id', deliveries[1].token, 'complete');
    expect(service.list('id').map((delivery) => delivery.queue)).toEqual([
      'topic/subscriptions/a',
    ]);
    service.releaseAll();
    await Promise.all([first, second]);
  });

  it('does not record success when the broker action fails and allows retry', async () => {
    const held = service.hold('id', 'orders', actions);
    const [delivery] = service.list('id');
    actions.complete.mockRejectedValueOnce(new Error('lock lost'));
    await expect(
      service.settle('id', delivery.token, 'complete'),
    ).rejects.toThrow('lock lost');
    expect(updateTracking).not.toHaveBeenCalled();
    await service.settle('id', delivery.token, 'complete');
    await held;
  });

  it('expires without completing, abandoning or dead-lettering the message', async () => {
    const held = service.hold('id', 'orders', actions, 8000);
    const [delivery] = service.list('id');
    await jest.advanceTimersByTimeAsync(8001);
    await held;
    expect(service.list('id')).toEqual([]);
    for (const action of Object.values(actions))
      expect(action).not.toHaveBeenCalled();
    await expect(
      service.settle('id', delivery.token, 'complete'),
    ).rejects.toThrow('no longer available');
    expect(updateTracking).not.toHaveBeenCalled();
  });

  it('rejects another row or a simultaneous second settlement', async () => {
    const held = service.hold('id', 'orders', actions);
    const [delivery] = service.list('id');
    await expect(
      service.settle('other-id', delivery.token, 'complete'),
    ).rejects.toThrow();
    let finish!: () => void;
    actions.complete.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const first = service.settle('id', delivery.token, 'complete');
    await expect(
      service.settle('id', delivery.token, 'defer'),
    ).rejects.toThrow();
    finish();
    await Promise.all([first, held]);
    expect(actions.defer).not.toHaveBeenCalled();
  });

  it('releases settled messages even when writing the outcome fails', async () => {
    const held = service.hold('id', 'orders', actions);
    const [delivery] = service.list('id');
    updateTracking.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(
      service.settle('id', delivery.token, 'complete'),
    ).rejects.toThrow('database unavailable');
    await held;
    expect(service.list('id')).toEqual([]);
  });
});
