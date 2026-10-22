import { useMutation, useQuery } from '@tanstack/react-query';
import type { ChatMode, ChatTurn } from '@e2e-monitor/entities';
import { apiClient } from '../../../lib/api-client';

export function useChatStatus() {
  return useQuery({
    queryKey: ['messaging-chat', 'status'],
    queryFn: () => apiClient.getChatStatus(),
    retry: false,
  });
}

export function useChatReply(mode: ChatMode = 'structured') {
  return useMutation({
    mutationFn: (messages: ChatTurn[]) => apiClient.chat(messages, mode),
    retry: false,
  });
}
