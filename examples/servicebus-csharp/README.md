# C# publisher and subscriber

A tiny .NET 10 console app using Azure.Messaging.ServiceBus, AWSSDK.SQS, and AWSSDK.SimpleNotificationService. `Publisher.cs`
represents Backend A; `Subscriber.cs` represents Backend B. Both use
`IMessageTransport`, implemented by `TopicMessaging.cs` (Azure queues/topics) and
`SqsMessaging.cs` (AWS queues) and `SnsMessaging.cs` (AWS topics through SQS). Azure remains the default provider.

Defaults match `config/servicebus-config.json`:

- Topic: `application-events`
- Subscription: `logging-service` (alternatively `analytics-processor`)

The example uses the real Service Bus emulator or LocalStack, not an in-memory bus.
Create queues and topics on the monitor's Resources page or through Docker
bootstrap configuration first. SNS subscribers create/reuse the topic-to-queue
subscription and a topic-scoped queue permission; they do not create the topic or queue.

## AWS SNS topics

Create an AWS **topic** `application-events` and a dedicated AWS **queue**
`orders-events` in Resources. Then start the subscriber before publishing:

```powershell
# Terminal 1: subscribe to the topic through an existing SQS queue
dotnet run --project examples/servicebus-csharp -- subscribe `
  --provider aws --topic application-events --queue orders-events `
  --receiver orders-consumer

# Terminal 2: publish directly to SNS
dotnet run --project examples/servicebus-csharp -- publish `
  --provider aws --topic application-events --sender financing-api `
  --body 'Hello SNS' --count 20 --interval-ms 100
```

`--topic` accepts a topic name or ARN. Name lookup uses `sns:ListTopics`;
supplying an ARN avoids that lookup. SNS subscribing accepts `--queue NAME`,
`--queue-url URL`, or `--subscription NAME` (an alias for an existing queue name).
Publishing to SNS needs no queue argument. Each subscriber should use its own
dedicated queue, so subscribers receive independent copies of a publication.

The subscriber preserves the existing queue policy and adds only a grant for
`sqs:SendMessage` from the selected SNS topic. It creates/reuses the SNS-to-SQS
binding with raw delivery disabled. The SNS envelope retains the original SNS
message ID and capture attribute, allowing sends and receives to correlate even
though SQS assigns a separate ID. The business handler receives the original
body. The monitor labels these captures **SNS**; namespace is the topic ARN prefix,
destination is the topic name, and subscription is the receiving queue name.

Queues and subscriptions remain after Ctrl+C, so offline messages can be buffered.
Messages outside the selected SNS topic are not deleted; use a dedicated queue
instead of one containing unrelated SQS traffic. Same-account SNS/SQS binding is
supported automatically; cross-account subscriptions may require confirmation.
LocalStack uses port 4566 with both `sqs` and `sns` enabled. Real AWS additionally
requires permissions for SNS lookup/publish/subscribe/attributes and SQS queue
attributes/policy/receive/delete as appropriate. Existing Azure commands are unchanged.

## AWS SQS and queue parameters

Create an AWS queue named `orders-queue` in **Resources**, then run:

```powershell
# Terminal 1: Backend B
dotnet run --project examples/servicebus-csharp -- subscribe `
  --provider aws --queue orders-queue --receiver orders-consumer

# Terminal 2: Backend A
dotnet run --project examples/servicebus-csharp -- publish `
  --provider aws --queue orders-queue --sender financing-api `
  --body 'Hello from AWS' --count 20 --interval-ms 100
```

AWS defaults to LocalStack at `http://localhost:4566`, region `us-east-1`, and
local `test` credentials. Override `--endpoint URL` and `--region REGION`, or
`AWS_ENDPOINT_URL` and `AWS_REGION`. Use `--endpoint aws` for real AWS with the
standard SDK credential chain. Process environment variables are used; root `.env`
is not loaded. Never put real credentials in source or command-line arguments.

`--queue-url URL` can replace `--queue NAME`. Environment fallbacks are
`AWS_SQS_QUEUE_NAME`, `AWS_SQS_QUEUE_URL`, and `MESSAGING_PROVIDER`. Explicit
`--queue` overrides the queue URL environment variable. Add `--topic` when
subscribing an SQS queue to SNS, as shown above.

Azure queues use the same commands with `--provider azure --queue orders-queue`.
Do not pass `--subscription` for a queue. Existing Azure topic commands remain
unchanged. `SERVICE_BUS_QUEUE` selects an Azure queue when `--topic` is not explicit.

For either provider, `subscribe --max-messages N` exits after N completed messages.
The default remains continuous receiving until Ctrl+C. SQS uses long polling,
reports receipt before handling, and deletes only after successful handling.
Handler failures leave messages for redelivery after the queue visibility timeout.
FIFO queues automatically use the sender service as message group and a fresh
capture ID as deduplication ID.

All transports report sent/received/completed events to the monitor. SQS records
are labeled SQS and use the queue ARN prefix as namespace. Queue delivery targets
use the queue name in the capture contract's subscription field; topic subscriptions
retain their real names. Capture IDs are carried in SQS message attributes or
Azure application properties. Short-range views and historical policies can use
these captured routes, independently of handler completion.

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
without reporting. Policy evaluation is available in the monitor; a published
NuGet package is not included.

CLI options override environment variables. Use `--provider`, `--queue`, `--topic`, `--subscription`,
`--sender`, `--receiver`, `--body`, `--count`, `--interval-ms`, `--capture-api`,
and `--capture-token`. Run `dotnet run --project examples/servicebus-csharp -- --help`
for the compact reference. AWS also accepts `--queue-url`, `--endpoint`, and `--region`.

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
yarn test:csharp
```

The .NET example is independent of Nx/Yarn build targets. A successful build or
help command does not demonstrate broker connectivity; use the two processes
above for a real send/receive check. `yarn test:csharp` builds to a separate output
folder, runs against local Docker brokers and an isolated API/database, verifies
publish/receive/completion and capture records, then cleans up its own resources.
Stop any old publisher/subscriber processes before a normal build if Windows
reports that the executable is locked.

SDK reference: https://www.nuget.org/packages/Azure.Messaging.ServiceBus/7.20.2
AWS SDK reference: https://www.nuget.org/packages/AWSSDK.SQS/4.0.100.20
SNS SDK reference: https://www.nuget.org/packages/AWSSDK.SimpleNotificationService/4.0.100.21
Emulator setup: https://learn.microsoft.com/azure/service-bus-messaging/test-locally-with-service-bus-emulator
