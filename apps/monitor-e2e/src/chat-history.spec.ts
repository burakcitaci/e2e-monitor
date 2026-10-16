import { expect, test } from '@playwright/test';
import { installChatHistory } from './chat-history.mock';

test('saves chats across reloads, restores the mode and resumes selected history without old send buttons', async ({
  page,
}) => {
  let plans = 0;
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = [];
    if (path.endsWith('/messaging-chat/status'))
      data = { configured: true, model: 'gemini-3.5-flash-lite' };
    else if (path.endsWith('/messaging-chat/messages/tools')) {
      plans++;
      if (plans === 2)
        expect(JSON.stringify(route.request().postDataJSON())).toContain(
          'Remember payment',
        );
      data = {
        reply:
          plans === 1 ? 'Payment draft prepared' : 'Continued the saved chat',
        draft:
          plans === 1
            ? {
                provider: 'aws',
                destinationType: 'queue',
                destination: 'orders',
                body: 'payment',
              }
            : null,
      };
    }
    await route.fulfill({ json: { success: true, data } });
  });
  const chats = await installChatHistory(page);
  await page.goto('/chat');
  await page.getByRole('button', { name: 'Tool calling', exact: true }).click();
  await page.getByLabel('Your message').fill('Remember payment');
  await page.getByRole('button', { name: 'Ask assistant' }).click();
  await expect(
    page.getByRole('region', { name: 'Review message' }),
  ).toContainText('payment');
  await expect(
    page.getByRole('button', { name: 'New chat', exact: true }),
  ).toBeEnabled();
  expect(chats.size).toBe(1);
  await page.reload();
  await page.getByRole('button', { name: 'Chat history', exact: true }).click();
  await page.getByRole('button', { name: /Remember payment/ }).click();
  await expect(page.getByRole('log')).toContainText('Payment draft prepared');
  await expect(
    page.getByRole('button', { name: 'Tool calling', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('region', { name: 'Review message' }),
  ).toBeHidden();
  await page.getByLabel('Your message').fill('Continue our saved conversation');
  await page.getByRole('button', { name: 'Ask assistant' }).click();
  await expect(page.getByRole('log')).toContainText('Continued the saved chat');
  await expect(
    page.getByRole('button', { name: 'New chat', exact: true }),
  ).toBeEnabled();
  expect(chats.size).toBe(1);
  expect([...chats.values()][0].turns).toHaveLength(4);
  await page.getByRole('button', { name: 'New chat', exact: true }).click();
  await expect(page.getByRole('log')).not.toContainText(
    'Payment draft prepared',
  );
  await expect(
    page.getByRole('button', { name: /Remember payment/ }),
  ).toBeVisible();
});

test('retries saving a send outcome without publishing the message twice', async ({
  page,
}) => {
  let sends = 0;
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = [];
    if (path.endsWith('/messaging-chat/status'))
      data = { configured: true, model: 'gemini-3.5-flash-lite' };
    else if (path.endsWith('/messaging-chat/messages'))
      data = {
        reply: 'Review the draft',
        draft: {
          provider: 'aws',
          destinationType: 'queue',
          destination: 'orders',
          body: 'hello',
        },
      };
    else if (path.endsWith('/aws-sqs/messages')) {
      sends++;
      data = {
        messageId: 'saved-send',
        queueName: 'orders',
        queueUrl: 'http://localhost/orders',
      };
    }
    await route.fulfill({ json: { success: true, data } });
  });
  const chats = await installChatHistory(page, { failSentSave: true });
  await page.goto('/chat');
  await page.getByLabel('Your message').fill('Send hello');
  await page.getByRole('button', { name: 'Ask assistant' }).click();
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByRole('log')).toContainText('Message ID: saved-send');
  await expect(
    page.getByRole('region', { name: 'Review message' }),
  ).toBeHidden();
  await page.getByRole('button', { name: 'Retry saving', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Retry saving', exact: true }),
  ).toBeHidden();
  expect(sends).toBe(1);
  expect([...chats.values()][0].turns).toHaveLength(3);
});

test('lists saved history in pages and lets the user select an older chat', async ({
  page,
}) => {
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: { configured: false, model: 'gemini-3.5-flash-lite' },
      },
    }),
  );
  const chats = await installChatHistory(page);
  for (let index = 1; index <= 21; index++) {
    const id = `11111111-1111-4111-8111-${String(index).padStart(12, '0')}`;
    chats.set(id, {
      id,
      mode: 'structured',
      title: `Saved chat ${index}`,
      revision: 1,
      createdAt: '2026-10-16T10:00:00Z',
      updatedAt: '2026-10-16T10:00:00Z',
      turns: [{ id, role: 'user', content: `Older question ${index}` }],
    });
  }
  await page.goto('/chat');
  await page.getByRole('button', { name: 'Chat history', exact: true }).click();
  const history = page.getByRole('region', { name: 'Chat history' });
  await expect(history.getByRole('listitem')).toHaveCount(20);
  await history.getByRole('button', { name: 'More chats' }).click();
  await expect(history.getByRole('listitem')).toHaveCount(1);
  await history
    .getByRole('button', { name: /Saved chat 1 Structured output/ })
    .click();
  await expect(page.getByRole('log')).toContainText('Older question 1');
  await expect(page.getByLabel('Your message')).toBeDisabled();
});
