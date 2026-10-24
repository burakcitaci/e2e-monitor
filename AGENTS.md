# Agent guide

## Graphify (Code Intelligence)
- **Always query the Graphify knowledge graph first** using the `$graphify` tool or `graphify query` before opening, searching, or reading raw source files sequentially.
- Use `graphify path` to trace structural boundaries and connections between the NestJS backend and the React monitor.
- If you need to refresh the graph after making structural changes, run `graphify update . --code-only` to sync `graphify-out/graph.json` without consuming LLM extraction tokens.

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
- `yarn graph:update` — `graphify update . --code-only` (Updates the code intelligence index).

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
- **Do not bypass Graphify** by running full-repository `grep` or heavy text-searches if the architecture can be resolved via the index.
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

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
