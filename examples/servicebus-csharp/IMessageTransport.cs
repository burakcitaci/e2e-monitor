namespace ServiceBusExample;

public interface IMessageTransport
{
    Task<string> SendAsync(string body, CancellationToken cancellationToken);
    Task SubscribeAsync(string subscription, Func<string, CancellationToken, Task> handler,
        CancellationToken cancellationToken, int maxMessages = 0);
}
