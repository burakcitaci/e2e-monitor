using Azure.Messaging.ServiceBus;
using Amazon;
using Amazon.Runtime;
using Amazon.SQS;
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
string provider;
try
{
    options = CommandLine.Parse(args.Skip(1));
    provider = options.Value("provider", "MESSAGING_PROVIDER", "azure").ToLowerInvariant();
    if (provider is not ("azure" or "aws")) throw new ArgumentException("--provider must be azure or aws.");
    if (options.Optional("queue") is not null && (options.Optional("topic") is not null || options.Optional("queue-url") is not null))
        throw new ArgumentException("Use one destination: --queue, --queue-url, or --topic.");
    if (provider == "aws" && (options.Optional("topic") is not null || options.Optional("subscription") is not null))
        throw new ArgumentException("AWS uses SQS queues. Use --queue or --queue-url, not --topic/--subscription.");
    if (provider == "azure" && options.Optional("queue-url") is not null) throw new ArgumentException("--queue-url is an AWS option; use --queue for Azure.");
    if (options.Optional("queue") is not null && options.Optional("subscription") is not null) throw new ArgumentException("Queues do not use --subscription.");
    if (command == "subscribe" && options.Positionals.Count > 0) throw new ArgumentException("Subscribe does not accept a message body.");
    if (provider == "azure" && (options.Optional("endpoint") is not null || options.Optional("region") is not null)) throw new ArgumentException("--endpoint and --region are AWS options. Azure uses SERVICE_BUS_CONNECTION_STRING.");
    if (command == "publish" && options.Optional("max-messages") is not null) throw new ArgumentException("--max-messages is for subscribe. Use --count for publish.");
    if (command == "subscribe" && (options.Optional("body") is not null || options.Optional("count") is not null || options.Optional("interval-ms") is not null)) throw new ArgumentException("--body, --count and --interval-ms are publish options.");
    _ = options.PositiveInt("count", 1);
    _ = options.NonNegativeInt("interval-ms", 0);
    if (options.Optional("max-messages") is not null) _ = options.PositiveInt("max-messages", 1);
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

var queueEnvironment = Environment.GetEnvironmentVariable("SERVICE_BUS_QUEUE");
var queue = options.Optional("queue") ?? (provider == "azure" && options.Optional("topic") is null && !string.IsNullOrWhiteSpace(queueEnvironment) ? queueEnvironment : null);
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
    await using var client = provider == "azure" ? new ServiceBusClient(connectionString) : null;
    using var sqs = provider == "aws" ? CreateSqsClient(options) : null;
    using var http = new HttpClient
    {
        BaseAddress = new Uri(options.Value("capture-api", "CAPTURE_API_URL", "http://localhost:3000/api/v1/").TrimEnd('/') + "/")
    };
    var sink = new CaptureSink(http, options.Value("capture-token", "CAPTURE_TOKEN", "local-capture-token"));
    var service = command == "publish"
        ? options.Value("sender", "CAPTURE_SERVICE", "financing-api")
        : options.Value("receiver", "CAPTURE_SERVICE", "orders-consumer");
    IMessageTransport bus;
    if (sqs is not null)
    {
        var queueUrl = options.Optional("queue-url") ?? (options.Optional("queue") is null ? Environment.GetEnvironmentVariable("AWS_SQS_QUEUE_URL") : null);
        var awsBus = await SqsMessaging.ConnectAsync(sqs, queue ?? options.Value("queue", "AWS_SQS_QUEUE_NAME", "orders-queue"), queueUrl, sink, service, shutdown.Token);
        bus = awsBus;
        Console.WriteLine($"Configuration: provider=aws namespace={awsBus.Namespace} queue={awsBus.QueueName} service={service}");
    }
    else
    {
        bus = new TopicMessaging(client!, queue ?? topic, sink, service, queue is not null);
        Console.WriteLine($"Configuration: provider=azure namespace={client!.FullyQualifiedNamespace} {(queue is null ? "topic" : "queue")}={queue ?? topic} service={service}" +
            (command == "subscribe" && queue is null ? $" subscription={subscription}" : string.Empty));
    }
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
        await Subscriber.RunAsync(bus, subscription, shutdown.Token,
            options.Optional("max-messages") is null ? 0 : options.PositiveInt("max-messages", 1));
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
    Console.WriteLine("AWS SQS: publish [message] --provider aws --queue NAME [--sender SERVICE]");
    Console.WriteLine("         subscribe --provider aws --queue NAME [--receiver SERVICE] [--max-messages N]");
    Console.WriteLine("Azure queues: use --provider azure --queue NAME (no subscription).");
    Console.WriteLine("Common options: --provider azure|aws --capture-api URL --capture-token TOKEN");
    Console.WriteLine("AWS options: --queue-url URL (instead of --queue), --endpoint URL|aws, --region REGION");
    Console.WriteLine("LocalStack defaults to http://localhost:4566. Use --endpoint aws for real AWS credentials/region resolution.");
    Console.WriteLine("Subscribe: --max-messages N stops after N completed deliveries; default is continuous.");
    Console.WriteLine("Publish also accepts --body TEXT. Environment-variable fallbacks remain supported.");
}

static AmazonSQSClient CreateSqsClient(CommandLine options)
{
    var endpoint = options.Value("endpoint", "AWS_ENDPOINT_URL", "http://localhost:4566");
    var region = options.Value("region", "AWS_REGION", "us-east-1");
    var config = new AmazonSQSConfig { AuthenticationRegion = region, Timeout = TimeSpan.FromSeconds(30) };
    if (endpoint.Equals("aws", StringComparison.OrdinalIgnoreCase))
    {
        config.RegionEndpoint = RegionEndpoint.GetBySystemName(region);
        return new AmazonSQSClient(config);
    }
    if (!Uri.TryCreate(endpoint, UriKind.Absolute, out var uri) || (uri.Scheme != "http" && uri.Scheme != "https"))
        throw new ArgumentException("--endpoint must be an HTTP(S) URL or aws.");
    config.ServiceURL = uri.ToString();
    return uri.Scheme == "http"
        ? new AmazonSQSClient(new BasicAWSCredentials(Environment.GetEnvironmentVariable("AWS_ACCESS_KEY_ID") ?? "test", Environment.GetEnvironmentVariable("AWS_SECRET_ACCESS_KEY") ?? "test"), config)
        : new AmazonSQSClient(config);
}

sealed class CommandLine
{
    private static readonly HashSet<string> Known =
    [
        "topic", "subscription", "sender", "receiver", "body", "count",
        "interval-ms", "capture-api", "capture-token", "provider", "queue", "queue-url", "endpoint", "region", "max-messages"
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
        Optional(name) ?? (Environment.GetEnvironmentVariable(environmentName) is { } value && !string.IsNullOrWhiteSpace(value) ? value : fallback);
    public int PositiveInt(string name, int fallback) => ParseInt(name, fallback, 1);
    public int NonNegativeInt(string name, int fallback) => ParseInt(name, fallback, 0);
    private int ParseInt(string name, int fallback, int minimum) =>
        Optional(name) is not { } raw
            ? fallback
            : int.TryParse(raw, out var value) && value >= minimum
                ? value
                : throw new ArgumentException($"Option --{name} must be an integer greater than or equal to {minimum}.");
}
