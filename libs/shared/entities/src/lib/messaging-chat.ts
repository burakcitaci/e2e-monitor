export type ChatMode = 'structured' | 'tools';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface MessageDraft {
  provider: 'azure' | 'aws';
  destinationType: 'queue' | 'topic';
  destination: string;
  body: string;
}

export interface ChatReply {
  reply: string;
  draft: MessageDraft | null;
}

export interface SavedChatTurn extends ChatTurn {
  id: string;
  context?: string;
}

export interface ChatSummary {
  id: string;
  title: string;
  mode: ChatMode;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface SavedChat extends ChatSummary {
  turns: SavedChatTurn[];
}

export interface ChatHistoryPage {
  items: ChatSummary[];
  page: number;
  total: number;
  pages: number;
}
