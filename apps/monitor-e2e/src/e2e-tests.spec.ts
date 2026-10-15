import { expect, test } from '@playwright/test';
import type { TestRun, TestScenario } from '@e2e-monitor/entities';

const scenario: TestScenario = {
  id: '817ed540-d354-4be9-8042-deb1a4975efa',
  name: 'Finance payment flow',
  policy: {
    publisher: 'finance-api',
    consumer: 'payment-worker',
    messageType: 'PaymentRequested',
    provider: 'sqs',
    destination: 'payments',
    timeoutSeconds: 2,
  },
  createdAt: '2026-10-15T10:00:00.000Z',
};

for (const [outcome, label] of [
  ['pass', 'Passed'],
  ['fail', 'Failed'],
  ['timeout', 'Timed out'],
] as const) {
  test(`E2E demo evaluates ${outcome} and displays correlated evidence`, async ({
    page,
  }) => {
    let run: TestRun | undefined;
    await page.route('**/api/v1/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      let data: unknown = [];
      if (path.endsWith('/scenarios')) data = [scenario];
      else if (path.endsWith('/demo-runs')) {
        expect(route.request().postDataJSON()).toEqual({ outcome });
        run = {
          id: 'c483bfbd-080e-4f28-840c-23f247b2a8a3',
          mode: 'demo',
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          policy: scenario.policy,
          correlationId: '56b6a6a9-a329-4838-a20e-9b9cce8ca257',
          status: 'running',
          reason: 'Waiting for evidence.',
          startedAt: scenario.createdAt,
          deadlineAt: '2026-10-15T10:00:02.000Z',
          evidence: [],
        };
        data = run;
      } else if (path.endsWith('/runs')) data = run ? [run] : [];
      else if (path.includes('/runs/') && run) {
        run.status =
          outcome === 'pass'
            ? 'passed'
            : outcome === 'fail'
              ? 'failed'
              : 'timed_out';
        run.reason =
          outcome === 'pass'
            ? 'Matching message processed.'
            : outcome === 'fail'
              ? 'Consumer reported failure.'
              : 'The deadline expired.';
        run.evidence = [
          {
            eventId: 'published',
            kind: 'published',
            service: scenario.policy.publisher,
            correlationId: run.correlationId,
            messageId: 'payment-42',
            messageType: scenario.policy.messageType,
            provider: 'sqs',
            destination: 'payments',
            receivedAt: scenario.createdAt,
            detail: 'Simulated publisher event.',
          },
        ];
        if (outcome !== 'timeout')
          run.evidence.push({
            ...run.evidence[0],
            eventId: 'consumer',
            service: scenario.policy.consumer,
            kind: outcome === 'pass' ? 'processed' : 'failed',
            detail: 'Simulated consumer event.',
          });
        data = run;
      }
      await route.fulfill({ json: { success: true, data } });
    });
    await page.goto('/e2e-tests');
    await expect(
      page.getByText('Demo mode — simulated backends'),
    ).toBeVisible();
    await page.getByLabel('Simulated outcome').selectOption(outcome);
    await page.getByRole('button', { name: 'Run demo', exact: true }).click();
    const timeline = page.getByRole('region', { name: 'Run timeline' });
    await expect(timeline.getByRole('status')).toContainText(label, {
      timeout: 10000,
    });
    await expect(timeline).toContainText(
      '56b6a6a9-a329-4838-a20e-9b9cce8ca257',
    );
    await expect(timeline).toContainText('finance-api · published');
    await expect(
      timeline
        .getByRole('list', { name: 'Evidence timeline' })
        .getByRole('listitem'),
    ).toHaveCount(outcome === 'timeout' ? 1 : 2);
    await expect(timeline).toContainText('payment-42');
  });
}

test('E2E scenario form saves policy values and preserves them on failure', async ({
  page,
}) => {
  let reject = true;
  await page.route('**/api/v1/**', async (route) => {
    if (route.request().method() === 'POST') {
      expect(route.request().postDataJSON()).toEqual({
        name: 'Finance demo policy',
        policy: { ...scenario.policy, timeoutSeconds: 5 },
      });
      if (reject) {
        await route.fulfill({
          status: 503,
          json: { message: 'Storage unavailable' },
        });
        return;
      }
      await route.fulfill({ json: { success: true, data: scenario } });
      return;
    }
    await route.fulfill({ json: { success: true, data: [] } });
  });
  await page.goto('/e2e-tests');
  await page
    .getByLabel('Scenario name', { exact: true })
    .fill('Finance demo policy');
  await page.getByLabel('Deadline (seconds)', { exact: true }).fill('5');
  await page
    .getByRole('button', { name: 'Save scenario', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('Storage unavailable');
  await expect(page.getByLabel('Scenario name', { exact: true })).toHaveValue(
    'Finance demo policy',
  );
  reject = false;
  await page
    .getByRole('button', { name: 'Save scenario', exact: true })
    .click();
  await expect(
    page.getByText('Scenario saved.', { exact: true }),
  ).toBeVisible();
});
