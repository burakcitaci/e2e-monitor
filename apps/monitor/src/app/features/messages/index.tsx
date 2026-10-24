import React from 'react';
import { useTrackingMessages } from '../../hooks/api';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { MessagesTable } from './components/MessagesTable';
import { StatisticsCards } from './components/StatisticsCards';
import { TrackingMessage } from '@e2e-monitor/entities';
import { Page, PageHeader, PageState } from '../../components/common/Page';

export const MessagesPage = () => {
  const {
    data: messages = [],
    isLoading,
    error,
    refetch,
  } = useTrackingMessages();

  const stats = React.useMemo(() => {
    const total = messages.length;

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
    <Page>
      <PageHeader
        title="Tracking Messages"
        description="Follow messages reported by publishers and subscribers."
      />
      <div className="flex flex-col gap-4 w-full flex-1 min-h-0 min-w-0">
        {error && (
          <PageState
            title="Failed to Load Tracking Messages"
            description={
              (error as Error)?.message?.includes('Failed to fetch')
                ? 'Backend server is not running on port 3000. Please ensure it is running.'
                : (error as Error)?.message ||
                  'Failed to load tracking messages'
            }
            retry={() => void refetch()}
          />
        )}

        <StatisticsCards stats={stats} />

        <p className="text-sm text-muted-foreground">
          Application reports update automatically. Each observed subscriber has
          its own delivery row; Complete means that subscriber reported
          successful broker settlement. External applications own all broker
          publishing and consumption.
        </p>

        <div className="w-full min-w-0 flex-1 min-h-0">
          <MessagesTable messages={messages as TrackingMessage[]} />
        </div>
      </div>
    </Page>
  );
};
