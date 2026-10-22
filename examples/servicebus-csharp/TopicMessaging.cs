using Azure.Messaging.ServiceBus;

namespace ServiceBusExample;

// A small wrapper around an existing client; the caller owns the client's lifetime.
public sealed class TopicMessaging(ServiceBusClient client, string topic, CaptureSink capture, string service)
{
    public const string CaptureIdProperty = "financingCaptureId";

    public async Task<string> SendAsync(string body, CancellationToken cancellationToken)
    {
        var captureId = Guid.NewGuid().ToString();
        var message = new ServiceBusMessage(body)
        {
            MessageId = Guid.NewGuid().ToString(),
            CorrelationId = captureId
        };
        message.ApplicationProperties[CaptureIdProperty] = captureId;

        await using var sender = client.CreateSender(topic);
        await sender.SendMessageAsync(message, cancellationToken);
        Console.WriteLine($"[sent] topic={topic} messageId={message.MessageId} captureId={captureId}");
        await capture.ReportAsync(NewEvent("sent", captureId, message.MessageId, DateTimeOffset.UtcNow, body: body));
        return captureId;
    }

    public async Task SubscribeAsync(
        string subscription,
        Func<ServiceBusReceivedMessage, CancellationToken, Task> handler,
        CancellationToken cancellationToken)
    {
        await using var processor = client.CreateProcessor(topic, subscription, new ServiceBusProcessorOptions
        {
            AutoCompleteMessages = false,
            MaxConcurrentCalls = 1
        });

        processor.ProcessMessageAsync += async args =>
        {
            var message = args.Message;
            var receivedAt = DateTimeOffset.UtcNow;
            var captureId = message.ApplicationProperties.TryGetValue(CaptureIdProperty, out var value)
                ? value?.ToString()
                : message.CorrelationId;
            Console.WriteLine(
                $"[received] topic={topic} subscription={subscription} messageId={message.MessageId} " +
                $"captureId={captureId ?? "(external message; no capture ID)"} delivery={message.DeliveryCount}");

            // Messages sent outside this wrapper may have no UUID capture ID.
            var canReport = Guid.TryParse(captureId, out _);
            if (canReport)
            {
                await capture.ReportAsync(NewEvent("received", captureId!, message.MessageId, receivedAt, subscription));
            }
            else
            {
                Console.Error.WriteLine("[capture warning] No UUID capture ID; handling without a capture report.");
            }

            // Only complete after the application's handler succeeds. The processor
            // abandons a message when the callback throws, allowing broker redelivery.
            await handler(message, args.CancellationToken);
            await args.CompleteMessageAsync(message, args.CancellationToken);
            Console.WriteLine($"[completed] messageId={message.MessageId}");
            if (canReport)
            {
                await capture.ReportAsync(NewEvent("completed", captureId!, message.MessageId, DateTimeOffset.UtcNow, subscription));
            }
        };
        processor.ProcessErrorAsync += args =>
        {
            Console.Error.WriteLine($"[subscriber error] {args.ErrorSource}: {args.Exception.Message}");
            return Task.CompletedTask;
        };

        await processor.StartProcessingAsync(cancellationToken);
        Console.WriteLine($"Listening on {topic}/subscriptions/{subscription}. Press Ctrl+C to stop.");
        try
        {
            await Task.Delay(Timeout.Infinite, cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // Stop without the cancelled token so in-flight callbacks can finish.
        }
        finally
        {
            await processor.StopProcessingAsync(CancellationToken.None);
        }
    }

    private CaptureEvent NewEvent(string type, string captureId, string messageId, DateTimeOffset occurredAt,
        string? subscription = null, string? body = null)
        => new(1, Guid.NewGuid().ToString(), captureId, messageId, client.FullyQualifiedNamespace,
            topic, type, service, occurredAt, subscription, body);
}
