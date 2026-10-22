namespace ServiceBusExample;

public static class Subscriber
{
    public static Task RunAsync(TopicMessaging bus, string subscription, CancellationToken cancellationToken)
        => bus.SubscribeAsync(subscription, (message, _) =>
        {
            Console.WriteLine($"Backend B handled: {message.Body}");
            return Task.CompletedTask;
        }, cancellationToken);
}
