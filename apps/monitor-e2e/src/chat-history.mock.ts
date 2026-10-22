import type { Page } from '@playwright/test';
import type { SavedChat } from '@e2e-monitor/entities';

export async function installChatHistory(
  page: Page,
  options: { failAssistantSave?: boolean } = {},
) {
  const chats = new Map<string, SavedChat>();
  await page.route(
    '**/api/v1/messaging-chat/conversations**',
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const parts = url.pathname.split('/');
      const id = parts[5];
      let data: unknown;
      if (request.method() === 'POST' && !id) {
        const input = request.postDataJSON();
        const now = new Date().toISOString();
        const chat: SavedChat = {
          id: input.id,
          mode: input.mode,
          title: 'New chat',
          turns: [],
          revision: 0,
          createdAt: now,
          updatedAt: now,
        };
        chats.set(chat.id, chat);
        data = chat;
      } else if (request.method() === 'POST') {
        const input = request.postDataJSON();
        if (options.failAssistantSave && input.turn.role === 'assistant') {
          options.failAssistantSave = false;
          await route.fulfill({
            status: 503,
            json: { message: 'History temporarily unavailable' },
          });
          return;
        }
        const chat = chats.get(id);
        if (!chat) {
          await route.fulfill({
            status: 404,
            json: { message: 'Chat not found' },
          });
          return;
        }
        chat.turns.push(input.turn);
        chat.revision++;
        chat.updatedAt = new Date().toISOString();
        if (chat.revision === 1) chat.title = input.turn.content.slice(0, 80);
        data = chat;
      } else if (id) data = chats.get(id);
      else {
        const all = [...chats.values()].sort(
          (a, b) =>
            b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id),
        );
        const current = Number(url.searchParams.get('page') || 1);
        data = {
          items: all
            .slice((current - 1) * 20, current * 20)
            .map(({ id, title, mode, revision, createdAt, updatedAt }) => ({
              id,
              title,
              mode,
              revision,
              createdAt,
              updatedAt,
            })),
          page: current,
          total: all.length,
          pages: Math.max(1, Math.ceil(all.length / 20)),
        };
      }
      await route.fulfill({ json: { success: true, data } });
    },
  );
  return chats;
}
