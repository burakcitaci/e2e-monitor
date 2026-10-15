import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { ServiceBusConfig } from '../../../lib/schemas';
import { SendMessageSheet } from './SendMessageSheet';

const { mutateAsync, useConfig } = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  useConfig: vi.fn(),
}));

vi.mock('../api/service-bus', () => ({
  useSendServiceBusMessage: () => ({ mutateAsync, isPending: false }),
  useServiceBusConfig: useConfig,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const configuration: ServiceBusConfig = {
  UserConfig: {
    Namespaces: [
      {
        Name: 'queues-only',
        Queues: [
          {
            Name: 'configured-orders',
            Properties: {
              DefaultMessageTimeToLive: 'PT1H',
              MaxDeliveryCount: 10,
              DeadLetteringOnMessageExpiration: true,
            },
          },
        ],
      },
      {
        Name: 'topics-only',
        Topics: [
          {
            Name: 'configured-events',
            Properties: {
              DefaultMessageTimeToLive: 'PT1H',
              DuplicateDetectionHistoryTimeWindow: 'PT20S',
              RequiresDuplicateDetection: false,
            },
            Subscriptions: [],
          },
        ],
      },
    ],
    Logging: { Type: 'console' },
  },
};

// Radix Select uses pointer capture and scrolling APIs that jsdom lacks.
beforeAll(() => {
  class Observer {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }
  vi.stubGlobal('ResizeObserver', Observer);
  vi.stubGlobal('IntersectionObserver', Observer);
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  mutateAsync.mockResolvedValue({});
  useConfig.mockReturnValue({
    data: configuration,
    isLoading: false,
    error: null,
  });
});

describe('Azure send target picker', () => {
  it.each([
    ['configured-orders (queue)', 'configured-orders'],
    ['configured-events (topic)', 'configured-events'],
  ])('sends the raw API-configured target for %s', async (label, queue) => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<SendMessageSheet open onOpenChange={onOpenChange} />);

    await user.click(
      screen.getByRole('combobox', { name: 'Queue / Topic (optional)' }),
    );
    expect(
      screen.getByRole('option', { name: 'Default Queue' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: 'test-queue (queue)' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: label }));
    await user.type(
      screen.getByRole('textbox', { name: /Message Body/ }),
      'hello',
    );
    await user.click(screen.getByRole('button', { name: 'Simulate Message' }));

    expect(mutateAsync).toHaveBeenCalledWith({
      queue,
      body: 'hello',
      sentBy: undefined,
      messageDisposition: 'complete',
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('allows returning to the default queue after choosing an entity', async () => {
    const user = userEvent.setup();
    render(<SendMessageSheet open onOpenChange={vi.fn()} />);

    const picker = screen.getByRole('combobox', {
      name: 'Queue / Topic (optional)',
    });
    await user.click(picker);
    await user.click(
      screen.getByRole('option', { name: 'configured-events (topic)' }),
    );
    await user.click(picker);
    await user.click(screen.getByRole('option', { name: 'Default Queue' }));
    await user.type(
      screen.getByRole('textbox', { name: /Message Body/ }),
      'default body',
    );
    await user.click(screen.getByRole('button', { name: 'Simulate Message' }));

    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ queue: undefined }),
    );
  });

  it.each([
    { data: undefined, isLoading: true, error: null },
    { data: undefined, isLoading: false, error: new Error('offline') },
    {
      data: { UserConfig: { Namespaces: [], Logging: { Type: 'console' } } },
      isLoading: false,
      error: null,
    },
  ])(
    'keeps the default usable when configuration is unavailable or empty: %j',
    async (state) => {
      useConfig.mockReturnValue(state);
      const user = userEvent.setup();
      render(<SendMessageSheet open onOpenChange={vi.fn()} />);

      if (state.isLoading) {
        expect(
          screen.getByText('Loading queues and topics...'),
        ).toBeInTheDocument();
      }
      if (state.error) {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Could not load queues and topics',
        );
      }
      await user.click(
        screen.getByRole('combobox', { name: 'Queue / Topic (optional)' }),
      );
      expect(screen.getAllByRole('option')).toHaveLength(1);
      await user.click(screen.getByRole('option', { name: 'Default Queue' }));
      await user.type(
        screen.getByRole('textbox', { name: /Message Body/ }),
        'hello',
      );
      await user.click(
        screen.getByRole('button', { name: 'Simulate Message' }),
      );

      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ queue: undefined }),
      );
    },
  );
});
