import { expect, test } from '@playwright/test';

test('shows saved destination metadata without querying brokers', async ({
  page,
}) => {
  const brokerRequests: string[] = [];
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.includes('/aws-sqs/') || path.includes('/service-bus/'))
      brokerRequests.push(path);
    await route.fulfill({
      json: {
        success: true,
        data: path.endsWith('/message-resources/resources')
          ? [
              {
                id: 'saved-orders',
                name: 'orders',
                provider: 'aws',
                type: 'queue',
                status: 'active',
              },
            ]
          : [],
      },
    });
  });
  await page.goto('/messaging-resources');
  await expect(
    page.getByRole('cell', { name: 'orders', exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByText('This does not create or modify broker resources.', {
      exact: false,
    }),
  ).toBeVisible();
  expect(brokerRequests).toEqual([]);
});

test('collector has no send or settlement controls and redirects retired broker dashboards', async ({
  page,
}) => {
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({ json: { success: true, data: [] } }),
  );
  for (const path of ['/sqs', '/azure-service-bus']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole('button', { name: 'Open Messaging Chat', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Send message', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Receive / settle' }),
    ).toHaveCount(0);
  }
});
