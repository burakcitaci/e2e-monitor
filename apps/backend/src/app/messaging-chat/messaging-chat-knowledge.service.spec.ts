import { describe, expect, it } from '@jest/globals';
import { MessagingChatKnowledgeService } from './messaging-chat-knowledge.service';

describe('Messaging chat documentation retrieval', () => {
  const knowledge = new MessagingChatKnowledgeService();
  it.each([
    'how many providers ?',
    'how many provider?',
    'Which providers are supported?',
  ])('retrieves the explicit provider count for %s', (query) => {
    expect(knowledge.retrieve(query)[0]).toMatchObject({
      id: 'supported-providers',
      source: 'docs/messaging-chat.md#supported-providers',
      text: expect.stringContaining(
        'exactly two messaging providers: Azure Service Bus and AWS SQS',
      ),
    });
  });

  it.each([
    ['queue', 'queues'],
    ['topic', 'topics'],
    ['message', 'messages'],
    ['destination', 'destinations'],
    ['tool', 'tools'],
    ['emulator', 'emulators'],
  ])('retrieves the same knowledge for %s and %s', (singular, plural) => {
    expect(knowledge.retrieve(plural)).toEqual(knowledge.retrieve(singular));
  });
  it('retrieves setup guidance with a stable documentation source', () => {
    expect(
      knowledge.retrieve('How do I configure GEMINI_API_KEY?')[0],
    ).toMatchObject({
      id: 'chat-setup',
      source: 'docs/messaging-chat.md#setup',
    });
  });

  it('ranks title matches and filters the other provider', () => {
    const results = knowledge.retrieve('AWS SQS LocalStack configuration');
    expect(results[0].id).toBe('sqs-configuration');
    expect(results.some((result) => result.provider === 'azure')).toBe(false);
    expect(
      knowledge
        .retrieve('Azure Service Bus configuration')
        .some((result) => result.provider === 'aws'),
    ).toBe(false);
  });

  it('keeps both providers eligible for comparison questions', () => {
    const results = knowledge.retrieve(
      'Azure AWS SQS Service Bus configuration',
    );
    expect(results.some((result) => result.provider === 'aws')).toBe(true);
    expect(results.some((result) => result.provider === 'azure')).toBe(true);
  });

  it('returns no context for empty, stop-word-only or unrelated queries', () => {
    for (const query of ['', 'how do i', 'zyxwvutsrq']) {
      expect(knowledge.retrieve(query)).toEqual([]);
    }
  });

  it('bounds query processing and retrieved context deterministically', () => {
    const query = 'queue configuration message health setup';
    const results = knowledge.retrieve(query);
    expect(results.length).toBeLessThanOrEqual(3);
    expect(knowledge.retrieve(query)).toEqual(results);
    expect(JSON.stringify(results).length).toBeLessThan(4000);
    expect(knowledge.retrieve('x'.repeat(2000) + ' GEMINI_API_KEY')).toEqual(
      [],
    );
  });

  it('retrieves the explicitly defined overview text and citation', () => {
    expect(knowledge.retrieve('Overview')[0]).toMatchObject({
      id: 'chat-overview',
      source: 'docs/messaging-chat.md#overview',
      text: 'Messaging Chat is a Gemini-powered assistant for preparing messages for local Azure Service Bus and AWS SQS emulators. It supports structured output and tool calling, uses relevant knowledge entries to answer documentation questions, and asks for missing message details. Drafts must use known destinations and are validated by the backend. The assistant does not send messages; the user reviews the destination and body and clicks Send message to publish through the existing messaging API.',
    });
  });
});
