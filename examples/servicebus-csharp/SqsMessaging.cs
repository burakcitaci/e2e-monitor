using Amazon.SQS;
using Amazon.SQS.Model;

namespace ServiceBusExample;

// Resolves an existing queue; resource creation belongs to the monitor's Resources page.
public sealed class SqsMessaging(IAmazonSQS client, string queueUrl, string queueName,
    string queueNamespace, CaptureSink capture, string service) : IMessageTransport
{
    public string Namespace => queueNamespace;
    public string QueueName => queueName;
    public static async Task<SqsMessaging> ConnectAsync(IAmazonSQS client, string? queue, string? url,
        CaptureSink capture, string service, CancellationToken cancellationToken)
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
        return new(client, queueUrl, arn[(lastColon + 1)..], arn[..lastColon], capture, service);
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
        Console.WriteLine($"Listening on SQS {queueName}. Namespace: {queueNamespace}. Press Ctrl+C to stop.");
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
                var captureId = message.MessageAttributes?.GetValueOrDefault(TopicMessaging.CaptureIdProperty)?.StringValue;
                var canReport = Guid.TryParse(captureId, out _);
                Console.WriteLine($"[received] provider=aws queue={queueName} messageId={message.MessageId} captureId={captureId ?? "(external message)"} delivery={message.Attributes?.GetValueOrDefault("ApproximateReceiveCount")}");
                if (canReport) await capture.ReportAsync(NewEvent("received", captureId!, message.MessageId, receivedAt));
                else Console.Error.WriteLine("[capture warning] No UUID capture ID; handling without a capture report.");
                try
                {
                    await handler(message.Body, cancellationToken);
                    await client.DeleteMessageAsync(queueUrl, message.ReceiptHandle, cancellationToken);
                    Console.WriteLine($"[completed] messageId={message.MessageId}");
                    if (canReport) await capture.ReportAsync(NewEvent("completed", captureId!, message.MessageId, DateTimeOffset.UtcNow));
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

    private CaptureEvent NewEvent(string type, string captureId, string messageId, DateTimeOffset occurredAt, string? body = null)
        => new(1, Guid.NewGuid().ToString(), captureId, messageId, queueNamespace, queueName,
            type, service, occurredAt, type == "sent" ? null : queueName, body, "aws", "queue");
}
