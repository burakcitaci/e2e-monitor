import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Model } from 'mongoose';
import { ChatConversation } from './chat-history.schema';
import { ChatHistoryService } from './chat-history.service';

const id = '11111111-1111-4111-8111-111111111111';
const turn = {
  id: '22222222-2222-4222-8222-222222222222',
  role: 'user' as const,
  content: 'Send hello to AWS orders',
};
const base = (): ChatConversation => ({
  id,
  title: 'New chat',
  mode: 'tools',
  revision: 0,
  bytes: 0,
  turns: [],
  createdAt: new Date('2026-10-16T10:00:00Z'),
  updatedAt: new Date('2026-10-16T10:00:00Z'),
});

describe('Persistent chat history', () => {
  const read = jest.fn<() => Promise<ChatConversation | null>>();
  const update = jest.fn<() => Promise<ChatConversation | null>>();
  const rows = jest.fn<() => Promise<ChatConversation[]>>();
  const list = {
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: rows,
  };
  const model = {
    create: jest.fn<(input: unknown) => Promise<ChatConversation>>(),
    findOne: jest.fn(() => ({ lean: () => ({ exec: read }) })),
    findOneAndUpdate: jest.fn(() => ({ lean: () => ({ exec: update }) })),
    find: jest.fn(() => list),
    countDocuments: jest.fn(() => ({ exec: async () => 21 })),
  };
  let service: ChatHistoryService;
  beforeEach(() => {
    jest.clearAllMocks();
    read.mockResolvedValue(base());
    update.mockResolvedValue(null);
    rows.mockResolvedValue([base()]);
    model.create.mockResolvedValue(base());
    service = new ChatHistoryService(
      model as unknown as Model<ChatConversation>,
    );
  });
  it('creates a mode-specific chat with serializable metadata', async () => {
    const result = await service.create({ id, mode: 'tools' });
    expect(result).toMatchObject({
      id,
      mode: 'tools',
      revision: 0,
      turns: [],
      createdAt: '2026-10-16T10:00:00.000Z',
    });
    expect(result).not.toHaveProperty('bytes');
  });
  it('returns summaries in bounded deterministic pages without transcript payloads', async () => {
    await expect(service.list(2)).resolves.toMatchObject({
      page: 2,
      total: 21,
      pages: 2,
    });
    expect(list.skip).toHaveBeenCalledWith(20);
    expect(list.limit).toHaveBeenCalledWith(20);
    expect(list.sort).toHaveBeenCalledWith({ updatedAt: -1, id: -1 });
    expect(list.select).toHaveBeenCalledWith(
      'id title mode revision createdAt updatedAt',
    );
    expect((await service.list(1)).items[0]).not.toHaveProperty('turns');
  });
  it('appends with an atomic revision/duplicate/size guard and generates a title', async () => {
    update.mockResolvedValueOnce({ ...base(), revision: 1, turns: [turn] });
    await expect(
      service.append(id, { revision: 0, turn }),
    ).resolves.toMatchObject({ revision: 1, turns: [turn] });
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        id,
        revision: 0,
        'turns.id': { $ne: turn.id },
        bytes: { $lte: 1000000 - Buffer.byteLength(JSON.stringify(turn)) },
      }),
      expect.objectContaining({
        $push: { turns: turn },
        $inc: { revision: 1, bytes: Buffer.byteLength(JSON.stringify(turn)) },
        $set: { title: turn.content },
      }),
      { new: true, runValidators: true },
    );
  });
  it('deduplicates an uncertain append retry but rejects conflicting contents or revisions', async () => {
    read.mockResolvedValue({ ...base(), revision: 1, turns: [turn] });
    await expect(
      service.append(id, { revision: 0, turn }),
    ).resolves.toMatchObject({ revision: 1, turns: [turn] });
    await expect(
      service.append(id, {
        revision: 0,
        turn: { ...turn, content: 'different' },
      }),
    ).rejects.toThrow('changed in another window');
    read.mockResolvedValue({ ...base(), revision: 2 });
    await expect(service.append(id, { revision: 0, turn })).rejects.toThrow(
      'changed in another window',
    );
  });
  it('handles duplicate creates idempotently and preserves the saved mode', async () => {
    model.create.mockRejectedValue({ code: 11000 });
    await expect(service.create({ id, mode: 'tools' })).resolves.toMatchObject({
      id,
      mode: 'tools',
    });
    await expect(service.create({ id, mode: 'structured' })).rejects.toThrow(
      'different mode',
    );
    model.create.mockRejectedValue(new Error('database unavailable'));
    await expect(service.create({ id, mode: 'tools' })).rejects.toThrow(
      'database unavailable',
    );
  });
  it('reports missing chats and entry/storage limits without modifying old turns', async () => {
    read.mockResolvedValueOnce(null);
    await expect(service.get(id)).rejects.toThrow('Chat not found');
    read.mockResolvedValueOnce({
      ...base(),
      turns: Array.from({ length: 200 }, () => ({ ...turn, id: 'older' })),
    });
    await expect(service.append(id, { revision: 0, turn })).rejects.toThrow(
      '200 entries',
    );
    read.mockResolvedValueOnce(base());
    await expect(service.append(id, { revision: 0, turn })).rejects.toThrow(
      'storage limit',
    );
    await expect(
      service.append(id, { revision: 0, turn: { ...turn, content: ' ' } }),
    ).rejects.toThrow('must not be blank');
  });
});
