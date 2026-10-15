import React, { useState } from 'react';
import { Send, Shuffle } from 'lucide-react';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '../../../components/ui/sheet';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import { Button } from '../../../components/ui/button';
import {
  useSendServiceBusMessage,
  useServiceBusConfig,
} from '../api/service-bus';
import {
  uniqueNamesGenerator,
  Config,
  adjectives,
  names,
} from 'unique-names-generator';

const config: Config = {
  dictionaries: [adjectives, names],
  separator: '-',
  length: 2,
  style: 'lowerCase',
};

interface SendMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SendMessageSheet: React.FC<SendMessageModalProps> = ({
  open,
  onOpenChange,
}) => {
  const [queue, setQueue] = useState('__default__');
  const [body, setBody] = useState('');
  const [sentBy, setSentBy] = useState('');
  const [messageDisposition, setMessageDisposition] = useState<
    'complete' | 'abandon' | 'deadletter' | 'defer'
  >('complete');

  const sendServiceBusMutation = useSendServiceBusMessage();
  const { data: serviceBusConfig, isLoading, error } = useServiceBusConfig();
  const entities =
    serviceBusConfig?.UserConfig.Namespaces.flatMap((namespace) => [
      ...(namespace.Queues ?? []).map(({ Name }) => ({
        type: 'queue',
        name: Name,
      })),
      ...(namespace.Topics ?? []).map(({ Name }) => ({
        type: 'topic',
        name: Name,
      })),
    ]) ?? [];

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!body.trim()) {
      toast.error('Body is required');
      return;
    }

    try {
      const messagePayload = {
        queue: queue === '__default__' ? undefined : queue.trim() || undefined,
        body: body.trim(),
        sentBy: sentBy.trim() || undefined,
        messageDisposition: messageDisposition,
      };

      await sendServiceBusMutation.mutateAsync(messagePayload);

      toast.success('Message simulated successfully', {
        description: 'The message has been enqueued to Azure Service Bus.',
      });

      // Reset form
      setQueue('__default__');
      setBody('');
      setSentBy('');
      setMessageDisposition('complete');
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to simulate message', {
        description:
          error instanceof Error ? error.message : 'Please try again.',
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader className="flex-shrink-0">
          <SheetTitle>Simulate Message</SheetTitle>
          <SheetDescription>
            Simulate sending a message to Azure Service Bus. The message will be
            tracked.
          </SheetDescription>
        </SheetHeader>
        <form
          onSubmit={handleSendMessage}
          className="flex flex-col flex-1 min-h-0"
        >
          <div className="grid gap-6 py-6 flex-1 min-h-0 pr-2">
            {/* Queue */}
            <div className="grid gap-2">
              <Label htmlFor="queue">Queue / Topic (optional)</Label>
              <Select value={queue} onValueChange={setQueue}>
                <SelectTrigger id="queue">
                  <SelectValue placeholder="Select a queue or topic or leave empty for default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">Default Queue</SelectItem>
                  {entities.map((item) => (
                    <SelectItem
                      key={`${item.type}-${item.name}`}
                      value={item.name}
                    >
                      {item.name} ({item.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isLoading && (
                <p className="text-xs text-muted-foreground">
                  Loading queues and topics...
                </p>
              )}
              {error && (
                <p role="alert" className="text-xs text-destructive">
                  Could not load queues and topics. You can still use the
                  default queue.
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="body">
                  Message Body <span className="text-destructive">*</span>
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setBody(
                      JSON.stringify(
                        { key: uniqueNamesGenerator(config) },
                        null,
                        2,
                      ),
                    )
                  }
                  className="h-7 text-xs"
                >
                  <Shuffle className="mr-1 h-3 w-3" />
                  Random JSON
                </Button>
              </div>
              <textarea
                id="body"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder='{"key": "value"} or plain text'
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="sentBy">Sent By (optional)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSentBy(uniqueNamesGenerator(config))}
                  className="h-7 text-xs"
                >
                  <Shuffle className="mr-1 h-3 w-3" />
                  Random Sender
                </Button>
              </div>
              <Input
                id="sentBy"
                placeholder="service-bus-api"
                value={sentBy}
                onChange={(e) => setSentBy(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="disposition">Message Disposition</Label>
              <Select
                value={messageDisposition}
                onValueChange={(
                  value: 'complete' | 'abandon' | 'deadletter' | 'defer',
                ) => setMessageDisposition(value)}
              >
                <SelectTrigger id="disposition">
                  <SelectValue placeholder="Select message disposition" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="complete">Complete</SelectItem>
                  <SelectItem value="abandon">Abandon</SelectItem>
                  <SelectItem value="deadletter">Dead Letter</SelectItem>
                  <SelectItem value="defer">Defer</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {messageDisposition === 'complete' &&
                  'Message will be completed and removed from the queue.'}
                {messageDisposition === 'abandon' &&
                  'Message will be abandoned and returned to the queue for reprocessing.'}
                {messageDisposition === 'deadletter' &&
                  'Message will be moved to the dead-letter queue.'}
                {messageDisposition === 'defer' &&
                  'Message will be deferred and can be received later using sequence number.'}
              </p>
            </div>
          </div>
          <SheetFooter className="mt-4 flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={sendServiceBusMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              variant="default"
              disabled={sendServiceBusMutation.isPending}
            >
              {sendServiceBusMutation.isPending ? (
                'Simulating...'
              ) : (
                <>
                  <Send />
                  Simulate Message
                </>
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
};
