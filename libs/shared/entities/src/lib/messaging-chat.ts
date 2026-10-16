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
