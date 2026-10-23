import { Button } from '../../components/ui/button';
import { useChatStatus } from './api/hooks';
import { useConversation } from './hooks/useConversation';
import { ChatComposer } from './components/ChatComposer';
import { ChatTranscript } from './components/ChatTranscript';
import { MessagePreview } from './components/MessagePreview';
import { ChatHistory } from './components/ChatHistory';
import { PolicyPreview } from './components/PolicyPreview';

export default function MessagingChatPage() {
  const chat = useConversation();
  return <MessagingChatContent chat={chat} />;
}

export function MessagingChatContent({
  chat,
}: {
  chat: ReturnType<typeof useConversation>;
}) {
  const status = useChatStatus();
  return (
    <section className="mx-auto w-full max-w-4xl space-y-5 p-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Messaging Chat</h1>
          <p className="text-muted-foreground">
            Ask messaging questions or prepare message and policy drafts.
          </p>
        </div>
        <Button variant="outline" disabled={chat.pending} onClick={chat.reset}>
          New chat
        </Button>
      </header>
      <ChatHistory
        selectedId={chat.selectedId}
        disabled={chat.pending}
        onSelect={chat.select}
      />
      <div
        role="group"
        aria-label="Assistant mode"
        className="flex flex-wrap gap-2"
      >
        <Button
          variant={chat.mode === 'structured' ? 'default' : 'outline'}
          aria-pressed={chat.mode === 'structured'}
          disabled={chat.pending}
          onClick={() => chat.changeMode('structured')}
        >
          Structured output
        </Button>
        <Button
          variant={chat.mode === 'tools' ? 'default' : 'outline'}
          aria-pressed={chat.mode === 'tools'}
          disabled={chat.pending}
          onClick={() => chat.changeMode('tools')}
        >
          Tool calling
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {chat.mode === 'structured'
          ? 'Returns a message or policy draft in one response.'
          : 'Uses observed route lookup and draft preparation tools before replying.'}{' '}
        Switching modes starts a new chat. Drafts are for review; this platform
        does not publish messages.
      </p>
      {status.isLoading && (
        <p role="status">Checking assistant configuration…</p>
      )}
      {status.data && !status.data.configured && (
        <p role="alert" className="rounded-md border p-4">
          Set GEMINI_API_KEY in the backend environment and restart the API to
          enable the assistant. GEMINI_MODEL is optional.
        </p>
      )}
      {(status.error ?? chat.error) && (
        <p role="alert" className="text-destructive">
          {(status.error ?? chat.error)?.message}
        </p>
      )}
      {chat.unsaved && (
        <div role="alert" className="space-y-2 rounded-md border p-3">
          <p>
            This entry is not saved yet. Retry saving, or select the chat from
            history to reload. Retrying only saves conversation history.
          </p>
          <Button
            variant="outline"
            disabled={chat.pending}
            onClick={chat.retrySave}
          >
            Retry saving
          </Button>
        </div>
      )}
      <ChatTranscript turns={chat.turns} pending={chat.pending} />
      {chat.ready?.draft && (
        <MessagePreview
          draft={chat.ready.draft}
          pending={chat.pending || chat.unsaved}
          onDismiss={chat.dismiss}
        />
      )}
      {chat.ready?.policyDraft && (
        <PolicyPreview
          draft={chat.ready.policyDraft}
          pending={chat.pending || chat.unsaved}
          onDismiss={chat.dismiss}
        />
      )}
      <ChatComposer
        key={`${chat.selectedId ?? 'new'}-${chat.mode}`}
        disabled={!status.data?.configured || chat.pending || chat.unsaved}
        onSubmit={chat.ask}
      />
      <p className="text-xs text-muted-foreground">
        Conversation text and destination names are sent to Google Gemini. Chats
        are saved in your local MongoDB. External applications own broker
        operations.
      </p>
    </section>
  );
}
