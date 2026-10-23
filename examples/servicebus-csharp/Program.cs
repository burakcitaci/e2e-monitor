using Azure.Messaging.ServiceBus;
using ServiceBusExample;

if (args.Length == 0 || args[0] is "--help" or "-h")
{
    PrintUsage();
    return args.Length == 1 ? 0 : 1;
}

var command = args[0];
if (command is not ("publish" or "subscribe"))
{
    PrintUsage();
    return 1;
}

CommandLine options;
try
{
    options = CommandLine.Parse(args.Skip(1));
}
catch (ArgumentException error)
{
    Console.Error.WriteLine(error.Message);
    PrintUsage();
    return 1;
}

var connectionString = Environment.GetEnvironmentVariable("SERVICE_BUS_CONNECTION_STRING");
if (string.IsNullOrWhiteSpace(connectionString))
{
    // Public emulator-only credentials, for the local Docker Service Bus emulator.
    connectionString = "Endpoint=sb://localhost;SharedAccessKeyName=RootManageSharedAccessKey;" +
        "SharedAccessKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;" +
        "UseDevelopmentEmulator=true";
}

var topic = options.Value("topic", "SERVICE_BUS_TOPIC", "application-events");
var subscription = options.Value("subscription", "SERVICE_BUS_SUBSCRIPTION", "logging-service");
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
        BaseAddress = new Uri(options.Value("capture-api", "CAPTURE_API_URL", "http://localhost:3000/api/v1/").TrimEnd('/') + "/")
    };
    var sink = new CaptureSink(http, options.Value("capture-token", "CAPTURE_TOKEN", "local-capture-token"));
    var service = command == "publish"
        ? options.Value("sender", "CAPTURE_SERVICE", "financing-api")
        : options.Value("receiver", "CAPTURE_SERVICE", "orders-consumer");
    var bus = new TopicMessaging(client, topic, sink, service);
    Console.WriteLine($"Configuration: namespace={client.FullyQualifiedNamespace} topic={topic} service={service}" +
        (command == "subscribe" ? $" subscription={subscription}" : string.Empty));
    if (command == "publish")
    {
        var body = options.Optional("body")
            ?? (options.Positionals.Count > 0
                ? string.Join(" ", options.Positionals)
                : "{\"type\":\"financing.example\",\"message\":\"Hello from Backend A\"}");
        var count = options.PositiveInt("count", 1);
        var intervalMs = options.NonNegativeInt("interval-ms", 0);
        for (var index = 0; index < count; index++)
        {
            await Publisher.RunAsync(bus, body, shutdown.Token);
            if (index + 1 < count && intervalMs > 0)
                await Task.Delay(intervalMs, shutdown.Token);
        }
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

static void PrintUsage()
{
    Console.WriteLine("Policy-test publisher:");
    Console.WriteLine("  dotnet run --project examples/servicebus-csharp -- publish [message] [--topic NAME] [--sender SERVICE] [--count N] [--interval-ms N]");
    Console.WriteLine("Policy-test subscriber:");
    Console.WriteLine("  dotnet run --project examples/servicebus-csharp -- subscribe [--topic NAME] [--subscription NAME] [--receiver SERVICE]");
    Console.WriteLine("Common options: --capture-api URL --capture-token TOKEN");
    Console.WriteLine("Publish also accepts --body TEXT. Environment-variable fallbacks remain supported.");
}

sealed class CommandLine
{
    private static readonly HashSet<string> Known =
    [
        "topic", "subscription", "sender", "receiver", "body", "count",
        "interval-ms", "capture-api", "capture-token"
    ];
    private readonly Dictionary<string, string> values = new(StringComparer.OrdinalIgnoreCase);
    public List<string> Positionals { get; } = [];

    public static CommandLine Parse(IEnumerable<string> arguments)
    {
        var result = new CommandLine();
        using var iterator = arguments.GetEnumerator();
        while (iterator.MoveNext())
        {
            var argument = iterator.Current;
            if (!argument.StartsWith("--", StringComparison.Ordinal))
            {
                result.Positionals.Add(argument);
                continue;
            }
            var option = argument[2..];
            var separator = option.IndexOf('=');
            var name = separator >= 0 ? option[..separator] : option;
            if (!Known.Contains(name)) throw new ArgumentException($"Unknown option --{name}.");
            string value;
            if (separator >= 0)
                value = option[(separator + 1)..];
            else
            {
                if (!iterator.MoveNext() || iterator.Current.StartsWith("--", StringComparison.Ordinal))
                    throw new ArgumentException($"Option --{name} requires a value.");
                value = iterator.Current;
            }
            if (string.IsNullOrWhiteSpace(value)) throw new ArgumentException($"Option --{name} cannot be empty.");
            result.values[name] = value;
        }
        return result;
    }

    public string? Optional(string name) => values.GetValueOrDefault(name);
    public string Value(string name, string environmentName, string fallback) =>
        Optional(name) ?? Environment.GetEnvironmentVariable(environmentName) ?? fallback;
    public int PositiveInt(string name, int fallback) => ParseInt(name, fallback, 1);
    public int NonNegativeInt(string name, int fallback) => ParseInt(name, fallback, 0);
    private int ParseInt(string name, int fallback, int minimum) =>
        Optional(name) is not { } raw
            ? fallback
            : int.TryParse(raw, out var value) && value >= minimum
                ? value
                : throw new ArgumentException($"Option --{name} must be an integer greater than or equal to {minimum}.");
}
