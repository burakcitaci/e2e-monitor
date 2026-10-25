namespace ServiceBusExample;

public static class Subscriber
{
    public static Task RunAsync(IMessageTransport bus, string subscription, CancellationToken cancellationToken, int maxMessages = 0)
        => bus.SubscribeAsync(subscription, (message, _) =>
        {
            Console.WriteLine($"Backend B handled: {message}");
            return Task.CompletedTask;
        }, cancellationToken, maxMessages);
}
