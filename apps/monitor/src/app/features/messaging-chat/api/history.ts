import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import type { SavedChat } from '@e2e-monitor/entities';

export const chatHistoryKeys = {
  lists: ['chat-history', 'list'] as const,
  list: (page: number) => ['chat-history', 'list', page] as const,
  detail: (id: string) => ['chat-history', 'detail', id] as const,
};
export function useChatHistory(page: number, enabled: boolean) {
  return useQuery({
    queryKey: chatHistoryKeys.list(page),
    queryFn: () => apiClient.getChatHistory(page),
    enabled,
    retry: false,
  });
}
export function useChatStorage() {
  const client = useQueryClient();
  const saved = (chat: SavedChat) => {
    client.setQueryData(chatHistoryKeys.detail(chat.id), chat);
    void client.invalidateQueries({ queryKey: chatHistoryKeys.lists });
  };
  const create = useMutation({
    mutationFn: apiClient.createChat.bind(apiClient),
    onSuccess: saved,
    retry: false,
  });
  const append = useMutation({
    mutationFn: apiClient.appendChatTurn.bind(apiClient),
    onSuccess: saved,
    retry: false,
  });
  return {
    create: create.mutateAsync,
    append: append.mutateAsync,
    load: (id: string) =>
      client.fetchQuery({
        queryKey: chatHistoryKeys.detail(id),
        queryFn: () => apiClient.getSavedChat(id),
        staleTime: 0,
        retry: false,
      }),
  };
}
