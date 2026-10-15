# E2E test monitor: demo implementation

Open `/e2e-tests` and save a scenario. A policy specifies the publisher service,
consumer service, message type, provider, destination, and deadline (1–3600 seconds).
Choose a simulated outcome and select **Run demo**. The timeline shows correlated
application evidence and the policy verdict.

All runs are explicitly marked **Simulated**. This version performs no broker
operations and does not contact real backends. Provider and destination are policy
labels in the demo; they do not need to exist in an emulator. Existing messaging
debugging features retain their current behavior.

## Evaluation contract

- **Passed:** publisher evidence and successful consumer processing evidence match
  the run's correlation ID, the same message ID, message type, provider, and
  destination, before the deadline.
- **Failed:** the expected consumer reports failure for the run's correlated flow.
- **Timed out:** the required evidence has not produced a terminal verdict by the
  deadline. Evidence arriving exactly at the deadline is late.
- **Running:** the required evidence is still incomplete.

Consumer evidence can arrive before publisher evidence. Duplicate publish events
do not count as successful processing. Evidence from another run, message,
service, provider, or destination cannot complete the policy. A terminal verdict
cannot be overwritten by a later event. Each run freezes its scenario's policy.

The demo uses one synthetic message per run. Successful and failing runs generate
two application events, while missing-consumer runs generate only the publish
event and wait for the configured deadline. The system does not infer processing
success from a message disappearing from a queue.

## Boundaries and storage

`E2eTestsController` validates HTTP requests, `E2eTestsService` persists and
orchestrates demo runs, and the pure `evaluatePolicy` function computes verdicts.
Shared TypeScript contracts live in `libs/shared/entities`; frontend responses are
validated with Zod. The React page polls run summaries and the selected live run.

Scenarios and runs use separate MongoDB collections. Run evidence is embedded and
bounded to the demo's two events. Revision-checked atomic updates prevent event
callbacks from overwriting deadline expiry or concurrent evidence. Unique IDs and
indexes support identity, recent-history reads, and deadline expiration without
requiring a replica set. List endpoints return the latest 100 scenarios and 50 run
summaries; summaries omit evidence. Historical timelines load separately.

Deadlines are server timestamps, with background expiration and a read-time check.
History survives restart. Simulation timers are intentionally in memory and stop
on shutdown; unfinished runs eventually time out after restart. This is a demo
runner, not a durable distributed workflow engine.

## HTTP endpoints

All paths are below `/api/v1/e2e-tests` and return `{ success, data }`:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/scenarios` | Latest 100 scenarios |
| POST | `/scenarios` | Save `{ name, policy }` |
| POST | `/scenarios/:id/demo-runs` | Start `{ outcome: "pass" \| "fail" \| "timeout" }` |
| GET | `/runs` | Latest 50 run summaries |
| GET | `/runs/:id` | Run snapshot, verdict, and evidence timeline |

Scenario and run identifiers are UUIDs. Unknown input fields, invalid providers,
invalid outcomes, and missing/out-of-range policies are rejected. There is no
public evidence-ingestion endpoint or arbitrary HTTP trigger in this version.

## Next integration increment

Replace the simulated event source with authenticated application evidence. A
publisher should report after broker acceptance, and a consumer after successful
business processing, propagating a shared correlation ID and message ID. Preserve
event IDs for idempotent retries. Keep simulated and real runs distinct.

Real monitoring also needs an observation-only worker configuration so the
dashboard never competes with the application consumer. Authentication, payload
assertions, a durable runner, pagination, and CI triggering belong to subsequent
increments; demo results must never be used as proof of a real finance workflow.

## Validation

Run `yarn nx affected -t lint typecheck test` for the changed projects and
`yarn nx e2e monitor-e2e` for browser coverage. Backend tests exercise identity
matching, out-of-order evidence, duplicates, deadlines, snapshots, failure,
concurrency, validation, and restart behavior. Browser tests cover saving policies,
preserving failed forms, and all three simulated outcomes.
