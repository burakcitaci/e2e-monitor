import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ChatMode, ChatTurn, MessageDraft } from '@e2e-monitor/entities';
import { apiClient } from '../../../lib/api-client';
import { trackingMessageKeys } from '../../../hooks/api/tracking-messages';

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

export function useSendChatDraft() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      draft,
      requestId,
    }: {
      draft: MessageDraft;
      requestId: string;
    }) => {
      const payload = {
        body: draft.body,
        messageId: requestId,
        sentBy: 'messaging-chat',
      };
      return draft.provider === 'azure'
        ? apiClient.sendMessage({ ...payload, queue: draft.destination })
        : apiClient.sendSqsMessage({
            ...payload,
            queueName: draft.destination,
            ...(draft.destination.endsWith('.fifo')
              ? {
                  messageGroupId: 'dashboard-chat',
                  messageDeduplicationId: requestId,
                }
              : {}),
          });
    },
    retry: false,
    onSuccess: (_result, { draft }) => {
      void client.invalidateQueries({ queryKey: trackingMessageKeys.all });
      void client.invalidateQueries({
        queryKey: [
          draft.provider === 'azure' ? 'service-bus' : 'aws-sqs',
          'messages',
        ],
      });
    },
  });
}
