# Emulator Monitor

Emulator Monitor is a local development dashboard for Azure Service Bus and AWS
SQS. It combines a React monitor, a NestJS API, MongoDB-backed message tracking,
and containerized messaging emulators in one Nx workspace.

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

The local defaults work without an environment file. Copy `.env.example` to
`.env` before starting the backend when you need to override them.

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

The Playwright target starts the monitor automatically and mocks its tracked
messages request, so it does not require the backend or Docker. Install its
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

A readiness response can remain unhealthy for a short time while the containers
finish starting. Inspect them with `docker compose ps` and
`docker compose logs <service>`.

## API areas

### Messaging chatbot

Set `GEMINI_API_KEY` in the root `.env` using a key from
[Google AI Studio](https://aistudio.google.com/api-keys), then restart the backend.
The default model is `gemini-3.5-flash-lite`, which offers a quota-limited free tier.
Use a free-tier Google project to avoid paid API usage.
Open **Messaging Chat** from the main page (or <http://localhost:4200/chat>). For example, ask:
`Send {"hello":"world"} to Azure topic application-events` or
`I want to send a message to AWS queue orders-queue`.
The assistant asks for missing details, prepares a draft, and sends it only when
you click **Send message**. See [chat configuration and architecture](docs/messaging-chat.md).

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
