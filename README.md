# E2E Monitor

E2E Monitor collects message activity reported by external applications,
correlates publisher and subscriber reports in MongoDB, and displays message
status, payloads, subscriber timelines, and timing statistics. Messaging Chat
retains Gemini AI replies, draft preparation, documentation retrieval, and saved
conversations.

The platform provisions broker resources but does not publish or consume messages,
or settle deliveries. Those operations belong to application SDKs and examples.
The current capture integration supports Azure Service Bus, AWS SQS, and AWS SNS through the
[C# publisher/subscriber example](examples/servicebus-csharp/README.md).

## Workspace

| Project                      | Purpose                                                            |
| ---------------------------- | ------------------------------------------------------------------ |
| `apps/monitor`               | React dashboard, message details, and AI chat                      |
| `apps/backend`               | NestJS capture ingestion, queries, MongoDB, and Gemini integration |
| `apps/monitor-e2e`           | Playwright browser checks with mocked APIs                         |
| `libs/shared/entities`       | Browser-safe shared contracts                                      |
| `examples/servicebus-csharp` | .NET 10 publisher/subscriber and capture wrapper                   |

The workspace uses Nx and Yarn workspaces with strict TypeScript. Use Node.js 22
from `.nvmrc` and Yarn Classic 1.22. Dependencies are pinned by `yarn.lock`.

### Monitor UI structure

Feature pages live in `apps/monitor/src/app/features/<feature>/index.tsx`.
Page entry points own selection and form state and compose smaller components:

- `components/` contains feature-specific presentation such as forms, tables,
  charts, and detail sections.
- `api/hooks.ts` owns React Query keys, polling, mutations, and cache invalidation.
  Policy creation uses the same mutation from both the policy list and AI chat.
- `lib/` contains pure analysis, form conversion, and configuration helpers.

List and detail routes use matching feature boundaries: `messages` and
`message-detail`, `policies` and `policy-detail`. Shared page headers, sections,
back links, and loading/error states live in `components/common/Page.tsx`;
detail statistics use `components/common/DetailPage.tsx`. The application shell
lives in `components/layout/`, with navigation labels and active-route matching
defined in `lib/navigation.ts`. Shared table and shadcn primitives remain under
`components/data-table/` and `components/ui/`.

### Backend structure

`apps/backend/src/main.ts` is the process entry point: it invokes startup and
handles fatal errors. Application setup is separated by responsibility:

- `src/bootstrap/` creates the Nest application and configures the HTTP prefix,
  URI versioning, CORS, validation, serialization, and shutdown hooks. HTTP
  contract tests use the same configuration as production startup.
- `src/app/config/` validates environment variables, exposes typed settings,
  and loads broker metadata for AI context without connecting to a broker.
- `src/app/database/` configures the named MongoDB connection.
- `src/app/common/http/` registers request logging, exception handling, and
  throttling; `src/app/common/logging/` provides the shared logger.
- Domain modules (`capture`, `messages`, `message-resources`, `policies`,
  `messaging-chat`, and `health`) own their controllers, services, DTOs, schemas,
  and tests. `AppModule` composes infrastructure and domain modules.

The HTTP contract remains `/api/v1`: unknown DTO fields are rejected,
configured CORS origins support credentials, and error responses retain their
`statusCode`, `path`, `timestamp`, and `message` fields.

## Start locally

```powershell
nvm use
yarn install --frozen-lockfile
docker compose up -d mongodb
yarn dev
```

The collector requires MongoDB. Resource creation also requires its configured
broker: Azure Service Bus or LocalStack (SQS and SNS). `yarn compose:up` starts
all configured containers. See `config/servicebus-config.json` for bootstrap entities.

- Monitor: http://localhost:4200
- API: http://localhost:3000/api/v1
- Readiness: http://localhost:3000/api/v1/health/ready

## Configuration

Copy `.env.example` to `.env` when overriding defaults. Restart the API after
changes. The C# example reads its own process environment and defaults to the
Docker Service Bus emulator; it does not load the root `.env`.

| Variable                          | Default / purpose                                            |
| --------------------------------- | ------------------------------------------------------------ |
| `PORT`                            | `3000`                                                       |
| `CORS_ORIGIN`                     | `http://localhost:4200`                                      |
| `CAPTURE_TOKEN`                   | `local-capture-token`; shared with instrumented applications |
| `MONGO_URI`                       | `mongodb://testuser:testpass@localhost:27017/`               |
| `MONGO_MESSAGE_DB`                | `MessageTrackingDb`                                          |
| `MONGO_AUTH_SOURCE`               | `admin`                                                      |
| `GEMINI_API_KEY`                  | Empty; set to enable Messaging Chat                          |
| `GEMINI_MODEL`                    | `gemini-3.5-flash-lite`                                      |
| `THROTTLE_TTL` / `THROTTLE_LIMIT` | `60` / `60`                                                  |

For another API host, set `VITE_API_URL` in `apps/monitor/.env.local`.
Root `.env` and frontend `.env.local` are ignored by Git. Never put AI keys or
real credentials in frontend environment variables or committed files. Default
MongoDB credentials and capture token are for local development.

## Broker resources

The Resources page creates Azure Service Bus queues/topics and AWS SQS queues/SNS
topics in the broker before upserting a matching MongoDB record. Azure topic
subscriptions can be entered as comma-separated names. Existing entities are
reused; retries do not create duplicate catalog rows. Broker failure leaves the
form open and does not save a success record. If MongoDB fails after provisioning,
the error explains that the broker entity exists and the same request can be
retried to reconcile it. Broker and MongoDB writes are not a distributed transaction.

Set `SERVICE_BUS_ADMIN_CONNECTION_STRING` for Azure management (local emulator
uses port 5300). AWS defaults to `AWS_ENDPOINT_URL=http://localhost:4566` and
`AWS_REGION=us-east-1`; leave the endpoint empty to use real AWS with the standard
SDK credential chain. Configuration and credentials stay on the backend.
After changing the Compose LocalStack services, run `docker compose up -d localstack`
to enable SNS as well as SQS.
The Compose file pins Service Bus emulator 2.0.0, which supports management APIs;
the previous March 2025 image cannot provision entities at runtime.

Docker configuration remains the emulator's initialization baseline. Runtime-created
Azure entities are not written back to that JSON file and may be lost when the
emulator restarts; save an existing resource again to recreate it. The resource
list shows MongoDB records, with no hardcoded browser-side broker catalog. Existing
configuration-only entities can be registered by creating the same named resource.
Editing adds subscriptions and rechecks the broker; renaming/moving entities is
rejected. Catalog status is not a broker health check. This does not publish or consume messages.

## Message capture

`POST /api/v1/events` accepts versioned `sent`, `received`, and `completed`
reports with `Authorization: Bearer <CAPTURE_TOKEN>`. Global DTO validation rejects
unknown fields and incomplete reports. Capture IDs correlate each publication;
namespace, destination, subscriber service, and subscription keep deliveries
separate. Duplicate and out-of-order reports cannot undo completion.

Optional `provider` (`azure` or `aws`) and `destinationType` (`topic` or `queue`)
identify the transport; omitted values preserve legacy Azure topic behavior.
AWS captures support SQS queues and SNS topics delivered through subscribed SQS queues. Queue receive/completion reports
use the queue name as the delivery target in `subscription`.

MongoDB stores snapshots in `CapturedMessages`. Tracking queries also include
legacy `Messages` history; old data is not migrated or deleted. Each observed
subscriber has a list row. Click the row to open a stable publication detail page
with all observed subscribers, payload, metadata, and timing analysis. Both views
refresh every three seconds. Durations with missing timestamps or inconsistent
clocks are unavailable; completion statistics cover observed subscribers only.

Reports are best effort. The example uses a bounded HTTP timeout without durable
buffering, batching, or retries. A broker operation may succeed while its capture
report is lost. A published NuGet package is not included.

## Delivery policies

Create policies on the **Policies** page or prepare a policy draft in AI chat
and review it before creating it. A policy matches namespace, publisher service,
destination, subscription, and receiver service. Configure the delivery deadline,
required success percentage, evaluation window, and minimum sample count.
For example, require 95% of messages from `financing-api` to `application-events`
to reach `orders-consumer` through `logging-service` within one second.

The API evaluates policies automatically every 30 seconds and stores evaluation
history in MongoDB. Delivery latency measures send to receive, independently of
handler completion. Messages still within their delivery deadline are pending;
overdue messages without a matching receive report count as missing.

Policy details support the last 15 or 30 minutes, 1 or 4 hours, 1 day, 1 week,
and 30 days. Historical analysis applies the current policy rules to messages
sent in that selected range; live status uses the configured evaluation window.
The chart and evidence table use the same analysis.

Charts stay within the page width and show lines without dots. Sparse short
ranges support per-message or actual-time spacing. More than 120 messages
automatically switches to p95 time buckets with at most 120 points for short
ranges. Day, week, and 30-day views use 15-minute, hourly, and 6-hour buckets,
respectively. Tooltips show bucket p95, received/total counts, and maximum latency.
The line is red above the deadline and blue at or below it. Lines connect
populated buckets across empty intervals; empty buckets do not mean zero latency.
The evidence table retains individual messages and links to their details.
Chart aggregation does not change policy evaluation results.

## Messaging Chat

AI functionality is available from the floating chat button across pages,
or `/chat`. Configure `GEMINI_API_KEY` in the API environment. Both **Structured
output** and **Tool calling** modes remain, with MongoDB conversation history and
retrieved documentation context. Drafts can be reviewed or copied; there is no
broker send button or send endpoint. Policy drafts can be reviewed and created
through the same policy creation flow as the Policies page.

Destination names come from configured Azure example entities and active saved
resource metadata. This is a catalog, not live discovery or a broker health check.
SQS capture is supported by the C# example using `--provider aws --queue NAME`;
SNS topics use `--topic NAME`; subscribers also specify an existing SQS `--queue NAME`.
Conversation text, catalog context, and retrieved excerpts are sent to Gemini.
See [chat configuration and limits](docs/messaging-chat.md).

## Health checks

`GET /api/v1/health/live` checks process liveness. `/health/ready` checks MongoDB
only; `/health` is an alias. Broker availability cannot make the collector unready.
The API uses URI versioning under `/api/v1`.

## Commands and verification

```powershell
yarn dev
yarn build
yarn lint
yarn typecheck
yarn test
yarn verify
yarn playwright install chromium
yarn test:e2e
yarn test:brokers
yarn test:csharp
```

`yarn verify` runs lint, type checks, unit tests, and builds. Browser tests use
mocked collector and AI responses; they do not demonstrate real broker delivery
or an actual Gemini response. Run the C# example with Docker for broker checks.
The .NET example builds independently with `dotnet build examples/servicebus-csharp`.
`yarn test:brokers` requires the local Docker brokers and MongoDB. It starts an
isolated API on port 3017 and a temporary database, verifies actual queue/topic
creation, Azure subscriptions, MongoDB records, and idempotent retries, then removes
only its own test resources. It does not test message delivery or consume application subscriptions.

## Codebase graph

```powershell
yarn graph:update
graphify query "CaptureService" --budget 300
```

Use Graphify once to orient a coherent task, then reuse the findings and read
only the relevant source sections. Query again for new dependency questions,
not before every edit. Start with exact symbols and a small output budget.

Husky runs `graphify . --code-only` before every commit and blocks the commit if
indexing fails. Install Graphify with `uv tool install graphifyy`; `yarn install`
activates the hooks through the `prepare` script. The hook performs local code
analysis without LLM extraction tokens. Generated graph output stays ignored.
Husky replaces the native hook path, so the old post-commit rebuild is inactive.
Use `yarn graph:update` manually only when an uncommitted structural change must
be indexed for the current investigation. This command performs local AST
extraction without an AI key or LLM tokens and preserves existing documentation
semantics. The installed `update` command does not accept `--code-only`.

Keep reusable query notes short (target 150 words or fewer), with source references
and an outcome; do not save full conversations or tool output. Generated graphs,
reports, memory, caches, and backups under `graphify-out/` remain Git-ignored.
Graphify does not measure Codex conversation-token savings; its benefit depends
on reducing subsequent exploration.

## Local data

Compose uses named volumes. Stop containers with `yarn compose:down`; volumes are
preserved. `docker compose down -v` permanently deletes local Compose data,
including MongoDB captures and chat history. Existing broker images and config
remain available for external application examples.
