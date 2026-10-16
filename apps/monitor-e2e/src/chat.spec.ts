import { expect, test } from '@playwright/test';

for (const [provider, destinationType, destination] of [
  ['azure', 'topic', 'events'],
  ['azure', 'queue', 'orders'],
  ['aws', 'queue', 'orders.fifo'],
] as const) {
  test(`chat prepares and confirms ${provider} ${destinationType} messages`, async ({
    page,
  }) => {
    let plans = 0;
    let sends = 0;
    await page.route('**/api/v1/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      let data: unknown = [];
      if (path.endsWith('/messaging-chat/status'))
        data = { configured: true, model: 'gpt-4.1-mini' };
      else if (path.endsWith('/messaging-chat/messages')) {
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
        route.request().method() === 'POST' &&
        path.endsWith('/messages')
      ) {
        sends++;
        const body = route.request().postDataJSON();
        expect(body.body).toBe('{"hello":"world"}');
        expect(body.sentBy).toBe('messaging-chat');
        if (provider === 'azure') expect(body.queue).toBe(destination);
        else
          expect(body).toMatchObject({
            queueName: destination,
            messageGroupId: 'dashboard-chat',
            messageDeduplicationId: body.messageId,
          });
        data = {
          messageId: 'sent-id',
          queueName: destination,
          queueUrl: 'http://local/orders',
          md5OfBody: 'hash',
        };
      }
      await route.fulfill({ json: { success: true, data } });
    });
    await page.goto('/chat');
    await page
      .getByLabel('Your message')
      .fill(`I want to send to ${provider} ${destinationType} ${destination}`);
    await page.getByRole('button', { name: 'Ask assistant' }).click();
    await expect(page.getByRole('log')).toContainText('What message body');
    await page.getByLabel('Your message').fill('{"hello":"world"}');
    await page.getByRole('button', { name: 'Ask assistant' }).click();
    const review = page.getByRole('region', { name: 'Review message' });
    await expect(review).toContainText(destination);
    expect(sends).toBe(0);
    await review
      .getByRole('button', { name: 'Send message', exact: true })
      .dblclick();
    await expect(page.getByRole('log')).toContainText('Message ID: sent-id');
    expect(sends).toBe(1);
    await expect(review).toBeHidden();
  });
}

test('chat shows configuration guidance without pretending to call an LLM', async ({
  page,
}) => {
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: { configured: false, model: 'gpt-4.1-mini' },
      },
    }),
  );
  await page.goto('/e2e-tests');
  await expect(page).toHaveURL(/\/chat$/);
  await expect(page.getByRole('alert')).toContainText('OPENAI_API_KEY');
  await expect(page.getByLabel('Your message')).toBeDisabled();
  await expect(
    page.getByRole('heading', { name: 'Messaging Chat' }),
  ).toBeVisible();
});

test('chat keeps a failed send draft available and allows discarding it', async ({
  page,
}) => {
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/messaging-chat/status'))
      await route.fulfill({
        json: {
          success: true,
          data: { configured: true, model: 'gpt-4.1-mini' },
        },
      });
    else if (path.endsWith('/messaging-chat/messages'))
      await route.fulfill({
        json: {
          success: true,
          data: {
            reply: 'Review this draft.',
            draft: {
              provider: 'aws',
              destinationType: 'queue',
              destination: 'orders',
              body: 'hello',
            },
          },
        },
      });
    else
      await route.fulfill({
        status: 503,
        json: { message: 'Emulator unavailable' },
      });
  });
  await page.goto('/chat');
  await page.getByLabel('Your message').fill('Send hello to AWS queue orders');
  await page.getByRole('button', { name: 'Ask assistant' }).click();
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Emulator unavailable');
  await expect(
    page.getByRole('region', { name: 'Review message' }),
  ).toContainText('hello');
  await page.getByRole('button', { name: 'Discard draft' }).click();
  await expect(
    page.getByRole('region', { name: 'Review message' }),
  ).toBeHidden();
  await expect(page.getByRole('log')).not.toContainText('Message sent');
});
