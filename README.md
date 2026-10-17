# Emulator Monitor

Emulator Monitor is a local development dashboard for Azure Service Bus and AWS
SQS. It combines a React monitor, a NestJS API, MongoDB-backed message tracking,
and containerized messaging emulators in one Nx workspace.

The workspace uses Nx 23, TypeScript 6, Vite 8, and Vitest 5. Dependency versions
are pinned by `yarn.lock`; use `yarn install --frozen-lockfile` when onboarding.

## Workspace

| Project | Purpose | Main technology |
| --- | --- | --- |
| `apps/monitor` | Browser dashboard | React 19, Vite, TanStack Query |
| `apps/backend` | Versioned API and background message workers | NestJS 11, Mongoose |
| `apps/monitor-e2e` | Browser smoke tests | Playwright |
| `libs/shared/entities` | Browser-safe shared message types | TypeScript |

The Azure Service Bus entities are defined in
[`config/servicebus-config.json`](config/servicebus-config.json). The SQS worker
creates its configured queue when it first connects to LocalStack.

## Prerequisites

- Node.js 22 (the version is recorded in `.nvmrc`)
- Yarn Classic 1.22
- Docker with Docker Compose v2

## Start locally

```bash
nvm use
yarn install --frozen-lockfile
yarn compose:up
yarn dev
```

The messaging dashboard works without an environment file. Copy `.env.example`
to `.env` before starting the backend when you need overrides or want to enable
the Gemini assistant. Restart the backend after changing `.env`.

On PowerShell, create the local file with `Copy-Item .env.example .env` (only if
`.env` does not already exist). Set `GEMINI_API_KEY` in that file to enable chat.
The root `.env` and frontend `.env.local` files are Git-ignored and stay on your
machine. Commit only placeholder values in `.env.example`; never commit API keys.

| Service | Address |
| --- | --- |
| Monitor | <http://localhost:4200> |
| API health | <http://localhost:3000/api/v1/health> |
| Azure Service Bus emulator | `localhost:5672` (AMQP), `localhost:5300` |
| LocalStack SQS | <http://localhost:4566> |
| MongoDB | `mongodb://localhost:27017` |

SQL Server and Azurite support the Service Bus emulator inside the Compose
network and are not exposed to the host. All exposed development ports bind to
`127.0.0.1` only.

Stop the emulators with:

```bash
yarn compose:down
```

## Commands

| Command | Action |
| --- | --- |
| `yarn dev` | Start the backend and monitor together |
| `yarn dev:backend` | Start only the NestJS API |
| `yarn dev:monitor` | Start only the Vite monitor |
| `yarn build` | Build every buildable Nx project |
| `yarn test` | Run all unit tests |
| `yarn test:backend` | Run backend Jest tests |
| `yarn test:monitor` | Run monitor Vitest tests |
| `yarn test:e2e` | Run the Chromium Playwright smoke suite |
| `yarn lint` | Lint all projects |
| `yarn typecheck` | Type-check all projects |
| `yarn verify` | Run lint, type-check, unit tests, and builds |
| `yarn compose:up` | Start the local dependencies in the background |
| `yarn compose:down` | Stop the local dependencies |

The Playwright target starts the monitor automatically and mocks API responses,
including AI replies and broker sends. It does not require the backend, Docker,
or an AI key, and does not prove live broker/LLM integration. Install its
browser once on a new machine:

```bash
yarn playwright install chromium
```

## Configuration

Backend configuration is loaded from the process environment and root `.env`
file. Important settings are:

| Variable | Local default |
| --- | --- |
| `PORT` | `3000` |
| `CORS_ORIGIN` | `http://localhost:4200` |
| `MESSAGE_PROCESSING_MODE` | `manual` (`automatic` enables simulation workers) |
| `GEMINI_API_KEY` | Empty; required only for Messaging Chat |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` |
| `SERVICE_BUS_CONNECTION_STRING` | Service Bus emulator connection |
| `SERVICE_BUS_NAMESPACE` | `sbemulatorns` |
| `SERVICE_BUS_QUEUE` | `orders-queue` |
| `MONGO_URI` | `mongodb://testuser:testpass@localhost:27017/` |
| `MONGO_MESSAGE_DB` | `MessageTrackingDb` |
| `MONGO_AUTH_SOURCE` | `admin` |
| `AWS_SQS_ENDPOINT` | `http://localhost:4566` |
| `AWS_REGION` | `us-east-1` |
| `AWS_SQS_QUEUE_NAME` | `orders-queue` |
| `THROTTLE_TTL` / `THROTTLE_LIMIT` | `60` / `60` |

To point the browser at another API, create `apps/monitor/.env.local`:

```dotenv
VITE_API_URL=http://localhost:3000/api/v1
```

