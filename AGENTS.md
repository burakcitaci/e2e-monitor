# Agent guide

## Graphify (Code Intelligence)
- Use the existing graph once at the start of a coherent code investigation or refactoring task to locate relevant symbols and dependencies. Reuse that context throughout the task; do not repeat queries for each follow-up, file read, edit, or test.
- Skip a ceremonial query when the current task has already established the relevant files and relationships. Re-query only for a new dependency question, a scope change, or evidence that the graph is stale or incomplete.
- Start with an exact symbol and `graphify query "<symbol>" --budget 300`. Prefer `graphify path "<A>" "<B>"` for connections and `graphify explain "<symbol>"` for a focused concept. Narrow noisy queries before increasing their budget; never request a whole traversal just because output was truncated.
- After navigation, read only relevant source sections and use targeted `rg` searches for implementation details. Avoid dumping whole files, the raw graph, reports, vocabulary lists, or saved conversations into context. Read architecture reports only for an architecture task that needs them.
- Keep the existing automatic post-commit hook. It runs a local code-only rebuild in the background without LLM extraction tokens. Do not also rebuild after every edit or query. Run `yarn graph:update` once before a commit only when structural changes must be indexed to answer a concrete question; otherwise let the hook refresh the graph.
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
- `yarn graph:update` — `graphify update .` (Local code-only index refresh; normally handled by the post-commit hook).

## Conventions
- Register lazy feature routes in `apps/monitor/src/app/app.tsx`; page entry points live in `features/<feature>/index.tsx`.
- Keep page selection in local state and pass data, pending flags, and actions into child components; see `apps/monitor/src/app/features/e2e-tests/index.tsx`.
- API hooks have multiple locations; prefer feature-local `api/hooks.ts` for new features, following `apps/monitor/src/app/features/e2e-tests/api/hooks.ts`; shared tracking hooks remain in `apps/monitor/src/app/hooks/api/tracking-messages.ts`.
- Give queries stable keys, guard dependent queries with `enabled`, and invalidate affected queries after mutations; see `apps/monitor/src/app/features/e2e-tests/api/hooks.ts`.
- Put HTTP requests and response validation in the shared `apiClient`; preserve `ApiError` handling and Zod parsing (`apps/monitor/src/app/lib/api-client.ts`).
- Test query hooks with a fresh QueryClient, retries disabled, mocked apiClient, and `renderHook`/`waitFor`; see `apps/monitor/src/app/hooks/api/__tests__/tracking-messages.test.tsx`.
- Preserve backend URI versioning and DTO validation: unknown fields are rejected; see `apps/backend/src/main.ts`.
- Follow Nx module boundaries and React lint presets; Prettier specifies single quotes (`eslint.config.mjs`, `apps/monitor/eslint.config.mjs`, `.prettierrc`).

## Do not
- Do not run full-repository searches when the task's graph context or established file locations already narrow the scope.
- Do not add dependencies or state libraries unless requested; use the stack in `package.json`.
- Do not change public hook signatures unless the task requires it; preserve callers and hook tests.
- Do not run repo-wide formatters or autofix; format only touched files using `.prettierrc`.
- Do not rewrite unrelated components when changing a feature; keep the boundaries shown in `apps/monitor/src/app/features/e2e-tests/index.tsx`.
- Do not present E2E demo runs as real broker integration results; see `README.md` and `apps/monitor/src/app/features/e2e-tests/index.tsx`.

## File map
No root `src/`; source folders are scoped to workspace projects.
- `graphify-out/` — Local code intelligence graph storage (`graph.json`).
- `apps/monitor/src/app/components/` — Shared UI primitives, layout, and table components.
- `apps/monitor/src/app/features/` — Feature pages with local components and API hooks.
- `apps/monitor/src/app/hooks/` — Shared UI hooks and tracking message queries.
- `apps/monitor/src/app/lib/` — API client, schemas, configuration, and formatting helpers.
- `apps/monitor/src/app/types/` — Shared frontend data table type definitions.
- `apps/backend/src/app/` — NestJS domain modules, controllers, services, DTOs, and tests.
- `apps/monitor/src/assets/` — Static monitor assets, separate from application code.
- `apps/backend/src/assets/` — Static backend assets, separate from application code.
- `libs/shared/entities/src/lib/` — Shared message and E2E domain type definitions.
- `apps/monitor-e2e/src/` — Playwright browser scenarios covering dashboard feature flows.

## Verification
- Run `yarn verify` (lint, typecheck, unit tests, builds) before declaring code changes done.
- Run `yarn test:e2e` for browser flows; CI runs both on PRs (`.github/workflows/ci.yml`).
- Install Chromium with `yarn playwright install chromium` if needed; see `README.md` and `apps/monitor-e2e/README.md`.
