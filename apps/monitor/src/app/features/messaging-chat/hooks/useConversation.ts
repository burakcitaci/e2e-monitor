import { useRef, useState } from 'react';
import type { ChatTurn, MessageDraft } from '@e2e-monitor/entities';
import { useChatReply, useSendChatDraft } from '../api/hooks';

export interface TranscriptTurn extends ChatTurn {
  id: string;
  context?: string;
}
const greeting: TranscriptTurn = {
  id: 'welcome',
  role: 'assistant',
  content:
    'What would you like to send? Tell me the provider, queue or topic, and message. I can help you find a destination too.',
};

function history(turns: TranscriptTurn[]): ChatTurn[] {
  const messages = turns
    .slice(-20)
    .map(({ role, content, context }) => ({
      role,
      content: context ?? content,
    }));
  while (
    messages.length > 1 &&
    new TextEncoder().encode(JSON.stringify(messages)).byteLength > 60000
  )
    messages.shift();
  return messages;
}

export function useConversation() {
  const [turns, setTurns] = useState<TranscriptTurn[]>([greeting]);
  const [ready, setReady] = useState<{
    draft: MessageDraft;
    requestId: string;
  } | null>(null);
  const busy = useRef(false);
  const reply = useChatReply();
  const send = useSendChatDraft();
  const pending = reply.isPending || send.isPending;

  function ask(content: string) {
    if (busy.current || !content.trim()) return;
    busy.current = true;
    const next: TranscriptTurn[] = [
      ...turns,
      { id: crypto.randomUUID(), role: 'user', content },
    ];
    setTurns(next);
    setReady(null);
    send.reset();
    reply.mutate(history(next), {
      onSuccess: (result) => {
        setTurns((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: result.reply,
            context: result.draft
              ? `${result.reply}\nPrepared draft: ${JSON.stringify(result.draft)}`
              : result.reply,
          },
        ]);
        if (result.draft)
          setReady({ draft: result.draft, requestId: crypto.randomUUID() });
      },
      onSettled: () => {
        busy.current = false;
      },
    });
  }

  function confirm() {
    if (!ready || busy.current) return;
    busy.current = true;
    send.mutate(ready, {
      onSuccess: (result) => {
        setTurns((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `Message sent to ${ready.draft.provider === 'azure' ? 'Azure' : 'AWS'} ${ready.draft.destinationType} ${ready.draft.destination}. Message ID: ${result.messageId}`,
          },
        ]);
        setReady(null);
      },
      onSettled: () => {
        busy.current = false;
      },
    });
  }

  function reset() {
    if (busy.current) return;
    setTurns([greeting]);
    setReady(null);
    reply.reset();
    send.reset();
  }

  return {
    turns,
    ready,
    pending,
    sending: send.isPending,
    error: reply.error ?? send.error,
    ask,
    confirm,
    reset,
    dismiss: () => setReady(null),
  };
}
