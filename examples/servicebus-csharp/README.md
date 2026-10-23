# C# publisher and subscriber

A tiny .NET 10 console app using Azure.Messaging.ServiceBus. `Publisher.cs`
represents Backend A; `Subscriber.cs` represents Backend B. Both use
`TopicMessaging.cs`, a small send/receive wrapper that can later become a library.

Defaults match `config/servicebus-config.json`:

- Topic: `application-events`
- Subscription: `logging-service` (alternatively `analytics-processor`)

The example uses real Azure Service Bus emulator messaging, not an in-memory bus.
It does not create topics or subscriptions. Start the repo's containers first.

## Run

Prerequisites: .NET 10 SDK, Docker, and the repo's Yarn setup.
From the repository root:

```powershell
yarn compose:up
```

Start the NestJS API and monitor with `yarn dev`. The monitor has no broker consumers; this C# subscriber owns its subscription.
Restart the API and any running C# processes after updating the code.

No connection string setup is needed. The app defaults to the Docker emulator
exposed at `localhost:5672`, using the public emulator credentials built into `Program.cs`. Run the C# processes on the host, from the repository root.

Start Backend B in terminal 1:

```powershell
dotnet run --project examples/servicebus-csharp -- subscribe
```

For a policy-specific subscriber:

```powershell
dotnet run --project examples/servicebus-csharp -- subscribe `
  --topic application-events `
  --subscription logging-service `
  --receiver orders-consumer
```

Publish from Backend A in terminal 2:

```powershell
dotnet run --project examples/servicebus-csharp -- publish
# Or send a custom body (JSON or plain text):
dotnet run --project examples/servicebus-csharp -- publish 'Hello from financing'
```

Publish traffic matching that policy, including multiple samples:

```powershell
dotnet run --project examples/servicebus-csharp -- publish `
  --topic application-events `
  --sender financing-api `
  --body 'hello-world' `
  --count 20 `
  --interval-ms 100
```

The corresponding policy route is the printed namespace plus topic
`application-events`, publisher `financing-api`, subscription `logging-service`,
and subscriber `orders-consumer`. Start the subscriber before publishing for a
passing delivery-time test. Publish first, wait beyond the policy deadline, then
start the subscriber to produce late deliveries.

The publisher prints `[sent]` after broker acceptance. The subscriber prints
`[received]`, the body, and `[completed]` after successful handling and settlement.
Compare `captureId` on both ends. Ctrl+C gracefully stops the subscriber.
For repeat publishes, each invocation generates a new message ID so the topic's
duplicate detection does not discard the new message.

## Wrapper behavior and monitoring

The wrapper writes a UUID into the native `CorrelationId` and the application
property `financingCaptureId`. The subscriber reads that property, falling back
to native correlation for external messages. Receipt is logged before handling;
completion occurs only after the handler succeeds. Handler exceptions allow
redelivery through the SDK processor's abandon behavior.

The wrapper posts `sent`, `received`, and `completed` reports to
`http://localhost:3000/api/v1/events`. The API persists one capture snapshot in
MongoDB's `CapturedMessages` collection. A sent message appears immediately in
Tracking Messages; each observed subscriber gets a delivery row, including its
completion disposition. The table polls every three seconds. Existing broker
history remains visible and is not rewritten.

Defaults: publisher service `financing-api`, subscriber service `orders-consumer`,
capture token `local-capture-token`. Override `CAPTURE_API_URL`, `CAPTURE_SERVICE`,
and `CAPTURE_TOKEN` in the C# process environment. Set the same `CAPTURE_TOKEN` in
the API environment when changing it. The default token is for local development.

Reports carry a UUID event ID and capture ID, broker message ID, namespace, topic,
service, operation timestamp, and subscription for subscriber reports. Only the
send report includes the message body. Receipt is recorded before handling;
completion is reported only after successful broker settlement. Repeated and
out-of-order reports cannot downgrade an already completed delivery. Subscribers
and namespaces are kept separate.

Reporting is best effort with a three-second timeout and no retry/batching/outbox.
A `[capture warning]` means that report may be missing from MongoDB, even if the
business operation succeeded. There is no transaction between broker and collector.
Bodies are included in the send report (maximum 100,000 characters); use synthetic
data in this example. External messages without a UUID capture ID are handled
without reporting. Policy evaluation and a published NuGet package are not included.

CLI options override environment variables. Use `--topic`, `--subscription`,
`--sender`, `--receiver`, `--body`, `--count`, `--interval-ms`, `--capture-api`,
and `--capture-token`. Run `dotnet run --project examples/servicebus-csharp -- --help`
for the compact reference.

Environment overrides remain available: `SERVICE_BUS_CONNECTION_STRING`,
`SERVICE_BUS_TOPIC`, `SERVICE_BUS_SUBSCRIPTION`, `CAPTURE_SERVICE`,
`CAPTURE_API_URL`, and `CAPTURE_TOKEN`. An unset or blank connection string uses the local
emulator default. Environment variables are read from the process; the app does
not load `.env`. If running the C# app inside Docker, override the connection
string endpoint with the emulator's reachable container hostname instead of localhost.
Never commit real connection strings. For Azure rather than the emulator, use
your own credentials and existing topic/subscription names.

## Build

```powershell
dotnet build examples/servicebus-csharp
```

The .NET example is independent of Nx/Yarn build targets. A successful build or
help command does not demonstrate broker connectivity; use the two processes
above for a real send/receive check.

SDK reference: https://www.nuget.org/packages/Azure.Messaging.ServiceBus/7.20.2
Emulator setup: https://learn.microsoft.com/azure/service-bus-messaging/test-locally-with-service-bus-emulator
