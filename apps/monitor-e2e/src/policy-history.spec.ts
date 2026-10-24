import { expect, test } from '@playwright/test';

test('time range reloads the policy chart and evidence from the same analysis', async ({
  page,
}) => {
  await page.route('**/api/v1/policies/history-test?*', async (route) => {
    const minutes = Number(
      new URL(route.request().url()).searchParams.get('minutes'),
    );
    const policy = {
      _id: 'history-test',
      name: 'Delivery monitor',
      namespace: 'local',
      sourceService: 'A',
      destinationService: 'B',
      destination: 'events',
      subscription: 'sub',
      thresholdSeconds: 1,
      requiredSuccessPercentage: 95,
      evaluationWindowMinutes: 30,
      minimumSampleCount: 1,
      enabled: true,
      effectiveFrom: '2026-10-24T12:00:00Z',
    };
    const analysis = {
      policyId: policy._id,
      thresholdSeconds: 1,
      requiredSuccessPercentage: 95,
      evaluatedAt: '2026-10-24T12:00:00Z',
      from: new Date(
        Date.parse('2026-10-24T12:00:00Z') - minutes * 60_000,
      ).toISOString(),
      to: '2026-10-24T12:00:00Z',
      status: 'pass',
      counts: {
        total: 1,
        eligible: 1,
        pending: 0,
        passed: 1,
        late: 0,
        missing: 0,
      },
      successPercentage: 100,
      p95Seconds: 0.5,
      messages: [
        {
          messageId: `range-${minutes}`,
          detailId: 'message',
          sentAt: '2026-10-24T11:59:00Z',
          receivedAt: '2026-10-24T11:59:00.500Z',
          latencySeconds: 0.5,
          outcome: 'passed',
        },
      ],
    };
    await route.fulfill({
      json: {
        success: true,
        data: { policy, latestEvaluation: analysis, evaluations: [], analysis },
      },
    });
  });
  await page.goto('/policies/history-test');
  await expect(
    page.getByRole('link', { name: 'range-30', exact: true }),
  ).toBeVisible();
  await page.getByLabel('Time range', { exact: true }).selectOption('10080');
  await expect(
    page.getByRole('link', { name: 'range-10080', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'range-30', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('region', { name: 'Selected range' }),
  ).toContainText('Last 1 week');
  await expect(
    page.getByRole('img', {
      name: 'Message delivery latency line chart compared with policy threshold',
    }),
  ).toBeVisible();
});
