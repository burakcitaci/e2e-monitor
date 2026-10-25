using Amazon.SQS;
using Amazon.SQS.Model;
using System.Text.Json;

namespace ServiceBusExample;

// Resolves an existing queue; resource creation belongs to the monitor's Resources page.
public sealed class SqsMessaging(IAmazonSQS client, string queueUrl, string queueName,
    string queueNamespace, CaptureSink capture, string service, string? topicArn = null) : IMessageTransport
{
    public string Namespace => topicArn is null ? queueNamespace : topicArn[..topicArn.LastIndexOf(':')];
    public string QueueName => queueName;
    public string QueueArn => $"{queueNamespace}:{queueName}";
    public string QueueUrl => queueUrl;
    private string Destination => topicArn is null ? queueName : topicArn[(topicArn.LastIndexOf(':') + 1)..];
    public static async Task<SqsMessaging> ConnectAsync(IAmazonSQS client, string? queue, string? url,
        CaptureSink capture, string service, CancellationToken cancellationToken, string? topicArn = null)
    {
        var queueUrl = url ?? (await client.GetQueueUrlAsync(new GetQueueUrlRequest
        {
            QueueName = queue
        }, cancellationToken)).QueueUrl;
        var attributes = await client.GetQueueAttributesAsync(new GetQueueAttributesRequest
        {
            QueueUrl = queueUrl,
            AttributeNames = ["QueueArn"]
        }, cancellationToken);
        var arn = attributes.Attributes["QueueArn"];
        var lastColon = arn.LastIndexOf(':');
        return new(client, queueUrl, arn[(lastColon + 1)..], arn[..lastColon], capture, service, topicArn);
    }

    public async Task<string> SendAsync(string body, CancellationToken cancellationToken)
    {
        var captureId = Guid.NewGuid().ToString();
        var request = new SendMessageRequest
        {
            QueueUrl = queueUrl,
            MessageBody = body,
            MessageAttributes = new() { [TopicMessaging.CaptureIdProperty] = new() { DataType = "String", StringValue = captureId } }
        };
        if (queueName.EndsWith(".fifo", StringComparison.Ordinal))
        {
            request.MessageGroupId = service;
            request.MessageDeduplicationId = captureId;
        }
        var sentAt = DateTimeOffset.UtcNow;
        var result = await client.SendMessageAsync(request, cancellationToken);
        Console.WriteLine($"[sent] provider=aws queue={queueName} messageId={result.MessageId} captureId={captureId}");
        await capture.ReportAsync(NewEvent("sent", captureId, result.MessageId, sentAt, body));
        return captureId;
    }

    public async Task SubscribeAsync(string subscription, Func<string, CancellationToken, Task> handler,
        CancellationToken cancellationToken, int maxMessages = 0)
    {
        Console.WriteLine($"Listening on {(topicArn is null ? $"SQS {queueName}" : $"SNS {Destination} through SQS {queueName}")}. Namespace: {Namespace}. Press Ctrl+C to stop.");
        var completed = 0;
        while (!cancellationToken.IsCancellationRequested && (maxMessages == 0 || completed < maxMessages))
        {
            var response = await client.ReceiveMessageAsync(new ReceiveMessageRequest
            {
                QueueUrl = queueUrl,
                WaitTimeSeconds = 20,
                MaxNumberOfMessages = 1,
                MessageAttributeNames = [TopicMessaging.CaptureIdProperty],
                MessageSystemAttributeNames = ["ApproximateReceiveCount"]
            }, cancellationToken);
            foreach (var message in response.Messages ?? [])
            {
                var receivedAt = DateTimeOffset.UtcNow;
                var delivery = ReadDelivery(message);
                var captureId = delivery.CaptureId;
                var canReport = Guid.TryParse(captureId, out _);
                Console.WriteLine($"[received] provider=aws queue={queueName} messageId={delivery.MessageId} captureId={captureId ?? "(external message)"} delivery={message.Attributes?.GetValueOrDefault("ApproximateReceiveCount")}");
                if (canReport) await capture.ReportAsync(NewEvent("received", captureId!, delivery.MessageId, receivedAt));
                else Console.Error.WriteLine("[capture warning] No UUID capture ID; handling without a capture report.");
                try
                {
                    await handler(delivery.Body, cancellationToken);
                    await client.DeleteMessageAsync(queueUrl, message.ReceiptHandle, cancellationToken);
                    Console.WriteLine($"[completed] messageId={delivery.MessageId}");
                    if (canReport) await capture.ReportAsync(NewEvent("completed", captureId!, delivery.MessageId, DateTimeOffset.UtcNow));
                    completed++;
                }
                catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
                catch (Exception error)
                {
                    // Leave the message undeleted: SQS makes it available after its visibility timeout.
                    Console.Error.WriteLine($"[subscriber error] {error.Message}; message was not deleted.");
                }
            }
        }
    }

    private (string MessageId, string Body, string? CaptureId) ReadDelivery(Message message)
    {
        if (topicArn is null) return (message.MessageId, message.Body, message.MessageAttributes?.GetValueOrDefault(TopicMessaging.CaptureIdProperty)?.StringValue);
        JsonDocument document;
        try { document = JsonDocument.Parse(message.Body); }
        catch (JsonException error) { throw new InvalidOperationException("The queue contains a non-SNS message. It was not deleted. Use a dedicated queue for this topic.", error); }
        using var envelopeDocument = document;
        var envelope = document.RootElement;
        if (envelope.ValueKind != JsonValueKind.Object || !envelope.TryGetProperty("Type", out var type) || type.GetString() != "Notification" ||
            !envelope.TryGetProperty("TopicArn", out var source) || source.GetString() != topicArn)
            throw new InvalidOperationException("The queue contains a message outside this SNS subscription. It was not deleted. Use a dedicated queue for this topic.");
        var captureId = envelope.TryGetProperty("MessageAttributes", out var attributes) &&
            attributes.TryGetProperty(TopicMessaging.CaptureIdProperty, out var attribute) && attribute.TryGetProperty("Value", out var value)
                ? value.GetString() : null;
        // SNS and SQS assign different IDs. Correlate with the original SNS ID;
        // the native SQS receipt handle is used only for deletion after handling.
        return (envelope.GetProperty("MessageId").GetString()!, envelope.GetProperty("Message").GetString()!, captureId);
    }

    private CaptureEvent NewEvent(string type, string captureId, string messageId, DateTimeOffset occurredAt, string? body = null)
        => new(1, Guid.NewGuid().ToString(), captureId, messageId, Namespace, Destination,
            type, service, occurredAt, type == "sent" ? null : queueName, body, "aws", topicArn is null ? "queue" : "topic");
}
