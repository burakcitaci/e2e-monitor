using Azure.Messaging.ServiceBus;
using ServiceBusExample;

if (args.Length == 0 || args[0] is not ("publish" or "subscribe"))
{
    Console.WriteLine("Usage: dotnet run -- publish [message] | subscribe");
    Console.WriteLine("Uses the local Docker emulator by default. Override with SERVICE_BUS_CONNECTION_STRING, SERVICE_BUS_TOPIC, SERVICE_BUS_SUBSCRIPTION.");
    return args.Length == 1 && args[0] is "--help" or "-h" ? 0 : 1;
}

var connectionString = Environment.GetEnvironmentVariable("SERVICE_BUS_CONNECTION_STRING");
if (string.IsNullOrWhiteSpace(connectionString))
{
    // Public emulator-only credentials, matching the repository's .env.example.
    connectionString = "Endpoint=sb://localhost;SharedAccessKeyName=RootManageSharedAccessKey;" +
        "SharedAccessKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;" +
        "UseDevelopmentEmulator=true";
}

var topic = Environment.GetEnvironmentVariable("SERVICE_BUS_TOPIC") ?? "application-events";
var subscription = Environment.GetEnvironmentVariable("SERVICE_BUS_SUBSCRIPTION") ?? "logging-service";
using var shutdown = new CancellationTokenSource();
ConsoleCancelEventHandler onCancel = (_, e) =>
{
    e.Cancel = true;
    shutdown.Cancel();
};
Console.CancelKeyPress += onCancel;

try
{
    await using var client = new ServiceBusClient(connectionString);
    using var http = new HttpClient
    {
        BaseAddress = new Uri((Environment.GetEnvironmentVariable("CAPTURE_API_URL") ?? "http://localhost:3000/api/v1/").TrimEnd('/') + "/")
    };
    var sink = new CaptureSink(http, Environment.GetEnvironmentVariable("CAPTURE_TOKEN") ?? "local-capture-token");
    var service = Environment.GetEnvironmentVariable("CAPTURE_SERVICE")
        ?? (args[0] == "publish" ? "financing-api" : "orders-consumer");
    var bus = new TopicMessaging(client, topic, sink, service);
    if (args[0] == "publish")
    {
        var body = args.Length > 1
            ? string.Join(" ", args.Skip(1))
            : "{\"type\":\"financing.example\",\"message\":\"Hello from Backend A\"}";
        await Publisher.RunAsync(bus, body, shutdown.Token);
    }
    else
    {
        await Subscriber.RunAsync(bus, subscription, shutdown.Token);
    }
    return 0;
}
catch (OperationCanceledException) when (shutdown.IsCancellationRequested)
{
    return 0;
}
catch (Exception error)
{
    Console.Error.WriteLine($"{error.GetType().Name}: {error.Message}");
    return 1;
}
finally
{
    Console.CancelKeyPress -= onCancel;
}
