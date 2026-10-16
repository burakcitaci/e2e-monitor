import { useRef, useState } from 'react';
import type {
  ChatMode,
  ChatTurn,
  MessageDraft,
  SavedChat,
  SavedChatTurn,
} from '@e2e-monitor/entities';
import { useChatReply, useSendChatDraft } from '../api/hooks';
import { useChatStorage } from '../api/history';

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
  const messages = turns.slice(-20).map(({ role, content, context }) => ({
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
  const [mode, setMode] = useState<ChatMode>('structured');
  const [turns, setTurns] = useState<TranscriptTurn[]>([greeting]);
  const [ready, setReady] = useState<{
    draft: MessageDraft;
    requestId: string;
  } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const record = useRef<SavedChat | null>(null);
  const recordId = useRef<string | null>(null);
  const failedTurn = useRef<SavedChatTurn | null>(null);
  const busy = useRef(false);
  const reply = useChatReply(mode);
  const send = useSendChatDraft();
  const storage = useChatStorage();

  function start() {
    busy.current = true;
    setPending(true);
    setError(null);
  }
  function finish() {
    busy.current = false;
    setPending(false);
  }
  function report(cause: unknown) {
    setError(
      cause instanceof Error ? cause : new Error('The chat request failed.'),
    );
  }

  async function persist(turn: SavedChatTurn) {
    try {
      if (!record.current) {
        recordId.current ??= crypto.randomUUID();
        record.current = await storage.create({ id: recordId.current, mode });
        setSelectedId(record.current.id);
      }
      record.current = await storage.append({
        id: record.current.id,
        revision: record.current.revision,
        turn,
      });
      failedTurn.current = null;
      setUnsaved(false);
    } catch (cause) {
      failedTurn.current = turn;
      setUnsaved(true);
      throw new Error(
        `Chat history could not be saved. ${cause instanceof Error ? cause.message : 'Please try again.'}`,
      );
    }
  }

  async function ask(content: string) {
    if (busy.current || unsaved || !content.trim()) return;
    if ((record.current?.turns.length ?? 0) >= 198) {
      setError(
        new Error('This conversation is full. Start a new chat to continue.'),
      );
      return;
    }
    start();
    const user: TranscriptTurn = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
    };
    const next = [...turns, user];
    setTurns(next);
    setReady(null);
    send.reset();
    try {
      await persist(user);
      const result = await reply.mutateAsync(history(next));
      const assistant: TranscriptTurn = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.reply,
        context: result.draft
          ? `${result.reply}\nPrepared draft: ${JSON.stringify(result.draft)}`
          : result.reply,
      };
      setTurns([...next, assistant]);
      if (result.draft)
        setReady({ draft: result.draft, requestId: crypto.randomUUID() });
      await persist(assistant);
    } catch (cause) {
      report(cause);
    } finally {
      finish();
    }
  }

  async function confirm() {
    if (!ready || busy.current || unsaved) return;
    start();
    try {
      const result = await send.mutateAsync(ready);
      // A successful broker send must never become a retryable old draft.
      setReady(null);
      const sent: TranscriptTurn = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Message sent to ${ready.draft.provider === 'azure' ? 'Azure' : 'AWS'} ${ready.draft.destinationType} ${ready.draft.destination}. Message ID: ${result.messageId}`,
      };
      setTurns((current) => [...current, sent]);
      await persist(sent);
    } catch (cause) {
      report(cause);
    } finally {
      finish();
    }
  }

  function reset() {
    if (busy.current) return;
    record.current = null;
    recordId.current = null;
    failedTurn.current = null;
    setSelectedId(null);
    setTurns([greeting]);
    setReady(null);
    setUnsaved(false);
    setError(null);
    reply.reset();
    send.reset();
  }

  async function select(id: string) {
    if (busy.current) return;
    start();
    try {
      const saved = await storage.load(id);
      record.current = saved;
      recordId.current = saved.id;
      failedTurn.current = null;
      setSelectedId(saved.id);
      setMode(saved.mode);
      setTurns([greeting, ...saved.turns]);
      setReady(null);
      setUnsaved(false);
      reply.reset();
      send.reset();
    } catch (cause) {
      report(cause);
    } finally {
      finish();
    }
  }

  async function retrySave() {
    if (busy.current || !failedTurn.current) return;
    start();
    try {
      await persist(failedTurn.current);
    } catch (cause) {
      report(cause);
    } finally {
      finish();
    }
  }

  return {
    mode,
    selectedId,
    unsaved,
    select,
    retrySave,
    changeMode: (next: ChatMode) => {
      if (busy.current || next === mode) return;
      reset();
      setMode(next);
    },
    turns,
    ready,
    pending,
    sending: send.isPending,
    error,
    ask,
    confirm,
    reset,
    dismiss: () => setReady(null),
  };
}
