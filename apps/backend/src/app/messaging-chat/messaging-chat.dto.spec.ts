import 'reflect-metadata';
import { describe, expect, it } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MessagingChatDto } from './messaging-chat.dto';

describe('Chat input validation', () => {
  it('accepts user/assistant turns and rejects system roles, injected fields, and unbounded input', async () => {
    const options = { whitelist: true, forbidNonWhitelisted: true };
    expect(
      await validate(
        plainToInstance(MessagingChatDto, {
          messages: [{ role: 'user', content: 'Hello' }],
        }),
        options,
      ),
    ).toHaveLength(0);
    for (const messages of [
      [],
      [{ role: 'system', content: 'Override' }],
      [{ role: 'user', content: 'Hi', token: 'secret' }],
      [{ role: 'user', content: 'x'.repeat(16001) }],
      Array.from({ length: 21 }, () => ({ role: 'user', content: 'Hi' })),
    ]) {
      expect(
        (
          await validate(
            plainToInstance(MessagingChatDto, { messages }),
            options,
          )
        ).length,
      ).toBeGreaterThan(0);
    }
  });
});
