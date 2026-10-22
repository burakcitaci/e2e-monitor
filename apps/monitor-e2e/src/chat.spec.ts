import { expect, test } from '@playwright/test';
import { installChatHistory } from './chat-history.mock';

for (const mode of ['structured', 'tools'] as const) {
  for (const [provider, destinationType, destination] of [
    ['azure', 'topic', 'events'],
    ['azure', 'queue', 'orders'],
    ['aws', 'queue', 'orders.fifo'],
  ] as const) {
    test(`${mode} chat prepares draft-only ${provider} ${destinationType} messages`, async ({
      page,
    }) => {
      if (provider === 'aws')
        await page.setViewportSize({ width: 390, height: 844 });
      let plans = 0;
      let sends = 0;
      await page.route('**/api/v1/**', async (route) => {
        const path = new URL(route.request().url()).pathname;
        let data: unknown = [];
        if (path.endsWith('/messaging-chat/status'))
          data = { configured: true, model: 'gemini-3.5-flash-lite' };
        else if (
          path.endsWith('/messaging-chat/messages') ||
          path.endsWith('/messaging-chat/messages/tools')
        ) {
          expect(path).toBe(
            '/api/v1/messaging-chat/messages' +
              (mode === 'tools' ? '/tools' : ''),
          );
          plans++;
          const conversation = route.request().postDataJSON().messages;
          expect(conversation.at(-1).role).toBe('user');
          data =
            plans === 1
              ? { reply: 'What message body should I use?', draft: null }
              : {
                  reply: 'Review the prepared message.',
                  draft: {
                    provider,
                    destinationType,
                    destination,
                    body: '{"hello":"world"}',
                  },
                };
        } else if (
          path.includes('/service-bus/') ||
          path.includes('/aws-sqs/')
        ) {
          sends++;
        }
        await route.fulfill({ json: { success: true, data } });
      });
      await installChatHistory(page);
      await page.goto('/');
      const launcher = page.getByRole('main').getByRole('button', {
        name: 'Messaging Chat',
        exact: true,
      });
      await launcher.click();
      const popup = page.getByRole('dialog', { name: 'Messaging assistant' });
      await expect(popup).toBeVisible();
      await expect(popup).toHaveCSS('right', '0px');
      await expect(popup).toHaveCSS('top', '0px');
      if (mode === 'tools')
        await popup
          .getByRole('button', { name: 'Tool calling', exact: true })
          .click();
      await expect(
        popup.getByRole('button', {
          name: mode === 'tools' ? 'Tool calling' : 'Structured output',
          exact: true,
        }),
      ).toHaveAttribute('aria-pressed', 'true');
      await expect(page).toHaveURL('http://localhost:4200/');
      await page
        .getByLabel('Your message')
        .fill(
          `I want to send to ${provider} ${destinationType} ${destination}`,
        );
      await page.getByRole('button', { name: 'Ask assistant' }).click();
      await expect(page.getByRole('log')).toContainText('What message body');
      await page.getByLabel('Your message').fill('{"hello":"world"}');
      await page.getByRole('button', { name: 'Ask assistant' }).click();
      const review = page.getByRole('region', { name: 'Review message' });
      await expect(review).toContainText(destination);
      expect(sends).toBe(0);
      await page.keyboard.press('Escape');
      await expect(popup).toBeHidden();
      await expect(launcher).toBeFocused();
      await expect(
        page.getByRole('button', { name: 'Messaging Chat', exact: true }),
      ).toHaveCount(1);
      await launcher.click();
      await expect(review).toContainText(destination);
      await expect(page.getByRole('log')).toContainText('What message body');
      await expect(
        review.getByRole('button', { name: 'Send message', exact: true }),
      ).toHaveCount(0);
      await expect(review).toContainText('Draft only');
      await review.getByRole('button', { name: 'Discard draft' }).click();
      await expect(review).toBeHidden();
      expect(sends).toBe(0);
    });
  }
}

test('chat shows configuration guidance without pretending to call an LLM', async ({
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
  await installChatHistory(page);
  await page.goto('/e2e-tests');
  await expect(page).toHaveURL(/\/chat$/);
  await expect(page.getByRole('alert')).toContainText('GEMINI_API_KEY');
  await expect(page.getByLabel('Your message')).toBeDisabled();
  await expect(
    page.getByRole('heading', { name: 'Messaging Chat' }),
  ).toBeVisible();
});

test('switching chat mode clears the old draft and keeps only the selected mode history', async ({
  page,
}) => {
  let structuredCalls = 0;
  let toolCalls = 0;
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = [];
    if (path.endsWith('/messaging-chat/status'))
      data = { configured: true, model: 'gemini-3.5-flash-lite' };
    else if (path.endsWith('/messaging-chat/messages')) {
      structuredCalls++;
      data = {
        reply: 'Old structured draft',
        draft: {
          provider: 'aws',
          destinationType: 'queue',
          destination: 'orders',
          body: 'old payload',
        },
      };
    } else if (path.endsWith('/messaging-chat/messages/tools')) {
      toolCalls++;
      expect(JSON.stringify(route.request().postDataJSON())).not.toContain(
        'old payload',
      );
      data = { reply: 'Tool lookup result', draft: null };
    }
    await route.fulfill({ json: { success: true, data } });
  });
  await installChatHistory(page);
  await page.goto('/chat');
  await page.getByLabel('Your message').fill('Prepare old payload');
  await page.getByRole('button', { name: 'Ask assistant' }).click();
  await expect(
    page.getByRole('region', { name: 'Review message' }),
  ).toContainText('old payload');
  await page.getByRole('button', { name: 'Tool calling', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Review message' }),
  ).toBeHidden();
  await expect(page.getByRole('log')).not.toContainText('Old structured draft');
  await page.getByLabel('Your message').fill('List queues');
  await page.getByRole('button', { name: 'Ask assistant' }).click();
  await expect(page.getByRole('log')).toContainText('Tool lookup result');
  await page
    .getByRole('button', { name: 'Structured output', exact: true })
    .click();
  await expect(page.getByRole('log')).not.toContainText('Tool lookup result');
  expect(structuredCalls).toBe(1);
  expect(toolCalls).toBe(1);
});
