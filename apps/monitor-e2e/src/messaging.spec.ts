import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  let settled = false;
  let pollCount = 0;
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.includes('/settle/')) {
      settled = true;
      await route.fulfill({ json: { success: true, data: {} } });
    } else if (path.endsWith('/tracked-messages/tracking')) {
      pollCount += 1;
      await route.fulfill({
        json: {
          success: true,
          data: [
            {
              _id: '507f1f77bcf86cd799439011',
              messageId: 'message-1',
              body: 'hello dashboard',
              sentBy: 'browser-test',
              sentAt: new Date(Date.UTC(2026, 9, 15, 0, 0, pollCount)).toISOString(),
              emulatorType: 'azure-service-bus',
              queue: 'orders',
              status: settled ? 'received' : 'processing',
              disposition: settled ? 'complete' : undefined,
              pendingDeliveries: settled
                ? []
                : [
                    {
                      token: 'live-token',
                      queue: 'orders',
                      expiresAt: '2099-01-01T00:00:00Z',
                    },
                  ],
            },
          ],
        },
      });
    } else if (path.endsWith('/service-bus/config')) {
      await route.fulfill({
        json: {
          success: true,
          data: {
            UserConfig: {
              Namespaces: [
                {
                  Name: 'local',
                  Queues: [
                    {
                      Name: 'orders',
                      Properties: {
                        DefaultMessageTimeToLive: 'PT1H',
                        MaxDeliveryCount: 10,
                        DeadLetteringOnMessageExpiration: true,
                      },
                    },
                  ],
                  Topics: [
                    {
                      Name: 'events',
                      Properties: {
                        DefaultMessageTimeToLive: 'PT1H',
                        DuplicateDetectionHistoryTimeWindow: 'PT20S',
                        RequiresDuplicateDetection: false,
                      },
                      Subscriptions: [],
                    },
                  ],
                },
              ],
              Logging: { Type: 'console' },
            },
          },
        },
      });
    } else if (path.endsWith('/aws-sqs/config')) {
      await route.fulfill({
        json: {
          success: true,
          data: {
            endpoint: 'http://custom-host:4566',
            region: 'us-east-1',
            queueName: 'default-orders',
          },
        },
      });
    } else if (path.endsWith('/message-resources/resources')) {
      await route.fulfill({
        json: {
          success: true,
          data: [
            {
              id: 'saved-queue',
              provider: 'aws',
              type: 'queue',
              status: 'active',
              name: 'saved-orders',
            },
          ],
        },
      });
    } else if (
      route.request().method() === 'POST' &&
      path.endsWith('/messages')
    ) {
      await route.fulfill({
        json: {
          success: true,
          data: {
            queueName: 'orders',
            messageId: 'new-message',
            queueUrl: 'http://custom-host/orders',
            md5OfBody: 'test-hash',
          },
        },
      });
    } else {
      await route.fulfill({ json: { success: true, data: [] } });
    }
  });
  await page.goto('/');
});

test('send to an Azure topic and an AWS queue from the unified dialog', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Send message' });
  await dialog
    .getByRole('combobox', { name: 'Destination type', exact: true })
    .click();
  await page.getByRole('option', { name: 'Topic', exact: true }).click();
  await dialog
    .getByRole('combobox', { name: 'Destination', exact: true })
    .click();
  await page.getByRole('option', { name: 'events', exact: true }).click();
  await dialog
    .getByRole('textbox', { name: 'Message body' })
    .fill('hello azure');
  const azureRequest = page.waitForRequest(
    (request) =>
      request.method() === 'POST' &&
      request.url().endsWith('/service-bus/messages'),
  );
  await dialog
    .getByRole('button', { name: 'Send message', exact: true })
    .click();
  expect((await azureRequest).postDataJSON()).toEqual({
    queue: 'events',
    body: 'hello azure',
  });
  await expect(dialog).toBeHidden();

  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Send message' });
  await dialog.getByRole('combobox', { name: 'Provider' }).click();
  await page.getByRole('option', { name: 'AWS SQS' }).click();
  await dialog
    .getByRole('combobox', { name: 'Destination', exact: true })
    .click();
  await page.getByRole('option', { name: 'saved-orders', exact: true }).click();
  await dialog.getByRole('textbox', { name: 'Message body' }).fill('hello aws');
  const awsRequest = page.waitForRequest(
    (request) =>
      request.method() === 'POST' &&
      request.url().endsWith('/aws-sqs/messages'),
  );
  await dialog
    .getByRole('button', { name: 'Send message', exact: true })
    .click();
  expect((await awsRequest).postDataJSON()).toEqual({
    queueName: 'saved-orders',
    body: 'hello aws',
  });
  await expect(dialog).toBeHidden();
});

for (const [label, disposition] of [
  ['Complete (receive)', 'complete'],
  ['Abandon', 'abandon'],
  ['Defer', 'defer'],
  ['Dead-letter (DLQ)', 'deadletter'],
]) {
  test(`table action: ${label}`, async ({ page }) => {
    await page.getByRole('button', { name: 'Receive / settle' }).click();
    // A polling refresh must not unmount the open action menu.
    await page.waitForResponse((response) => response.url().endsWith('/tracked-messages/tracking'));
    await expect(page.getByRole('menuitem', { name: label, exact: true })).toBeVisible();
    const actionRequest = page.waitForRequest(
      (request) =>
        request.method() === 'POST' &&
        request.url().includes('/settle/live-token'),
    );
    await page.getByRole('menuitem', { name: label, exact: true }).click();
    expect((await actionRequest).postDataJSON()).toEqual({ disposition });
    await expect(page.getByText('History', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Receive / settle' }),
    ).toBeHidden();
  });
}
