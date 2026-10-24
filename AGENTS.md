# Agent Guide & Cost Optimization

## Response Budget & Cost Reduction (Strict)
- **Be concise:** Provide direct, production-ready code implementations immediately. Avoid conversational filler, preambles, and repetitive post-code summaries.
- **Explanation Limit:** Limit explanatory or architectural commentary to a maximum of 3 lines per response.
- **No Unsolicited Scans:** Do not execute full-repository searches, broad `grep`/`rg` commands, or structural directory listings unless specifically requested or required for the immediate task.
- **Use Diffs:** Present code updates as compact, targeted Git-style diffs or specific function rewrites instead of outputting entire unchanged files. This directly reduces output token costs.

## Graphify (Code Intelligence)
- Use the existing graph once at the start of a coherent code investigation or refactoring task to locate relevant symbols and dependencies. Reuse that context throughout the task; do not repeat queries for each follow-up, file read, edit, or test.
- Skip a ceremonial query when the current task has already established the relevant files and relationships. Re-query only for a new dependency question, a scope change, or evidence that the graph is stale or incomplete.
- Start with an exact symbol and `graphify query "<symbol>" --budget 300`. Prefer `graphify path "<A>" "<B>"` for connections and `graphify explain "<symbol>"` for a focused concept. Narrow noisy queries before increasing their budget; never request a whole traversal just because output was truncated.
- After navigation, read only relevant source sections and use targeted `rg` searches for implementation details. Avoid dumping whole files, the raw graph, reports, vocabulary lists, or saved conversations into context. Read architecture reports only for an architecture task that needs them.
- Keep the Husky pre-commit hook. It runs `graphify . --code-only` synchronously without LLM extraction tokens and blocks the commit if indexing fails. Do not also rebuild after every edit or query. Run `yarn graph:update` manually only when structural changes must be indexed to answer a concrete question; otherwise let the hook refresh the graph.
- The installed CLI's `graphify update .` is code-only and preserves existing semantic content. It does not accept `--code-only`. Do not run semantic extraction or LLM labeling as routine maintenance.
- When a graph query produces a reusable finding, save a concise note with symbols, source references, conclusion, and outcome (`useful`, `dead_end`, or `corrected`). Target 150 words or fewer; never save full prompts, transcripts, source dumps, or tool logs. Inspect only relevant notes or short lessons on later tasks.
- Treat `graphify-out/` as ignored local output. Do not stage graphs, reports, memory, caches, or backups unless explicitly requested. Keep dependency and generated-output folders excluded from indexing.
- Graph construction cost and Codex conversation usage are different. Do not claim measured token savings without a comparison; a graph query is useful when it reduces subsequent exploration.
- Explicit user requests to use Graphify take precedence. When `/graphify` is invoked, follow the installed skill for the requested operation.

## Stack
- Nx + Yarn workspaces: React monitor, NestJS API, Mongoose persistence; see `package.json` and `README.md`.
- Strict TypeScript; no path aliases in root configs. Use `.nvmrc` for Node; see `tsconfig.base.json`.
- Routing: `react-router`; server state: `@tanstack/react-query`; UI state: React hooks/context (`apps/monitor/src/app/providers.tsx`).
- Styling: `tailwindcss`, `class-variance-authority`, `clsx`, `tailwind-merge`; primitives include `@radix-ui/react-dialog` (`apps/monitor/package.json`).
- Testing: `vitest`, `@testing-library/react`, `jsdom` (monitor), `jest` + `@swc/jest` (backend), `@playwright/test` (browser).
- Builds: Nx orchestrates `vite` (monitor) and `webpack` (backend); see [README.md](README.md) for setup and configuration.

## Commands
- `yarn dev` — serve backend and monitor together.
- `yarn build` — `nx run-many -t build`.
- `yarn test` — `nx run-many -t test`.
- `yarn lint` — `nx run-many -t lint`.
- `yarn typecheck` — `nx run-many -t typecheck`.
- `yarn graph:update` — `graphify update .` (Manual local code-only index refresh; Husky rebuilds the graph before commits).
- `yarn verify` — Comprehensive workspace verification pipeline running lint, typecheck, and unit tests sequentially.

