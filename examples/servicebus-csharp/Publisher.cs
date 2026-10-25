namespace ServiceBusExample;

public static class Publisher
{
    public static Task<string> RunAsync(IMessageTransport bus, string body, CancellationToken cancellationToken)
        => bus.SendAsync(body, cancellationToken);
}
