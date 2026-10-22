import { expect, test } from '@playwright/test';

const id = 'a'.repeat(64);
const message = {
  _id: id,
  detailId: id,
  trackingSource: 'capture',
  captureId: 'capture-123',
  messageId: 'broker-123',
  namespace: 'localhost',
  sentBy: 'financing-api',
  body: '{"amount":42}',
  queue: 'application-events',
  emulatorType: 'azure-service-bus',
  sentAt: '2026-10-22T19:00:00Z',
  status: 'received',
  receivedBy: 'orders-consumer',
  disposition: 'complete',
  deliveries: [
    {
      service: 'orders-consumer',
      subscription: 'logging-service',
      receivedAt: '2026-10-22T19:00:00.100Z',
      completedAt: '2026-10-22T19:00:00.150Z',
    },
    {
      service: 'analytics',
      subscription: 'analytics-processor',
      receivedAt: '2026-10-22T19:00:00.300Z',
    },
  ],
};

test('compact list opens a refreshable message detail with payload, subscriber analysis and timeline', async ({
  page,
}) => {
  let complete = false;
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith(`/tracking/${id}`)) {
      const data = structuredClone(message);
      if (complete) data.deliveries[1].completedAt = '2026-10-22T19:00:00.400Z';
      await route.fulfill({ json: { success: true, data } });
    } else {
      await route.fulfill({
        json: {
          success: true,
          data: url.pathname.endsWith('/tracking') ? [message] : [],
        },
      });
    }
  });
  await page.goto('/');
  await expect(page.getByRole('columnheader')).toHaveCount(6);
  const row = page.getByRole('row').filter({ hasText: '{"amount":42}' });
  await expect(row.getByText('Completed', { exact: true })).toBeVisible();
  await expect(row.getByText('Received', { exact: true })).toHaveCount(0);
  await row.getByRole('cell').filter({ hasText: 'application-events' }).click();
  await expect(page).toHaveURL(new RegExp(`/messages/${id}$`));
  await expect(
    page.getByRole('heading', { name: 'Message details' }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Completed', exact: true }),
  ).toContainText('1 / 2');
  await expect(
    page.getByRole('region', { name: 'Average delivery time' }),
  ).toContainText('200 ms');
  await expect(
    page.getByRole('region', { name: 'Average processing time' }),
  ).toContainText('50 ms');
  await expect(page.getByText('capture-123', { exact: true })).toBeVisible();
  await expect(page.locator('pre')).toContainText('"amount": 42');
  await expect(
    page.getByRole('heading', { name: 'Reported timeline' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('region', { name: 'Completed', exact: true }),
  ).toContainText('1 / 2');
  complete = true;
  await expect(
    page.getByRole('region', { name: 'Completed', exact: true }),
  ).toContainText('2 / 2', { timeout: 10000 });
  await page.getByRole('link', { name: 'Back to messages' }).click();
  await expect(page).toHaveURL(/\/$/);
  const restoredRow = page
    .getByRole('row')
    .filter({ hasText: '{"amount":42}' });
  await restoredRow.focus();
  await restoredRow.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/messages/${id}$`));
});

test('a missing detail shows a useful not-found state', async ({ page }) => {
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({ status: 404, json: { message: 'Message not found' } }),
  );
  await page.goto('/messages/missing');
  await expect(
    page.getByRole('heading', { name: 'Message not found' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Back to messages' }),
  ).toBeVisible();
});

test('mobile detail handles missing reports and inconsistent clocks', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          ...message,
          deliveries: [
            {
              service: 'B',
              subscription: 'logging-service',
              receivedAt: '2026-10-22T18:59:59Z',
            },
          ],
        },
      },
    }),
  );
  await page.goto(`/messages/${id}`);
  await expect(page.getByRole('alert')).toContainText('Clock inconsistency');
  await expect(
    page.getByRole('region', { name: 'Average delivery time' }),
  ).toContainText('Not available');
  await expect(
    page.getByRole('region', { name: 'Completed', exact: true }),
  ).toContainText('0 / 1');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
