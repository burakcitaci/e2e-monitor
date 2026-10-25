import { expect, test } from '@playwright/test';

test('creating a broker topic sends no client ID after editing the form', async ({
  page,
}) => {
  let saved: Record<string, unknown> | undefined;
  await page.route('**/api/v1/message-resources/resources', async (route) => {
    if (route.request().method() === 'POST') {
      saved = route.request().postDataJSON();
      expect(saved).toEqual({
        name: 'new-topic',
        provider: 'aws',
        type: 'topic',
        status: 'active',
      });
      await route.fulfill({
        json: { success: true, data: { ...saved, id: 'server-id' } },
      });
    } else {
      await route.fulfill({
        json: {
          success: true,
          data: saved ? [{ ...saved, id: 'server-id' }] : [],
        },
      });
    }
  });
  await page.goto('/messaging-resources');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Name', { exact: true }).fill('new-topic');
  await sheet.getByRole('combobox').nth(1).click();
  await page.getByRole('option', { name: 'Topic', exact: true }).click();
  await sheet.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect(
    page.getByRole('cell', { name: 'new-topic', exact: true }),
  ).toBeVisible();
});

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
    page.getByText('persist their records in MongoDB.', {
      exact: false,
    }),
  ).toBeVisible();
  expect(brokerRequests).toEqual([]);
});

test('Azure topic provisioning includes subscriptions and preserves the form after broker failure', async ({
  page,
}) => {
  let attempts = 0;
  await page.route('**/api/v1/message-resources/resources', async (route) => {
    if (route.request().method() !== 'POST')
      return route.fulfill({ json: { success: true, data: [] } });
    const resource = route.request().postDataJSON();
    expect(resource).toEqual({
      name: 'payment-events',
      provider: 'azure',
      type: 'topic',
      status: 'active',
      subscriptions: ['logging-service'],
    });
    attempts++;
    if (attempts === 1)
      return route.fulfill({
        status: 502,
        json: { message: 'Broker unavailable; record not saved' },
      });
    return route.fulfill({
      json: { success: true, data: { ...resource, id: 'azure-topic' } },
    });
  });
  await page.goto('/messaging-resources');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Name', { exact: true }).fill('payment-events');
  await sheet.getByRole('combobox').first().click();
  await page.getByRole('option', { name: 'Azure', exact: true }).click();
  await sheet.getByRole('combobox').nth(1).click();
  await page.getByRole('option', { name: 'Topic', exact: true }).click();
  await sheet
    .getByLabel('Subscriptions (comma-separated)')
    .fill('logging-service');
  await sheet.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(
    page.getByText('Broker unavailable; record not saved'),
  ).toBeVisible();
  await expect(sheet).toBeVisible();
  await expect(sheet.getByLabel('Subscriptions (comma-separated)')).toHaveValue(
    'logging-service',
  );
  await sheet.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(sheet).toBeHidden();
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