## Conventions
- Register lazy feature routes in `apps/monitor/src/app/app.tsx`; page entry points live in `features/<feature>/index.tsx`.
- Feature entry points compose pages in `index.tsx`; use `components/` for presentation, `api/hooks.ts` for server state, and `lib/` for pure domain helpers. Separate list and detail features consistently (`messages`/`message-detail`, `policies`/`policy-detail`).
- Keep page selection and form state local; pass data, pending flags, and actions into child components. Use shared `PageHeader`, `PageSection`, `BackLink`, and `PageState` from `components/common/Page.tsx` for common presentation.
- Prefer feature-local `api/hooks.ts` for new requests, following `apps/monitor/src/app/features/policies/api/hooks.ts`; shared tracking hook signatures remain in `apps/monitor/src/app/hooks/api/tracking-messages.ts`.
- Give queries stable keys, guard dependent queries with `enabled`, and invalidate affected queries after mutations. Reuse domain mutation hooks across list pages and chat previews so all callers refresh the same cache.
- Keep the application shell in `components/layout/`; labels, page titles, and active-route matching are shared through `lib/navigation.ts`.
- Put HTTP requests and response validation in the shared `apiClient`; preserve `ApiError` handling and Zod parsing (`apps/monitor/src/app/lib/api-client.ts`).
- Test query hooks with a fresh QueryClient, retries disabled, mocked apiClient, and `renderHook`/`waitFor`; see `apps/monitor/src/app/hooks/api/__tests__/tracking-messages.test.tsx`.
- Keep backend startup in `src/bootstrap/`, environment configuration in `src/app/config/`, and MongoDB setup in `src/app/database/`. `main.ts` handles only process startup and fatal errors; `AppModule` composes modules.
- Shared backend request infrastructure belongs in `common/http/`; shared logging belongs in `common/logging/`. Domain modules retain their own controllers, services, DTOs, schemas, and tests.
- Preserve backend URI versioning, serialization, CORS, and DTO validation: unknown fields are rejected. Production and HTTP contract tests use `apps/backend/src/bootstrap/configure-application.ts`.
- Follow Nx module boundaries and React lint presets; Prettier specifies single quotes (`eslint.config.mjs`, `apps/monitor/eslint.config.mjs`, `.prettierrc`).

## Do not
- Do not run full-repository searches when the task's graph context or established file locations already narrow the scope.
- Do not add dependencies or state libraries unless requested; use the stack in `package.json`.
- Do not change public hook signatures unless the task requires it; preserve callers and hook tests.
- Do not run repo-wide formatters or autofix; format only touched files using `.prettierrc`.
- Do not rewrite unrelated components when changing a feature; keep feature-specific logic local and share only components with concrete reuse.
- Do not present mocked browser tests as real broker integration results; see `README.md` and `apps/monitor-e2e/src/`.

## File map
No root `src/`; source folders are scoped to workspace projects.
- `graphify-out/` — Local code intelligence graph storage (`graph.json`).
- `apps/monitor/src/app/components/` — Shared UI primitives, layout, and table components.
- `apps/monitor/src/app/components/layout/` — Application sidebar, navigation, and site header.
- `apps/monitor/src/app/features/` — Feature pages with local components and API hooks.
- `apps/monitor/src/app/hooks/` — Shared UI hooks and tracking message queries.
- `apps/monitor/src/app/lib/` — API client, schemas, configuration, and formatting helpers.
- `apps/monitor/src/app/types/` — Shared frontend data table type definitions.
- `apps/backend/src/app/` — NestJS domain modules, controllers, services, DTOs, and tests.
- `apps/backend/src/bootstrap/` — Nest startup and shared HTTP configuration.
- `apps/backend/src/app/config/` — Environment validation, typed settings, and AI broker metadata.
- `apps/backend/src/app/database/` — Named MongoDB connection setup.
- `apps/backend/src/app/common/http/` and `common/logging/` — Shared HTTP providers and logger.
- `apps/monitor/src/assets/` — Static monitor assets, separate from application code.
- `apps/backend/src/assets/` — Static backend assets, separate from application code.
- `libs/shared/entities/src/lib/` — Shared message and E2E domain type definitions.
- `apps/monitor-e2e/src/` — Playwright browser scenarios covering dashboard feature flows.

## Verification
- Run `yarn verify` to execute linting, typechecking, and the standard test suites across the workspace before declaring a task complete.
