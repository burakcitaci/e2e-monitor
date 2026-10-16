import { Button } from '../../components/ui/button';
import { useChatStatus } from './api/hooks';
import { useConversation } from './hooks/useConversation';
import { ChatComposer } from './components/ChatComposer';
import { ChatTranscript } from './components/ChatTranscript';
import { MessagePreview } from './components/MessagePreview';

export default function MessagingChatPage() {
  const status = useChatStatus();
  const chat = useConversation();
  return (
    <main className="p-6 mx-auto w-full max-w-4xl space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Messaging Chat</h1>
          <p className="text-muted-foreground">
            Describe a message to send to an Azure queue/topic or AWS SQS queue.
          </p>
        </div>
        <Button variant="outline" disabled={chat.pending} onClick={chat.reset}>
          New chat
        </Button>
      </header>
      {status.isLoading && (
        <p role="status">Checking assistant configuration…</p>
      )}
      {status.data && !status.data.configured && (
        <p role="alert" className="rounded-md border p-4">
          Set OPENAI_API_KEY in the backend environment and restart the API to
          enable the assistant. OPENAI_MODEL is optional.
        </p>
      )}
      {(status.error ?? chat.error) && (
        <p role="alert" className="text-destructive">
          {(status.error ?? chat.error)?.message}
        </p>
      )}
      <ChatTranscript turns={chat.turns} pending={chat.pending} />
      {chat.ready && (
        <MessagePreview
          draft={chat.ready.draft}
          pending={chat.pending}
          sending={chat.sending}
          onSend={chat.confirm}
          onDismiss={chat.dismiss}
        />
      )}
      <ChatComposer
        disabled={!status.data?.configured || chat.pending}
        onSubmit={chat.ask}
      />
      <p className="text-xs text-muted-foreground">
        Conversation text and destination names are sent to OpenAI. Review the
        draft before sending it to your emulator.
      </p>
    </main>
  );
}
