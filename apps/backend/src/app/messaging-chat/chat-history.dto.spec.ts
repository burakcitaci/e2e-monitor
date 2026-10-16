import 'reflect-metadata';
import { describe, expect, it } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  AppendChatTurnDto,
  ChatHistoryQueryDto,
  CreateChatDto,
} from './chat-history.dto';

const id = '11111111-1111-4111-8111-111111111111';
const options = { whitelist: true, forbidNonWhitelisted: true };
describe('Chat history validation', () => {
  it('validates UUIDs, planning modes, pagination and unknown fields', async () => {
    expect(
      await validate(
        plainToInstance(CreateChatDto, { id, mode: 'tools' }),
        options,
      ),
    ).toHaveLength(0);
    for (const input of [
      { id: 'invalid', mode: 'tools' },
      { id, mode: 'automatic' },
      { id, mode: 'tools', key: 'secret' },
    ])
      expect(
        (await validate(plainToInstance(CreateChatDto, input), options)).length,
      ).toBeGreaterThan(0);
    expect(plainToInstance(ChatHistoryQueryDto, { page: '2' }).page).toBe(2);
    for (const page of ['-1', '1.5', 'NaN', '100001'])
      expect(
        (
          await validate(
            plainToInstance(ChatHistoryQueryDto, { page }),
            options,
          )
        ).length,
      ).toBeGreaterThan(0);
  });
  it('rejects invalid nested turns, revision bypasses and executable role fields', async () => {
    const turn = { id, role: 'user', content: 'Hello' };
    expect(
      await validate(
        plainToInstance(AppendChatTurnDto, { revision: 0, turn }),
        options,
      ),
    ).toHaveLength(0);
    for (const input of [
      { revision: -1, turn },
      { revision: 201, turn },
      { revision: 0 },
      { revision: 0, turn: [turn] },
      { revision: 0, turn: { ...turn, role: 'system' } },
      { revision: 0, turn: { ...turn, content: 'x'.repeat(16001) } },
      { revision: 0, turn: { ...turn, context: null } },
      { revision: 0, turn: { ...turn, sendNow: true } },
    ])
      expect(
        (await validate(plainToInstance(AppendChatTurnDto, input), options))
          .length,
      ).toBeGreaterThan(0);
  });
});
