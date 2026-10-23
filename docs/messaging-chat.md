# Messaging chatbot

## Overview

Messaging Chat retains the Gemini AI integration, structured output and tool
calling modes, retrieved documentation context, message and policy draft previews, and
MongoDB conversation history. It answers messaging questions and prepares drafts.
The platform is a collector: it has no broker publish, receive, or settlement
capability. External applications own those operations.

## Supported providers

Destination metadata recognizes Azure Service Bus queues/topics and AWS SQS
queues. The capture SDK currently reports Azure Service Bus activity only; SQS
capture is not implemented. Gemini is the AI provider, not a messaging transport.
Saved or configured destination names do not prove broker availability.

## Setup

Set `GEMINI_API_KEY` in the backend root `.env` or process environment and restart
the API. Never set it in a `VITE_` variable or commit it. `GEMINI_MODEL` defaults
to `gemini-3.5-flash-lite`. Model availability, quotas, and billing are controlled
by your Google project; the app does not select a billing tier or automatically
switch providers. Missing configuration, quota errors, and upstream failures are
reported without automatic AI retries.

Open **Messaging Chat** from the main tracking page or visit `/chat`. Closing and
reopening the sheet preserves the current conversation. Saved conversations can
be selected from **Chat history**, with pages of 20 entries. Selecting a saved
conversation restores its transcript and mode. **New chat** starts a fresh one.

## Planning modes

- **Structured output** requests a validated reply and optional draft from Gemini.
- **Tool calling** allows destination and observed-policy-route lookup plus
  message and policy preparation. These tools read local metadata and validate
  drafts. There are no broker or shell tools.

Drafts show their provider, destination, and exact payload for review. Copy the
payload into an external publisher or ask for changes. The platform has no Send
message button or broker send endpoint. Switching modes starts a new conversation.
Historical drafts do not regain an active preview when loading an old chat.

## Policy planning

Describe the publisher, destination, subscription, subscriber and delivery
deadline in chat. The assistant can use captured routes to prepare a policy
draft. The draft defaults to 95% success over 30 minutes with one minimum sample
unless the request specifies other values. Review the complete business rule and
select **Create policy** to persist it. Preparing a draft never writes a policy.

Matching sent messages remain pending until their deadline, then become passed,
late, or missing. Policy status uses the required success percentage after the
minimum sample count has been reached.

The catalog combines `config/servicebus-config.json` with active saved destination
metadata in MongoDB. The collector does not discover SQS queues or connect to
Azure Service Bus. Tool mode allows four Gemini requests and eight function calls
per turn, with a shared 30-second AI-request deadline. No fallback to another mode
or automatic retry is performed.

## Persistence and privacy

Conversations contain text and prepared-draft context, bounded to 200 turns and
roughly 1 MB per conversation. Saved history is shared by browsers connected to
this local API. A failed save is visible; **Retry saving** only retries MongoDB
persistence, not the AI request. Earlier saved send-outcome text remains readable
as historical content, but cannot invoke a broker operation.

Conversation text, destination names, and retrieved excerpts are sent to Google.
Keys stay in the API. Existing authentication and network access controls for this
local deployment are unchanged.

## Documentation retrieval (RAG)

Both planning modes retrieve up to three relevant entries from the explicit
`DOCUMENTS` list in
`apps/backend/src/app/messaging-chat/messaging-chat-knowledge.service.ts`. English
keyword matching selects excerpts; there is no embedding model or vector store.
The entries are sent to Gemini as reference data. Citations such as
`[source: docs/messaging-chat.md#setup]` are model generated and may be incorrect.

Edit `DOCUMENTS` to update the assistant's knowledge, then restart the API.
Citation sources are labels; Markdown files are not loaded automatically. Never
include secrets in knowledge entries. Saved chats, credentials, and captured
message payloads are not indexed. Documentation cannot prove current health or
message delivery; use captured reports and health endpoints for those facts.

## API

- `GET /api/v1/messaging-chat/status`: key presence and selected model, without keys.
- `POST /api/v1/messaging-chat/messages`: structured reply/draft planning.
- `POST /api/v1/messaging-chat/messages/tools`: read-only tool planning.
- `/api/v1/messaging-chat/conversations`: create, list, load, and append history.

The status endpoint does not verify model access, quotas, or billing. Tests mock
Gemini responses and are not evidence of actual model availability.
