import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { apiClient } from '../../../lib/api-client';
import { SendMessageDialog } from './SendMessageDialog';
import { MessageActions } from './MessageActions';
import type { TrackingMessage } from '@e2e-monitor/entities';

vi.mock('../../../lib/api-client', () => ({
  apiClient: {
    getServiceBusConfig: vi.fn(),
    getAwsSqsConfig: vi.fn(),
    getMessageResources: vi.fn(),
    sendMessage: vi.fn(),
    sendSqsMessage: vi.fn(),
    settleMessage: vi.fn(),
  },
  ApiError: class extends Error {},
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const api = vi.mocked(apiClient);

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
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => {
  api.getServiceBusConfig.mockResolvedValue({
    UserConfig: {
      Namespaces: [
        {
          Name: 'local',
          Queues: [
            {
              Name: 'orders',
              Properties: {
                DefaultMessageTimeToLive: 'PT1H',
                MaxDeliveryCount: 10,
                DeadLetteringOnMessageExpiration: true,
              },
            },
          ],
          Topics: [
            {
              Name: 'events',
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
  });
  api.getAwsSqsConfig.mockResolvedValue({
    endpoint: 'http://custom-endpoint:4566',
    region: 'us-east-1',
    queueName: 'default-orders',
  });
  api.getMessageResources.mockResolvedValue([
    {
      id: '1',
      name: 'saved-orders',
      provider: 'aws',
      type: 'queue',
      status: 'active',
    },
    {
      id: '2',
      name: 'inactive-orders',
      provider: 'aws',
      type: 'queue',
      status: 'inactive',
    },
  ]);
  api.sendMessage.mockResolvedValue({
    queueName: 'orders',
    messageId: 'message-id',
  });
  api.sendSqsMessage.mockResolvedValue({
    queueName: 'saved-orders',
    md5OfBody: 'test-hash',
    queueUrl: 'http://custom-endpoint/saved-orders',
    messageId: 'message-id',
  });
  api.settleMessage.mockResolvedValue({ success: true });
});

function renderWithClient(element: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
  return client;
}
async function select(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  option: string,
) {
  await user.click(screen.getByRole('combobox', { name }));
  await user.click(await screen.findByRole('option', { name: option }));
}

describe('Unified send message form', () => {
  it('sends a selected Azure topic and refreshes tracking', async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    const client = renderWithClient(<SendMessageDialog onClose={close} />);
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await waitFor(() => expect(api.getServiceBusConfig).toHaveBeenCalled());
    await select(user, 'Destination type', 'Topic');
    await select(user, 'Destination', 'events');
    await user.type(
      screen.getByRole('textbox', { name: 'Message body' }),
      'hello topic',
    );
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(close).toHaveBeenCalled());
    expect(api.sendMessage).toHaveBeenCalledWith({
      queue: 'events',
      body: 'hello topic',
      sentBy: undefined,
    });
    expect(api.sendSqsMessage).not.toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['tracking-messages'],
    });
  });

  it('resets the destination on provider change and sends an AWS queue name without a URL', async () => {
    const user = userEvent.setup();
    renderWithClient(<SendMessageDialog onClose={vi.fn()} />);
    await select(user, 'Destination type', 'Topic');
    await select(user, 'Destination', 'events');
    await select(user, 'Provider', 'AWS SQS');
    expect(
      screen.getByRole('combobox', { name: 'Destination type' }),
    ).toHaveTextContent('Queue');
    await select(user, 'Destination', 'saved-orders');
    await user.type(
      screen.getByRole('textbox', { name: 'Message body' }),
      'hello sqs',
    );
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() =>
      expect(api.sendSqsMessage).toHaveBeenCalledWith({
        queueName: 'saved-orders',
        body: 'hello sqs',
        sentBy: undefined,
      }),
    );
    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it('keeps body and destination visible on a broker failure', async () => {
    api.sendMessage.mockRejectedValueOnce(new Error('Service Bus is offline'));
    const user = userEvent.setup();
    const close = vi.fn();
    renderWithClient(<SendMessageDialog onClose={close} />);
    await user.type(
      screen.getByRole('textbox', { name: 'Message body' }),
      'retry me',
    );
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Service Bus is offline',
    );
    expect(screen.getByRole('textbox', { name: 'Message body' })).toHaveValue(
      'retry me',
    );
    expect(close).not.toHaveBeenCalled();
  });

  it('prevents duplicate sends while pending', async () => {
    let finish!: (value: { queueName: string; messageId: string }) => void;
    api.sendMessage.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const user = userEvent.setup();
    const close = vi.fn();
    renderWithClient(<SendMessageDialog onClose={close} />);
    await user.type(
      screen.getByRole('textbox', { name: 'Message body' }),
      'hello',
    );
    await user.dblClick(screen.getByRole('button', { name: 'Send message' }));
    expect(api.sendMessage).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Sending...' })).toBeDisabled();
    finish({ queueName: 'orders', messageId: 'id' });
    await waitFor(() => expect(close).toHaveBeenCalled());
  });
});

describe('Table broker actions', () => {
  const message: TrackingMessage = {
    _id: 'tracking-id',
    messageId: 'broker-id',
    body: 'hello',
    sentBy: 'test',
    sentAt: new Date(),
    status: 'processing',
    emulatorType: 'azure-service-bus',
    pendingDeliveries: [
      {
        token: 'live-token',
        queue: 'events/subscriptions/analytics',
        expiresAt: new Date('2099-01-01'),
      },
    ],
  };
  it.each([
    ['Complete (receive)', 'complete'],
    ['Abandon', 'abandon'],
    ['Defer', 'defer'],
    ['Dead-letter (DLQ)', 'deadletter'],
  ])(
    'settles the selected live delivery with %s',
    async (label, disposition) => {
      const user = userEvent.setup();
      renderWithClient(<MessageActions message={message} />);
      await user.click(
        screen.getByRole('button', { name: 'Receive / settle' }),
      );
      await user.click(screen.getByRole('menuitem', { name: label }));
      await waitFor(() =>
        expect(api.settleMessage).toHaveBeenCalledWith(
          'tracking-id',
          'live-token',
          disposition,
        ),
      );
    },
  );
  it('does not offer settlement actions on historical messages', () => {
    renderWithClient(
      <MessageActions
        message={{ ...message, status: 'received', pendingDeliveries: [] }}
      />,
    );
    expect(screen.getByText('History')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
