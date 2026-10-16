import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../../lib/api-client';
import { useChatReply, useChatStatus, useSendChatDraft } from './hooks';

vi.mock('../../../lib/api-client', () => ({
  apiClient: {
    getChatStatus: vi.fn(),
    chat: vi.fn(),
    sendMessage: vi.fn(),
    sendSqsMessage: vi.fn(),
  },
}));
const api = vi.mocked(apiClient);
let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);
beforeEach(() => {
  vi.resetAllMocks();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});

describe('Chat query and send hooks', () => {
  it('loads readiness without exposing credentials', async () => {
    api.getChatStatus.mockResolvedValue({
      configured: false,
      model: 'gpt-4.1-mini',
    });
    const { result } = renderHook(() => useChatStatus(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.configured).toBe(false);
  });
  it('asks the model without triggering a broker send', async () => {
    api.chat.mockResolvedValue({ reply: 'Which queue?', draft: null });
    const { result } = renderHook(() => useChatReply(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync([
        { role: 'user', content: 'Send a message' },
      ]);
    });
    expect(api.sendMessage).not.toHaveBeenCalled();
    expect(api.sendSqsMessage).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.data?.reply).toBe('Which queue?'));
  });
  it('sends confirmed Azure drafts and invalidates tracking', async () => {
    api.sendMessage.mockResolvedValue({ messageId: 'id', queueName: 'events' });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useSendChatDraft(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        requestId: 'stable-id',
        draft: {
          provider: 'azure',
          destinationType: 'topic',
          destination: 'events',
          body: 'hello',
        },
      });
    });
    expect(api.sendMessage).toHaveBeenCalledWith({
      messageId: 'stable-id',
      sentBy: 'messaging-chat',
      queue: 'events',
      body: 'hello',
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['tracking-messages'],
    });
  });
  it('uses stable FIFO deduplication and never automatically retries a failed send', async () => {
    api.sendSqsMessage.mockRejectedValue(new Error('Broker unavailable'));
    const { result } = renderHook(() => useSendChatDraft(), { wrapper });
    await act(async () => {
      result.current.mutate({
        requestId: 'stable-id',
        draft: {
          provider: 'aws',
          destinationType: 'queue',
          destination: 'orders.fifo',
          body: 'hello',
        },
      });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(api.sendSqsMessage).toHaveBeenCalledTimes(1);
    expect(api.sendSqsMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        messageGroupId: 'dashboard-chat',
        messageDeduplicationId: 'stable-id',
      }),
    );
  });
});
