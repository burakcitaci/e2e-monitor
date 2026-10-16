# Messaging chatbot

The chatbot replaces the former E2E scenario/policy demo. Existing messaging,
manual broker settlement, resource discovery, and Vite performance fixes remain.

## Setup

Set `OPENAI_API_KEY` in the backend's local `.env` or environment and restart the
API. Never set this key in a `VITE_` variable or commit it. The default model is
`gpt-4.1-mini`; change `OPENAI_MODEL` to another Responses API model supporting
structured outputs if needed. A ChatGPT subscription does not configure an API key.

Open `/chat`, describe the provider, queue/topic, and message, and answer any
follow-up questions. Review the exact destination and body, then click **Send
message**. AWS SQS supports queues; Azure Service Bus supports queues and topics.
The chatbot only prepares drafts for discovered/configured destinations. SQS
queues must already exist; create resources using the existing messaging tools.

## Boundaries

- NestJS `MessagingChatService` calls the OpenAI Responses API using native fetch,
  a 30-second timeout, `store: false`, and a strict JSON-schema response format.
- The backend provides destination names from Azure configuration and SQS
  discovery. Credentials, connection strings, and queue URLs are not model context.
  At most 200 destination entries are provided in one request.
- The model cannot call send APIs. Its response is validated again with Zod and
  checked against the destination catalog. Invalid/unknown destinations do not
  produce a sendable draft. No HTML from model responses is rendered.
- The frontend uses feature-local query/mutation hooks and separate transcript,
  composer, and review components. Sending reuses the existing Azure/SQS APIs and
  invalidates tracking queries. Automatic send retries are disabled. FIFO sends
  reuse the draft's deduplication ID on explicit retries.
- Conversation context lives in browser component state, capped at 20 turns and
  roughly 60 KB; older turns are dropped. New chat clears it. Conversation text,
  proposed message bodies, and destination names are sent to OpenAI when asking
  the assistant. They are not persisted by this application.

`GET /api/v1/messaging-chat/status` reports configuration readiness without
returning secrets. `POST /api/v1/messaging-chat/messages` accepts user/assistant
turns only; system roles, extra fields, empty/oversized input are rejected.
Missing keys, upstream errors, refusals, and incomplete responses are surfaced
without fabricating a successful send. A failed broker request retains the draft;
broker acceptance can be ambiguous after transport failures, so consult tracking
before retrying. Standard queues do not guarantee send deduplication.

The old `/e2e-tests` URL redirects to `/chat`. Policy APIs and classes are removed;
historical demo MongoDB collections are left untouched and are no longer used.

## Verification

Run `yarn verify` and `yarn test:e2e`. AI protocol tests mock the upstream service;
browser tests verify clarification, draft review, explicit Azure/AWS sends, error
handling, and configuration guidance. A live LLM check additionally requires a
valid API key and model access; tests do not spend API credits.

Protocol references: [Responses structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
and [GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini).
