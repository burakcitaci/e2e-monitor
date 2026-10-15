import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../../components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../../../components/ui/select';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';
import { Input } from '../../../components/ui/input';
import { apiClient } from '../../../lib/api-client';
import {
  useServiceBusConfig,
  serviceBusKeys,
} from '../../azure-sb/api/service-bus';
import { useAwsSqsConfig, awsSqsKeys } from '../../aws-sqs/hooks/aws-sqs';
import { useGetMessageResources } from '../../messaging-resources/api/messaging-resource';
import { trackingMessageKeys } from '../../../hooks/api/tracking-messages';

type Provider = 'azure' | 'aws';
type DestinationType = 'queue' | 'topic';

export function SendMessageDialog({ onClose }: { onClose: () => void }) {
  const [provider, setProvider] = useState<Provider>('azure');
  const [destinationType, setDestinationType] =
    useState<DestinationType>('queue');
  const [destination, setDestination] = useState('__default__');
  const [body, setBody] = useState('');
  const [sentBy, setSentBy] = useState('');
  const azure = useServiceBusConfig();
  const aws = useAwsSqsConfig();
  const resources = useGetMessageResources();
  const queryClient = useQueryClient();
  const configuration = provider === 'azure' ? azure : aws;
  const destinations =
    provider === 'azure'
      ? (azure.data?.UserConfig.Namespaces.flatMap(
          (namespace) =>
            (destinationType === 'queue'
              ? namespace.Queues
              : namespace.Topics
            )?.map((entity) => entity.Name) ?? [],
        ) ?? [])
      : (resources.data
          ?.filter(
            (resource) =>
              resource.provider === 'aws' &&
              resource.type === 'queue' &&
              resource.status === 'active',
          )
          .map((resource) => resource.name) ?? []);
  const names = Array.from(new Set(destinations));
  const mutation = useMutation({
    mutationFn: async () => {
      const payload = { body, sentBy: sentBy.trim() || undefined };
      const name = destination === '__default__' ? undefined : destination;
      const fifo = (name ?? aws.data?.queueName)?.endsWith('.fifo');
      return provider === 'azure'
        ? apiClient.sendMessage({ ...payload, queue: name })
        : apiClient.sendSqsMessage({
            ...payload,
            queueName: name,
            ...(fifo
              ? {
                  messageGroupId: 'dashboard',
                  messageDeduplicationId: crypto.randomUUID(),
                }
              : {}),
          });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trackingMessageKeys.all });
      queryClient.invalidateQueries({
        queryKey:
          provider === 'azure'
            ? serviceBusKeys.messages()
            : awsSqsKeys.messages(),
      });
      toast.success('Message sent', {
        description:
          'Choose its processing action in the message table when the broker delivers it.',
      });
      onClose();
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!body.trim() || !destination || mutation.isPending) return;
    mutation.mutate();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send message</DialogTitle>
          <DialogDescription>
            Choose a provider and destination, then compose your message.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <fieldset disabled={mutation.isPending} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="send-provider">Provider</Label>
                <Select
                  value={provider}
                  onValueChange={(value: Provider) => {
                    setProvider(value);
                    setDestinationType('queue');
                    setDestination('__default__');
                    mutation.reset();
                  }}
                >
                  <SelectTrigger id="send-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="azure">Azure Service Bus</SelectItem>
                    <SelectItem value="aws">AWS SQS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="send-destination-type">Destination type</Label>
                <Select
                  value={destinationType}
                  onValueChange={(value: DestinationType) => {
                    setDestinationType(value);
                    setDestination(value === 'queue' ? '__default__' : '');
                    mutation.reset();
                  }}
                >
                  <SelectTrigger id="send-destination-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="queue">Queue</SelectItem>
                    {provider === 'azure' && (
                      <SelectItem value="topic">Topic</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="send-destination">Destination</Label>
              <Select value={destination} onValueChange={setDestination}>
                <SelectTrigger id="send-destination">
                  <SelectValue placeholder="Select a destination" />
                </SelectTrigger>
                <SelectContent>
                  {destinationType === 'queue' && (
                    <SelectItem value="__default__">
                      Default queue
                      {provider === 'aws' && aws.data
                        ? ` (${aws.data.queueName})`
                        : ''}
                    </SelectItem>
                  )}
                  {names.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {configuration.isLoading && (
                <p role="status" className="text-xs text-muted-foreground">
                  Loading destinations...
                </p>
              )}
              {configuration.error && (
                <p role="alert" className="text-xs text-destructive">
                  Could not load provider configuration. The default queue is
                  still available.
                </p>
              )}
              {provider === 'aws' && (
                <p className="text-xs text-muted-foreground">
                  SQS supports queues. Additional destinations come from your
                  active saved AWS resources.
                </p>
              )}
              {provider === 'aws' && resources.error && (
                <p role="alert" className="text-xs text-destructive">
                  Saved queues could not be loaded. You can still send to the
                  default queue.
                </p>
              )}
              {destinationType === 'topic' &&
                !configuration.isLoading &&
                names.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No topics are configured.
                  </p>
                )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="send-body">Message body</Label>
              <textarea
                id="send-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                required
                rows={7}
                placeholder={'{"message": "Hello"}'}
                className="w-full rounded-md border border-input bg-background p-3 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-xs text-muted-foreground">
                JSON or plain text.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="send-sender">Sent by (optional)</Label>
              <Input
                id="send-sender"
                value={sentBy}
                onChange={(event) => setSentBy(event.target.value)}
                placeholder="dashboard"
              />
            </div>
          </fieldset>
          {mutation.error && (
            <p role="alert" className="text-sm text-destructive">
              {mutation.error.message}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || !body.trim() || !destination}
            >
              <Send className="mr-2 h-4 w-4" />
              {mutation.isPending ? 'Sending...' : 'Send message'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
