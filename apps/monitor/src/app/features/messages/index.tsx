import React from 'react';
import { useTrackingMessages } from '../../hooks/api';
import { AlertCircle } from 'lucide-react';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { MessagesTable } from './components/MessagesTable';
import { ErrorMessage } from './components/ErrorMessage';
import { StatisticsCards } from './components/StatisticsCards';
import { TrackingMessage } from '@e2e-monitor/entities';
import { Button } from '../../components/ui/button';
import { MessageCircle } from 'lucide-react';

const MessagingChatSheet = React.lazy(
  () => import('../messaging-chat/components/MessagingChatSheet'),
);

export const MessagesPage = () => {
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
            Follow messages reported by publishers and subscribers.
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
        </div>
      </div>
      {chatLoaded && (
        <React.Suspense fallback={<p role="status">Loading assistant…</p>}>
          <MessagingChatSheet
            open={chatOpen}
            onOpenChange={setChatOpen}
            onReturnFocus={() => chatLauncher.current?.focus()}
          />
        </React.Suspense>
      )}
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
          Application reports update automatically. Each observed subscriber has
          its own delivery row; Complete means that subscriber reported
          successful broker settlement. External applications own all broker
          publishing and consumption.
        </p>

        {/* Table */}
        <div className="w-full min-w-0 flex-1 min-h-0">
          <MessagesTable messages={messages as TrackingMessage[]} />
        </div>
      </div>
    </div>
  );
};
