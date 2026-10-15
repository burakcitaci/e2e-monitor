import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TrackingMessage } from '@e2e-monitor/entities';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../../../components/ui/dropdown-menu';
import { apiClient } from '../../../lib/api-client';
import { trackingMessageKeys } from '../../../hooks/api/tracking-messages';

const actions = [
  ['complete', 'Complete (receive)'],
  ['abandon', 'Abandon'],
  ['defer', 'Defer'],
  ['deadletter', 'Dead-letter (DLQ)'],
] as const;

export function MessageActions({
  message,
}: {
  message: {
    _id?: string;
    status?: string;
    pendingDeliveries?: TrackingMessage['pendingDeliveries'];
  };
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({
      token,
      disposition,
    }: {
      token: string;
      disposition: (typeof actions)[number][0];
    }) => {
      if (!message._id) throw new Error('Tracking identifier is missing');
      return apiClient.settleMessage(message._id, token, disposition);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trackingMessageKeys.all });
      queryClient.invalidateQueries({ queryKey: ['service-bus', 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['aws-sqs', 'messages'] });
      toast.success('Broker action completed');
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: trackingMessageKeys.all });
      toast.error('Could not process message', { description: error.message });
    },
  });
  const pending = message._id ? (message.pendingDeliveries ?? []) : [];
  if (!pending.length)
    return (
      <span className="text-xs text-muted-foreground" title={message.status === 'received' ? 'This delivery was already processed. Send a new message to use manual actions.' : 'Actions appear when the broker delivers this message.'}>
        {message.status === 'received' ? 'History' : 'Waiting for broker'}
      </span>
    );
  return (
    <div className="space-y-1">
      {pending.map((delivery) => (
        <div key={delivery.token}>
          <p
            className="text-xs max-w-48 truncate"
            title={`${delivery.queue} — available until ${new Date(delivery.expiresAt).toLocaleTimeString()}`}
          >
            {delivery.queue}
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={mutation.isPending}>
                Receive / settle
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {actions.map(([disposition, label]) => (
                <DropdownMenuItem
                  key={disposition}
                  onSelect={() =>
                    mutation.mutate({ token: delivery.token, disposition })
                  }
                >
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}
    </div>
  );
}