The credentials in `.env.example` and `docker-compose.yml` are emulator-only
values. Use managed secrets and real credentials outside local development.

## Health checks

The API uses the global `/api/v1` prefix:

- `GET /api/v1/health/live` reports process liveness without checking dependencies.
- `GET /api/v1/health/ready` checks MongoDB, Azure Service Bus, and SQS.
- `GET /api/v1/health` is an alias for the readiness check.

The unused root greeting endpoint was removed; `GET /api/v1` returns 404.

A readiness response can remain unhealthy for a short time while the containers
finish starting. Inspect them with `docker compose ps` and
`docker compose logs <service>`.

## API areas

### Messaging chatbot

Set `GEMINI_API_KEY` in the root `.env` using a key from
[Google AI Studio](https://aistudio.google.com/api-keys), then restart the backend.
The default model is `gemini-3.5-flash-lite`, which offers a quota-limited free tier.
Use a free-tier Google project to avoid paid API usage.
Click **Messaging Chat** on the main **Tracking Messages** page to open a
right-side sheet. It fills the screen width on mobile and preserves conversations
and prepared drafts when closed and reopened on the same page. **Chat history**
lists saved conversations, newest first, with pages of 20. Select a conversation
to restore its transcript and planning mode and continue it after a reload or API
restart. **New chat** starts a separate conversation; previous chats remain saved.
Old drafts do not regain an active Send button when selected from history—ask
the assistant to prepare a fresh draft. Chat is not a sidebar menu;
<http://localhost:4200/chat> remains available for existing links.

For example, ask:
`Send {"hello":"world"} to Azure topic application-events` or
`I want to send a message to AWS queue orders-queue`.
The assistant asks for missing details, prepares a draft, and sends it only when
you click **Send message**. No model response can publish a message automatically.
Use the **Structured output / Tool calling** toggle to choose the planning mode.
Structured output returns a validated JSON draft in one AI response. Tool calling
uses a separate backend service to execute destination lookup and draft preparation
functions, returning their results to Gemini before its final reply. Switching
modes starts a fresh conversation and clears the old draft (the previous chat stays
in history); the toggle is disabled
while a request is running. Both modes require the same explicit Send click.
Keys stay in the backend; conversation text and destination names go to Google.
Quota/rate-limit and temporary capacity errors are displayed without automatic
retries or switching to a paid provider. The application cannot enforce your
Google project's billing tier. See [chat configuration and architecture](docs/messaging-chat.md).

- `GET /api/v1/messaging-chat/status` reports key presence and the selected model,
  without returning credentials; it does not verify billing or model availability.
- `POST /api/v1/messaging-chat/messages` prepares a validated draft or asks for
  missing details. Confirming the draft uses the existing broker send endpoints.
- `POST /api/v1/messaging-chat/messages/tools` uses the separate tool-calling
  planner with the same input and reply contracts. Only `list_destinations` and
  `prepare_message` are allowed; no broker-send tool is exposed.
- `/api/v1/messaging-chat/conversations` stores local chat transcripts and their
  mode in MongoDB. History contains message content and prepared-draft context;
  it is shared by browsers connected to this local API. Conversations are bounded
  to 200 entries / roughly 1 MB. Save failures are visible; **Retry saving** only
  retries persistence and never republishes a broker message.

### RAG: documentation-aware chat

**RAG (Retrieval-Augmented Generation)** means finding relevant reference material
and providing it to the AI alongside your question. This gives the model context
for its answer without retraining it.

Messaging Chat uses RAG automatically in both **Structured output** and **Tool
calling** modes. It searches an explicit hardcoded `DOCUMENTS` list, then supplies
up to three relevant entries to Gemini. Each entry defines its title, provider,
text and citation source.
No extra setup, embeddings service or vector database is required; the existing
`GEMINI_API_KEY` setup is sufficient.

To use it, open **Messaging Chat** and ask a documentation question, for example:

- `How do I configure GEMINI_API_KEY?`
- `What does the readiness health check test?`
- `How are Azure Service Bus destinations configured?`
- `Can this app send messages to AWS SQS topics?`

The model is instructed to cite supporting excerpts in its reply, such as
`[source: docs/messaging-chat.md#setup]`. Citations are model-generated and do not
guarantee correctness. Retrieval currently uses English keywords from your latest
message; include the provider and subject explicitly in follow-up questions.
Unsupported questions may have no matching documentation.

Documentation describes how the application works; current catalog/tool results
determine available destinations. Retrieval does not send messages or establish
live broker health. Sending still requires reviewing a draft and clicking **Send
message**. Saved chats, environment files, credentials and broker message bodies
are not indexed. Retrieved excerpts are sent to Google alongside the existing
conversation and destination context.

To add or change knowledge, edit `DOCUMENTS` in
`apps/backend/src/app/messaging-chat/messaging-chat-knowledge.service.ts`, then
rebuild/restart the backend. For a simple test, change the `chat-overview` entry's
`text` and ask **What does the Overview section say?** in a new chat.
`source` is a citation label: it does not load that Markdown file. Editing only
the README or docs does not update RAG knowledge. Keep entry text aligned with
its cited section, and never include secrets. See [retrieval details and limits](docs/messaging-chat.md#documentation-retrieval-rag).

### Send and process messages

On **Tracking Messages**, choose **Send message**, select Azure Service Bus or
AWS SQS, then choose a queue (or an Azure topic) and enter JSON or plain text.
Azure destinations come from the emulator configuration. AWS shows the default
queue plus active saved AWS queue resources; names are resolved by the backend.

Processing defaults to `MESSAGE_PROCESSING_MODE=manual`. Workers hold a live
delivery for up to 90 seconds, capped by the remaining Azure lock lifetime. Its table row offers **Receive / settle** with
Complete (receive), Abandon, Defer, and Dead-letter actions. History and messages
not currently leased show no broker action. Topic subscription deliveries have
separate action tokens and display their subscription path. Broker failures keep
the row unchanged and report an error. Tokens expire on restart or lease expiry;
wait for broker redelivery and refresh rather than retrying an old token.

For Azure, Defer uses native deferred-message settlement; retrieving that deferred
message by sequence number is not yet exposed in the dashboard. For SQS, Defer
hides the message for five minutes, and Abandon makes it visible immediately.
Manual SQS Dead-letter copies to `<queue>-dlq` before deleting the source (FIFO
queues retain a `.fifo` suffix). This two-call move is not transactional; an
ambiguous send failure can cause duplicates. The dashboard does not consume the
DLQ automatically. Normal broker lock expiry, delivery limits, and redrive policies
still apply while waiting for user action.

Set `MESSAGE_PROCESSING_MODE=automatic` to retain the previous simulation worker
behavior. Older provider-specific simulation forms still accept a requested
disposition for automatic mode; manual mode waits for table actions instead.

Both emulators must be healthy for real sends and settlement. Compose pins the
LocalStack Community image to `4.14.0` for local SQS without an auth token.
LocalStack releases from March 2026 require an account and valid
`LOCALSTACK_AUTH_TOKEN`; upgrading to those images requires explicit token
configuration. The older Community release does not receive current fixes.
It uses a separate `localstackcommunitydata` volume to avoid opening newer-version
state with an older image; the original `localstackdata` volume is preserved.

- `/api/v1/service-bus` sends, receives, lists, and configures Service Bus messages.
- `/api/v1/aws-sqs` sends, receives, lists, and configures SQS messages.
- `/api/v1/aws-sqs/queues` discovers queues from the configured SQS endpoint,
  including queues created outside the dashboard. Messaging Resources refreshes
  this list every ten seconds and merges it with saved resources without duplicate
  queue rows. Discovered entries are read-only; discovery does not save metadata
  to MongoDB or change broker resources.
- `/api/v1/tracked-messages/tracking` manages unified message tracking.
- `/api/v1/message-resources/resources` manages saved messaging resources.

Request DTOs are validated globally; unknown fields are rejected.

## Codebase graph

Graphify maintains a local codebase graph in `graphify-out/`. Refresh it after
source changes and removals using the installed Graphify CLI:

```bash
graphify update . --force
graphify query "MessagingChatSheet useConversation MessagingChatService" --budget 1500
```

The update command extracts code locally without an AI key. `--force` permits
the graph to shrink when obsolete code is removed. It preserves the existing
semantic documentation layer; it does not perform fresh AI extraction of docs.
Use the full Graphify skill workflow if documentation semantics need rebuilding.
Open `graphify-out/graph.html` for navigation or `graphify-out/GRAPH_REPORT.md`
for the generated report. Generated graphs, caches, and machine-specific state
remain Git-ignored; they are not application runtime dependencies.

Nx Console lists four active projects: shared entities, monitor, backend, and
monitor-e2e. Browser checks use the regular `monitor-e2e:e2e` target; generated
per-spec CI targets are disabled to keep the project list compact.

## Local data

Compose stores MongoDB, SQL Server, Azurite, and LocalStack state in named
volumes. To completely reset local emulator data, stop the application and run:

```bash
docker compose down -v
```

This permanently removes the local Compose volumes. If an external MongoDB was
created with an older project version, check for the legacy unique
`messageId_1` index before reusing the same message ID across providers. Current
tracking uniqueness is scoped by `emulatorType` and `messageId`.
