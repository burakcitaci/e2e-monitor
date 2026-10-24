import { expect, test } from '@playwright/test';

test('policy list preserves failed drafts, refreshes after creation, and opens details with the parent navigation active', async ({
  page,
}) => {
  let exists = false;
  let attempts = 0;
  const policy = {
    _id: 'new-policy',
    name: 'Financing delivery',
    namespace: 'local',
    sourceService: 'financing-api',
    destinationService: 'orders-consumer',
    destination: 'application-events',
    subscription: 'logging-service',
    thresholdSeconds: 1,
    requiredSuccessPercentage: 95,
    evaluationWindowMinutes: 30,
    minimumSampleCount: 1,
    enabled: true,
    effectiveFrom: '2026-10-24T12:00:00Z',
  };
  await page.route('**/api/v1/policies**', async (route) => {
    if (route.request().method() === 'POST') {
      attempts++;
      if (attempts === 1)
        return route.fulfill({
          status: 409,
          json: { message: 'An identical policy already exists' },
        });
      exists = true;
      return route.fulfill({ json: { success: true, data: policy } });
    }
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({
      json: {
        success: true,
        data: path.endsWith('/policies')
          ? exists
            ? [policy]
            : []
          : { policy, evaluations: [] },
      },
    });
  });
  await page.goto('/policies');
  await page
    .getByRole('button', { name: 'Create policy', exact: true })
    .click();
  const sheet = page.getByRole('dialog', { name: 'Create policy' });
  for (const [label, value] of [
    ['Policy name', policy.name],
    ['Publisher service', policy.sourceService],
    ['Subscriber service', policy.destinationService],
    ['Topic or queue', policy.destination],
    ['Subscription', policy.subscription],
  ])
    await sheet.getByLabel(label, { exact: true }).fill(value);
  await sheet
    .getByRole('button', { name: 'Create policy', exact: true })
    .click();
  await expect(
    page.getByText('An identical policy already exists', { exact: true }),
  ).toBeVisible();
  await expect(sheet).toBeVisible();
  await expect(sheet.getByLabel('Policy name')).toHaveValue(policy.name);
  await sheet
    .getByRole('button', { name: 'Create policy', exact: true })
    .click();
  await expect(sheet).toBeHidden();
  await page.getByRole('cell', { name: policy.name, exact: true }).click();
  await expect(page).toHaveURL(/\/policies\/new-policy$/);
  await expect(page.getByRole('heading', { name: policy.name })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Policies', exact: true }),
  ).toHaveAttribute('data-active', 'true');
  await page.getByRole('link', { name: 'Back to policies' }).click();
  await expect(
    page.getByRole('cell', { name: policy.name, exact: true }),
  ).toBeVisible();
});
