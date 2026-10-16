import { expect, test } from '@playwright/test';

test('initial route avoids loading thousands of individual icon modules', async ({
  page,
}) => {
  const scriptRequests: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'script') scriptRequests.push(request.url());
  });
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: { configured: false, model: 'gpt-4.1-mini' },
      },
    }),
  );
  const started = Date.now();
  await page.goto('/chat');
  await expect(
    page.getByRole('heading', { name: 'Messaging Chat', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('log', { name: 'Conversation' })).toBeVisible();
  const iconModules = scriptRequests.filter((url) =>
    url.includes('/@tabler/icons-react/dist/'),
  );
  console.log(
    JSON.stringify({
      routeReadyMs: Date.now() - started,
      scriptRequests: scriptRequests.length,
      individualIconModules: iconModules.length,
    }),
  );
  // Check the request fan-out rather than a machine-dependent timing threshold.
  expect(iconModules.length).toBeLessThan(10);
});
