import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type {
  ChatHistoryPage,
  ChatSummary,
  SavedChat,
} from '@e2e-monitor/entities';
import { ChatConversation } from './chat-history.schema';
import type { AppendChatTurnDto, CreateChatDto } from './chat-history.dto';

const CHAT_HISTORY_PAGE_SIZE = 20;
const MAX_CHAT_BYTES = 1_000_000;
const MAX_CHAT_TURNS = 200;
const MAX_CHAT_TITLE_LENGTH = 80;
const MONGO_DUPLICATE_KEY_CODE = 11000;

@Injectable()
export class ChatHistoryService {
  constructor(
    @InjectModel(ChatConversation.name, 'MessageTrackingDb')
    private readonly model: Model<ChatConversation>,
  ) {}

  async create(input: CreateChatDto): Promise<SavedChat> {
    try {
      return this.detail(
        await this.model.create({
          ...input,
          title: 'New chat',
          revision: 0,
          turns: [],
        }),
      );
    } catch (error) {
      if (
        !error ||
        typeof error !== 'object' ||
        !('code' in error) ||
        error.code !== MONGO_DUPLICATE_KEY_CODE
      )
        throw error;
      const existing = await this.get(input.id);
      if (existing.mode !== input.mode)
        throw new ConflictException('This chat already uses a different mode.');
      return existing;
    }
  }

  async list(page: number): Promise<ChatHistoryPage> {
    const limit = CHAT_HISTORY_PAGE_SIZE;
    const [items, total] = await Promise.all([
      this.model
        .find({})
        .select('id title mode revision createdAt updatedAt')
        .sort({ updatedAt: -1, id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.model.countDocuments({}).exec(),
    ]);
    return {
      items: items.map((item) => this.summary(item)),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async get(id: string): Promise<SavedChat> {
    const chat = await this.model.findOne({ id }).lean().exec();
    if (!chat) throw new NotFoundException('Chat not found.');
    return this.detail(chat);
  }

  async append(id: string, input: AppendChatTurnDto): Promise<SavedChat> {
    const bytes = Buffer.byteLength(JSON.stringify(input.turn));
    if (!input.turn.content.trim())
      throw new BadRequestException('Chat text must not be blank.');
    const chat = await this.model
      .findOneAndUpdate(
        {
          id,
          revision: input.revision,
          bytes: { $lte: MAX_CHAT_BYTES - bytes },
          'turns.id': { $ne: input.turn.id },
          $expr: { $lt: [{ $size: '$turns' }, MAX_CHAT_TURNS] },
        },
        {
          $push: { turns: input.turn },
          $inc: { revision: 1, bytes },
          ...(input.revision === 0 && input.turn.role === 'user'
            ? {
                $set: {
                  title: input.turn.content
                    .replace(/\s+/g, ' ')
                    .trim()
                    .slice(0, MAX_CHAT_TITLE_LENGTH),
                },
              }
            : {}),
        },
        { new: true, runValidators: true },
      )
      .lean()
      .exec();
    if (chat) return this.detail(chat);
    const existing = await this.get(id);
    const duplicate = existing.turns.find((turn) => turn.id === input.turn.id);
    if (
      duplicate &&
      duplicate.role === input.turn.role &&
      duplicate.content === input.turn.content &&
      duplicate.context === input.turn.context
    )
      return existing;
    if (existing.turns.length >= MAX_CHAT_TURNS)
      throw new BadRequestException(
        'This chat has reached 200 entries. Start a new chat.',
      );
    if (existing.revision === input.revision && !duplicate)
      throw new BadRequestException(
        'This chat has reached its storage limit. Start a new chat.',
      );
    throw new ConflictException(
      'This chat changed in another window. Select it from history to reload before continuing.',
    );
  }

  private summary(chat: ChatConversation): ChatSummary {
    return {
      id: chat.id,
      title: chat.title,
      mode: chat.mode,
      revision: chat.revision,
      createdAt: chat.createdAt.toISOString(),
      updatedAt: chat.updatedAt.toISOString(),
    };
  }
  private detail(chat: ChatConversation): SavedChat {
    return {
      ...this.summary(chat),
      turns: chat.turns.map(({ id, role, content, context }) => ({
        id,
        role,
        content,
        ...(context === undefined ? {} : { context }),
      })),
    };
  }
}
