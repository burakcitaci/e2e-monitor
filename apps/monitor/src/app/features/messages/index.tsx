import React from 'react';
import { useTrackingMessages } from '../../hooks/api';
import { AlertCircle } from 'lucide-react';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { MessagesTable } from './components/MessagesTable';
import { ErrorMessage } from './components/ErrorMessage';
import { StatisticsCards } from './components/StatisticsCards';
import { TrackingMessage } from '@e2e-monitor/entities';
import { Button } from '../../components/ui/button';
import { SendMessageDialog } from './components/SendMessageDialog';
import { MessageCircle, Send } from 'lucide-react';

const MessagingChatPopup = React.lazy(
  () => import('../messaging-chat/components/MessagingChatPopup'),
);

export const MessagesPage = () => {
  const [sendOpen, setSendOpen] = React.useState(false);
  const [chatOpen, setChatOpen] = React.useState(false);
  const [chatLoaded, setChatLoaded] = React.useState(false);
  const chatLauncher = React.useRef<HTMLButtonElement>(null);
  const { data: messages = [], isLoading, error } = useTrackingMessages();

  // Calculate statistics by disposition and emulator
  const stats = React.useMemo(() => {
    const total = messages.length;

    // Emulator statistics
    const sqs = messages.filter((m) => m.emulatorType === 'sqs').length;
    const azureServiceBus = messages.filter(
      (m) => m.emulatorType === 'azure-service-bus',
    ).length;
    return { total, sqs, azureServiceBus };
  }, [messages]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="p-6 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Tracking Messages</h1>
          <h2 className="text-sm text-muted-foreground">
            Send messages and choose how pending broker deliveries are
            processed.
          </h2>
        </div>
        <div className="flex gap-2">
          <Button
            ref={chatLauncher}
            variant="outline"
            onClick={() => {
              setChatLoaded(true);
              setChatOpen(true);
            }}
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            Messaging Chat
          </Button>
          <Button onClick={() => setSendOpen(true)}>
            <Send className="mr-2 h-4 w-4" />
            Send message
          </Button>
        </div>
      </div>
      {chatLoaded && (
        <React.Suspense fallback={<p role="status">Loading assistant…</p>}>
          <MessagingChatPopup
            open={chatOpen}
            onOpenChange={setChatOpen}
            onReturnFocus={() => chatLauncher.current?.focus()}
          />
        </React.Suspense>
      )}
      {sendOpen && <SendMessageDialog onClose={() => setSendOpen(false)} />}
      <div className="flex flex-col gap-4 w-full flex-1 min-h-0 min-w-0">
        {/* Error Messages */}
        {error && (
          <ErrorMessage
            icon={
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            }
            title="Failed to Load Tracking Messages"
            message={
              (error as Error)?.message?.includes('Failed to fetch')
                ? 'Backend server is not running on port 3000. Please ensure it is running.'
                : (error as Error)?.message ||
                  'Failed to load tracking messages'
            }
          />
        )}

        {/* Statistics Cards */}
        <StatisticsCards stats={stats} />

        <p className="text-sm text-muted-foreground">
          New deliveries have a Receive / settle menu in the Actions column:
          Complete, Abandon, Defer, or Dead-letter. History rows were already
          processed; send a new message to try manual processing.
        </p>

        {/* Table */}
        <div className="w-full min-w-0 flex-1 min-h-0">
          <MessagesTable messages={messages as TrackingMessage[]} />
        </div>
      </div>
    </div>
  );
};
