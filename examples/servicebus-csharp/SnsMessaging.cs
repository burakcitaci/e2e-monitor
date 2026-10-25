using Amazon.SimpleNotificationService;
using Amazon.SimpleNotificationService.Model;
using Amazon.SQS;
using Amazon.SQS.Model;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;

namespace ServiceBusExample;

public sealed class SnsMessaging(IAmazonSimpleNotificationService client, string topicArn,
    SqsMessaging? receiver, CaptureSink capture, string service) : IMessageTransport
{
    public string TopicName => topicArn[(topicArn.LastIndexOf(':') + 1)..];
    public string Namespace => topicArn[..topicArn.LastIndexOf(':')];

    public static async Task<SnsMessaging> ConnectAsync(IAmazonSimpleNotificationService sns, IAmazonSQS sqs,
        string topic, string? queue, string? queueUrl, bool subscribe, CaptureSink capture,
        string service, CancellationToken cancellationToken)
    {
        var arn = topic.StartsWith("arn:", StringComparison.Ordinal) ? topic : null;
        string? next = null;
        while (arn is null)
        {
            var page = await sns.ListTopicsAsync(new ListTopicsRequest { NextToken = next }, cancellationToken);
            arn = page.Topics?.FirstOrDefault(item => item.TopicArn[(item.TopicArn.LastIndexOf(':') + 1)..] == topic)?.TopicArn;
            next = page.NextToken;
            if (arn is null && string.IsNullOrEmpty(next)) throw new ArgumentException($"SNS topic '{topic}' does not exist. Create it in Resources first.");
        }
        await sns.GetTopicAttributesAsync(new GetTopicAttributesRequest { TopicArn = arn }, cancellationToken);
        SqsMessaging? receiver = null;
        if (subscribe)
        {
            receiver = await SqsMessaging.ConnectAsync(sqs, queue, queueUrl, capture, service, cancellationToken, arn);
            await AllowTopicAsync(sqs, receiver, arn, cancellationToken);
            var result = await sns.SubscribeAsync(new SubscribeRequest
            {
                TopicArn = arn, Protocol = "sqs", Endpoint = receiver.QueueArn,
                Attributes = new() { ["RawMessageDelivery"] = "false" }
            }, cancellationToken);
            if (string.IsNullOrEmpty(result.SubscriptionArn) || !result.SubscriptionArn.StartsWith("arn:", StringComparison.Ordinal))
                throw new InvalidOperationException("SNS subscription requires confirmation before receiving. Use a queue in the same account or confirm the subscription first.");
            await sns.SetSubscriptionAttributesAsync(new SetSubscriptionAttributesRequest
            {
                SubscriptionArn = result.SubscriptionArn, AttributeName = "RawMessageDelivery", AttributeValue = "false"
            }, cancellationToken);
            Console.WriteLine($"[subscribed] topic={arn} queue={receiver.QueueName} subscription={result.SubscriptionArn}");
        }
        return new(sns, arn, receiver, capture, service);
    }

    public async Task<string> SendAsync(string body, CancellationToken cancellationToken)
    {
        var captureId = Guid.NewGuid().ToString();
        var request = new PublishRequest
        {
            TopicArn = topicArn, Message = body,
            MessageAttributes = new() { [TopicMessaging.CaptureIdProperty] = new() { DataType = "String", StringValue = captureId } }
        };
        if (TopicName.EndsWith(".fifo", StringComparison.Ordinal))
        {
            request.MessageGroupId = service;
            request.MessageDeduplicationId = captureId;
        }
        var sentAt = DateTimeOffset.UtcNow;
        var result = await client.PublishAsync(request, cancellationToken);
        Console.WriteLine($"[sent] provider=aws topic={TopicName} messageId={result.MessageId} captureId={captureId}");
        await capture.ReportAsync(new(1, Guid.NewGuid().ToString(), captureId, result.MessageId,
            Namespace, TopicName, "sent", service, sentAt, Body: body, Provider: "aws", DestinationType: "topic"));
        return captureId;
    }

    public Task SubscribeAsync(string subscription, Func<string, CancellationToken, Task> handler,
        CancellationToken cancellationToken, int maxMessages = 0)
        => receiver?.SubscribeAsync(subscription, handler, cancellationToken, maxMessages)
            ?? throw new InvalidOperationException("SNS receiving requires --queue NAME or --queue-url URL.");

    private static async Task AllowTopicAsync(IAmazonSQS sqs, SqsMessaging queue, string arn, CancellationToken cancellationToken)
    {
        var attributes = await sqs.GetQueueAttributesAsync(new GetQueueAttributesRequest
        {
            QueueUrl = queue.QueueUrl, AttributeNames = ["Policy"]
        }, cancellationToken);
        var existing = attributes.Attributes?.GetValueOrDefault("Policy");
        var policy = string.IsNullOrWhiteSpace(existing) ? new JsonObject() : JsonNode.Parse(existing) as JsonObject
            ?? throw new InvalidOperationException("The existing queue policy is not a JSON object; it was not changed.");
        policy["Version"] ??= "2012-10-17";
        var statements = policy["Statement"] switch
        {
            JsonArray array => array,
            JsonObject statement => new JsonArray(statement.DeepClone()),
            null => new JsonArray(),
            _ => throw new InvalidOperationException("The existing queue policy has an invalid Statement; it was not changed.")
        };
        if (statements.Parent is null) policy["Statement"] = statements;
        var sid = "E2ECaptureSns" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(arn)))[..24];
        var grant = new JsonObject
        {
            ["Sid"] = sid, ["Effect"] = "Allow",
            ["Principal"] = new JsonObject { ["Service"] = "sns.amazonaws.com" },
            ["Action"] = "sqs:SendMessage", ["Resource"] = queue.QueueArn,
            ["Condition"] = new JsonObject { ["ArnEquals"] = new JsonObject { ["aws:SourceArn"] = arn } }
        };
        var previous = statements.FirstOrDefault(item => item?["Sid"]?.GetValue<string>() == sid);
        if (JsonNode.DeepEquals(previous, grant)) return;
        if (previous is not null) statements[statements.IndexOf(previous)] = grant;
        else statements.Add(grant);
        await sqs.SetQueueAttributesAsync(new SetQueueAttributesRequest
        {
            QueueUrl = queue.QueueUrl, Attributes = new() { ["Policy"] = policy.ToJsonString() }
        }, cancellationToken);
    }
}
