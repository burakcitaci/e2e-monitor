import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../../lib/api-client';
import { chatHistoryKeys, useChatHistory, useChatStorage } from './history';

vi.mock('../../../lib/api-client', () => ({
  apiClient: {
    getChatHistory: vi.fn(),
    getSavedChat: vi.fn(),
    createChat: vi.fn(),
    appendChatTurn: vi.fn(),
  },
}));
const api = vi.mocked(apiClient);
const chat = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Example',
  mode: 'tools' as const,
  revision: 0,
  turns: [],
  createdAt: '2026-10-16T10:00:00Z',
  updatedAt: '2026-10-16T10:00:00Z',
};
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
describe('Chat history server state', () => {
  it('fetches only the requested history page when the panel is enabled', async () => {
    api.getChatHistory.mockResolvedValue({
      items: [chat],
      total: 21,
      page: 2,
      pages: 2,
    });
    const { result, rerender } = renderHook(
      ({ enabled }) => useChatHistory(2, enabled),
      { wrapper, initialProps: { enabled: false } },
    );
    expect(api.getChatHistory).not.toHaveBeenCalled();
    rerender({ enabled: true });
    await waitFor(() => expect(result.current.data?.page).toBe(2));
    expect(api.getChatHistory).toHaveBeenCalledWith(2);
  });
  it('updates cached records and invalidates lists after persistence', async () => {
    api.createChat.mockResolvedValue(chat);
    const turn = {
      id: '22222222-2222-4222-8222-222222222222',
      role: 'user' as const,
      content: 'Hello',
    };
    api.appendChatTurn.mockResolvedValue({
      ...chat,
      revision: 1,
      turns: [turn],
    });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useChatStorage(), { wrapper });
    await act(async () => {
      await result.current.create({ id: chat.id, mode: 'tools' });
      await result.current.append({ id: chat.id, revision: 0, turn });
    });
    expect(client.getQueryData(chatHistoryKeys.detail(chat.id))).toMatchObject({
      revision: 1,
      turns: [turn],
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: chatHistoryKeys.lists,
    });
  });
  it('reloads the selected chat from the server instead of trusting stale revisions', async () => {
    api.getSavedChat
      .mockResolvedValueOnce(chat)
      .mockResolvedValueOnce({ ...chat, revision: 2 });
    const { result } = renderHook(() => useChatStorage(), { wrapper });
    expect((await result.current.load(chat.id)).revision).toBe(0);
    expect((await result.current.load(chat.id)).revision).toBe(2);
    expect(api.getSavedChat).toHaveBeenCalledTimes(2);
  });
});
