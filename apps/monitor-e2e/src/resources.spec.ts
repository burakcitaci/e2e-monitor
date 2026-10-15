import { expect, test } from '@playwright/test';

const saved = { id: 'saved-orders', name: 'orders', provider: 'aws', type: 'queue', status: 'active' };

test('shows live SQS queues alongside saved resources without duplicate rows', async ({ page }) => {
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const data = path.endsWith('/aws-sqs/queues')
      ? [{ ...saved, id: 'aws-sqs:orders' }, { ...saved, id: 'aws-sqs:external', name: 'external-queue' }]
      : path.endsWith('/message-resources/resources') ? [saved] : [];
    await route.fulfill({ json: { success: true, data } });
  });
  await page.goto('/messaging-resources');
  await expect(page.getByRole('cell', { name: 'external-queue', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'orders', exact: true })).toHaveCount(1);
  await expect(page.getByRole('row').filter({ hasText: 'external-queue' })).toContainText('Discovered in SQS');
});

test('keeps saved resources visible and supports retry when SQS discovery fails', async ({ page }) => {
  let offline = true;
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/aws-sqs/queues') && offline) {
      await route.fulfill({ status: 503, json: { message: 'SQS unavailable' } });
      return;
    }
    await route.fulfill({ json: { success: true, data: path.endsWith('/message-resources/resources') ? [saved] : [] } });
  });
  await page.goto('/messaging-resources');
  await expect(page.getByRole('alert')).toContainText('Could not load SQS queues', { timeout: 15000 });
  await expect(page.getByRole('cell', { name: 'orders', exact: true })).toBeVisible();
  offline = false;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('alert')).toBeHidden();
});
