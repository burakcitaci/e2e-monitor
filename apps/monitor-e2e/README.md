# Monitor E2E tests

Run `yarn test:e2e` (or `yarn nx e2e monitor-e2e`) after installing Chromium with
`yarn playwright install chromium`. The Playwright config starts or reuses the
frontend on port 4200. These tests mock API responses; they do not start MongoDB,
call Gemini, or publish/consume broker messages.

Coverage includes message lists and detail navigation, status polling, timing
statistics, mobile layouts, AI planning in both modes, saved chat history, retrying
failed history saves, and saved destination metadata. Collector checks ensure
broker send/receive controls stay absent.

For debugging, use `yarn nx e2e monitor-e2e --ui`, `--headed`, or `--grep`.
The config uses Chromium, two retries in CI and none locally, with traces on the
first retry. Browser output is stored in the project's ignored report folders.
Real Azure Service Bus verification belongs to the C# example and Docker setup.
