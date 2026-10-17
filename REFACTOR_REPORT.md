# Backend cleanup

## Changes

- Replaced `any` with `unknown` in `AppLogger` inputs and validation error arrays; removed the corresponding lint suppressions and a redundant `Error` cast.
- Named existing chat pagination, storage, entry, title-length and Mongo duplicate-key constants inside `chat-history.service.ts`.
- Named the existing default delivery timeout inside `pending-deliveries.service.ts`.
- Formatted only touched files. Preserved logging branches, query values, error strings, DTOs, routes, payloads and dependency wiring.

## Moved files

None. Existing app folders and modules remain in place. No libraries, dependencies or abstractions were added. Existing tests and expectations were not edited.

## Verification

- Before and after: `nx run-many -t lint test build --projects=backend --output-style=static` passed, including all 10 backend suites / 67 tests and the shared entities build prerequisite.
- Repository-required verification also passed: `nx run-many -t lint typecheck test build --output-style=static` (4 projects, 12 tasks; includes 35 frontend tests).
- Logs: `tmp/backend-cleanup-baseline.log` and `tmp/backend-cleanup-after.log` (ignored local artifacts).
- Used the installed Nx entry point through Node, with `NX_DAEMON=false`, `NX_NO_CLOUD=true`, `NX_ISOLATE_PLUGINS=false`, and a workspace-local temporary directory. The initial sandbox attempt encountered native-module loading errors; the successful before/after runs used the same environment with the necessary process access.

## Findings (not applied)

- Logger data is included only when truthy: `false`, `0` and empty strings are omitted. JSON serialization of circular objects or BigInt data can throw. These existing behaviors remain unchanged.
- `AwsSqsService` exceeds 600 lines and combines polling, queue lookup/creation, sending and error handling. A later split within the existing module deserves a separate decision and focused lifecycle tests.
- SQS constructs the plain `MessageProcessor` helper directly. Converting it to an injected provider would change wiring and test setup; left untouched for this small cleanup.
- No dedicated logger or message-resource service test files were found. Existing chat-history and pending-delivery tests cover the constant-related cleanup.
- Existing Nx/Vite/Jest deprecation and toolchain warnings remain; no dependency or configuration updates were applied.

Potentially unused exported exceptions and providers were retained because absence of an in-repository caller alone is insufficient evidence to remove them safely.
