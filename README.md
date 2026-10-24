# E2E Monitor

E2E Monitor collects message activity reported by external applications,
correlates publisher and subscriber reports in MongoDB, and displays message
status, payloads, subscriber timelines, and timing statistics. Messaging Chat
retains Gemini AI replies, draft preparation, documentation retrieval, and saved
conversations.

The platform does not connect to messaging brokers, publish or consume messages,
or settle deliveries. Those operations belong to application SDKs and examples.
The current capture integration supports Azure Service Bus through the
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

## Start locally

```powershell
nvm use
yarn install --frozen-lockfile
docker compose up -d mongodb
yarn dev
```

The collector requires MongoDB; Azure Service Bus and LocalStack are optional
example infrastructure. `yarn compose:up` starts all configured containers for
broker examples. See `config/servicebus-config.json` for example topic names.

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

## Message capture

`POST /api/v1/events` accepts versioned `sent`, `received`, and `completed`
reports with `Authorization: Bearer <CAPTURE_TOKEN>`. Global DTO validation rejects
unknown fields and incomplete reports. Capture IDs correlate each publication;
namespace, destination, subscriber service, and subscription keep deliveries
separate. Duplicate and out-of-order reports cannot undo completion.

MongoDB stores snapshots in `CapturedMessages`. Tracking queries also include
legacy `Messages` history; old data is not migrated or deleted. Each observed
subscriber has a list row. Click the row to open a stable publication detail page
with all observed subscribers, payload, metadata, and timing analysis. Both views
refresh every three seconds. Durations with missing timestamps or inconsistent
clocks are unavailable; completion statistics cover observed subscribers only.

Reports are best effort. The example uses a bounded HTTP timeout without durable
buffering, batching, or retries. A broker operation may succeed while its capture
report is lost. Policy evaluation and a published NuGet package are not included.

## Messaging Chat

AI functionality remains available from **Messaging Chat** on the tracking page,
or `/chat`. Configure `GEMINI_API_KEY` in the API environment. Both **Structured
output** and **Tool calling** modes remain, with MongoDB conversation history and
retrieved documentation context. Drafts can be reviewed or copied; there is no
broker send button or send endpoint. Future chat workflows can be added separately.

Destination names come from configured Azure example entities and active saved
resource metadata. This is a catalog, not live discovery or a broker health check.
SQS metadata/drafts are supported; SQS capture ingestion is not implemented.
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
```

`yarn verify` runs lint, type checks, unit tests, and builds. Browser tests use
mocked collector and AI responses; they do not demonstrate real broker delivery
or an actual Gemini response. Run the C# example with Docker for broker checks.
The .NET example builds independently with `dotnet build examples/servicebus-csharp`.

## Codebase graph

```powershell
yarn graph:update
graphify query "CaptureService" --budget 300
```

Use Graphify once to orient a coherent task, then reuse the findings and read
only the relevant source sections. Query again for new dependency questions,
not before every edit. Start with exact symbols and a small output budget.

The local post-commit hook updates the code graph automatically in the background.
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
