import { expect, test } from '@playwright/test';

test('application reports progress from sent to received and complete on polling', async ({
  page,
}) => {
  let phase: 'sent' | 'received' | 'completed' = 'sent';
  let polls = 0;
  const captureId = '1c0b1ac8-f2c6-422e-9921-3e438801b2d1';
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/tracked-messages/tracking')) {
      polls++;
      await route.fulfill({
        json: {
          success: true,
          data: [
            {
              _id: 'capture-row',
              messageId: 'broker-id',
              captureId,
              namespace: 'localhost',
              trackingSource: 'capture',
              body: 'Hello from financing',
              sentBy: 'financing-api',
              sentAt: '2026-10-22T19:00:00Z',
              emulatorType: 'azure-service-bus',
              queue:
                phase === 'sent'
                  ? 'application-events'
                  : 'application-events/subscriptions/logging-service',
              status: phase === 'sent' ? 'sent' : 'received',
              receivedBy: phase === 'sent' ? undefined : 'orders-consumer',
              receivedAt:
                phase === 'sent' ? undefined : '2026-10-22T19:00:00.100Z',
              disposition: phase === 'completed' ? 'complete' : undefined,
              completedAt:
                phase === 'completed' ? '2026-10-22T19:00:00.200Z' : undefined,
            },
          ],
        },
      });
    } else {
      await route.fulfill({ json: { success: true, data: [] } });
    }
  });
  await page.goto('/');
  const row = page.getByRole('row').filter({ hasText: 'Hello from financing' });
  await expect(row).toContainText('financing-api');
  await expect(row).toContainText('Application report');
  await expect(row.getByText('Sent', { exact: true })).toBeVisible();
  await expect(
    row.getByRole('link', { name: 'Hello from financing' }),
  ).toHaveAttribute('href', '/messages/capture-row');
  await expect(
    row.getByRole('button', { name: 'Receive / settle' }),
  ).toHaveCount(0);
  phase = 'received';
  await expect(row).toContainText('orders-consumer', { timeout: 10000 });
  await expect(row.getByText('Received', { exact: true })).toBeVisible();
  await expect(row.getByText('Completed', { exact: true })).toHaveCount(0);
  phase = 'completed';
  await expect(row.getByText('Completed', { exact: true })).toBeVisible({
    timeout: 10000,
  });
  await expect(row.getByText('Received', { exact: true })).toHaveCount(0);
  await expect(row.getByText('Complete', { exact: true })).toHaveCount(0);
  expect(polls).toBeGreaterThanOrEqual(3);
});
