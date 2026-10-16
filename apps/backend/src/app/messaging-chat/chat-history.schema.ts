import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { ChatMode, SavedChatTurn } from '@e2e-monitor/entities';

@Schema({ _id: false })
class ConversationTurn implements SavedChatTurn {
  @Prop({ required: true }) id!: string;
  @Prop({ type: String, required: true, enum: ['user', 'assistant'] })
  role!: SavedChatTurn['role'];
  @Prop({ required: true }) content!: string;
  @Prop() context?: string;
}
const ConversationTurnSchema = SchemaFactory.createForClass(ConversationTurn);

@Schema({ collection: 'ChatConversations', timestamps: true })
export class ChatConversation {
  @Prop({ required: true, unique: true }) id!: string;
  @Prop({ required: true, default: 'New chat' }) title!: string;
  @Prop({ type: String, required: true, enum: ['structured', 'tools'] })
  mode!: ChatMode;
  @Prop({ required: true, default: 0 }) revision!: number;
  @Prop({ required: true, default: 0 }) bytes!: number;
  @Prop({ type: [ConversationTurnSchema], default: [] })
  turns!: ConversationTurn[];
  createdAt!: Date;
  updatedAt!: Date;
}
export const ChatConversationSchema =
  SchemaFactory.createForClass(ChatConversation);
ChatConversationSchema.index({ updatedAt: -1, id: -1 });
