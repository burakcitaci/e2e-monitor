# Messaging chatbot

The chatbot replaces the former E2E scenario/policy demo. Existing messaging,
manual broker settlement, resource discovery, and Vite performance fixes remain.

## Setup

Create a key in [Google AI Studio](https://aistudio.google.com/api-keys).
Set `GEMINI_API_KEY` in the backend's root `.env` or environment and restart the
API. Never set this key in a `VITE_` variable or commit it. The default model is
`gemini-3.5-flash-lite`; `GEMINI_MODEL` can select another Gemini model supporting
structured outputs. OpenAI keys are not used by this integration.
The default model offers a free tier with quotas; this app cannot select or enforce
your Google project's billing tier. Keep the Google project on the free tier if you
want no API charges. Quota exhaustion is shown as an error without automatic retries
or fallback to a paid provider. Availability and quotas depend on Google's policies.

Click **Messaging Chat** on the main monitor page to open the assistant in a
right-side sheet while keeping the message table in place. Closing and reopening the sheet
preserves the conversation and prepared draft until you leave the monitor page.
Saved chats are available again from **Chat history** after navigating away or reloading.
The direct `/chat` page remains available for old links, but is not listed in the sidebar.

Describe the provider, queue/topic, and message, and answer any
follow-up questions. Review the exact destination and body, then click **Send
message**. AWS SQS supports queues; Azure Service Bus supports queues and topics.
The chatbot only prepares drafts for discovered/configured destinations. SQS
queues must already exist; create resources using the existing messaging tools.

## Planning modes

The mode toggle defaults to **Structured output**. Switching modes clears the
conversation and pending draft; it is disabled during requests. Mode selection
and the conversation survive closing/reopening the sheet while the monitor stays
mounted. Both modes keep broker publishing behind the explicit Send button.

- **Structured output** uses `MessagingChatService` and
  `POST /api/v1/messaging-chat/messages`. It requests a JSON-schema draft in one
  Gemini response and validates that draft against the destination catalog.
- **Tool calling** uses the separate `MessagingChatToolsService` and
  `POST /api/v1/messaging-chat/messages/tools`. Gemini may call
  `list_destinations` (returns a local catalog snapshot) or `prepare_message`
  (validates and prepares a draft without sending). The backend returns real
  function results to the model and preserves call IDs and thought signatures.
  A normal text response completes the conversation turn; only a successfully
  validated preparation can produce a sendable draft.

Tool mode allows at most four Gemini requests and eight function calls per turn,
with a shared 30-second AI-request deadline. Unknown tools and ambiguous batches
are rejected. Invalid arguments produce tool errors; safety blocks, provider
errors, and loop exhaustion cannot return a prepared draft. There are no shell,
arbitrary HTTP, or broker-send tools, automatic retries, or mode fallbacks.

## Saved conversations

User turns are saved before calling the planner. Assistant replies and draft context
are appended after generation; confirmed-send outcomes are appended after the broker
accepts the send. Chat history lists metadata only, 20 chats per page sorted by last
update and ID. Selecting a chat fetches its current transcript and restores its mode.
New chat and mode changes start a separate conversation without deleting old chats.
Restored drafts are read-only conversation context; the active Send action is cleared.

`ChatHistoryController` and `ChatHistoryService` store `ChatConversations` in the
existing `MessageTrackingDb` MongoDB connection, with a unique ID and update-order
index. Each chat is bounded to 200 entries and 1,000,000 UTF-8 JSON bytes; AI context
still uses only the most recent 20 turns / roughly 60 KB. Revision-checked atomic
appends prevent lost updates. UUID turn IDs make uncertain save retries idempotent.
Conflicts require reselecting the conversation from history before continuing.
This local dashboard has a shared history store, without per-user accounts or TTL.

- `GET /api/v1/messaging-chat/conversations?page=1` lists summaries.
- `POST /api/v1/messaging-chat/conversations` creates a UUID/mode record.
- `GET /api/v1/messaging-chat/conversations/:id` reads the transcript.
- `POST /api/v1/messaging-chat/conversations/:id/turns` appends a UUID turn using
  the expected revision. Unknown fields, unsupported roles and oversized input fail validation.

History save errors remain visible with a separate Retry saving action. A successful
broker send clears its active draft before saving the outcome; a history retry never
calls a broker. MongoDB persistence and broker acceptance are separate operations,
so a crash between them can leave an incomplete transcript. Consult message tracking
for actual delivery state. History is not a broker audit log or an exactly-once ledger.

## Boundaries

- The shared NestJS `MessagingChatRuntime` handles credentials, bounded input,
  the destination catalog, Gemini `generateContent` transport, and draft/response
  validation. The structured and tool-calling services have separate orchestration.
  Assistant turns map to Gemini's model role; system instructions remain separate.
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
- Active conversation context lives in browser state and saved transcripts live in
  MongoDB. Planner input is capped at 20 turns and roughly 60 KB. Conversation text,
  proposed message bodies, and destination names are sent to Google when asking
  the assistant. Server configuration credentials and opaque Gemini tool signatures
  are not added to chat history. Text entered into chat is saved as entered. Google's free-tier
  pricing lists use of content for product improvement; review the applicable terms
  before using sensitive data.

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

Protocol references: [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/generate-content/structured-output)
and [GenerateContent tools and function responses](https://ai.google.dev/api/generate-content).
See [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) for free-tier limits.
