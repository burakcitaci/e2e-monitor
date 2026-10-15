import 'reflect-metadata';
import { describe, expect, it } from '@jest/globals';
import { Mongoose } from 'mongoose';
import { TrackingMessageSchema } from './messages/message.schema';
import { MessagingResourceSchema } from './message-resources/message-resources.schema';

describe('Application schema initialization', () => {
  it.each(['status', 'disposition', 'emulatorType'])(
    'registers tracking %s as a string with enum validation',
    (field) => {
      const model = new Mongoose().model(
        'TrackingMessage',
        TrackingMessageSchema,
      );
      expect(TrackingMessageSchema.path(field).instance).toBe('String');
      const document = new model({
        messageId: 'schema-test',
        body: 'hello',
        sentBy: 'test',
        sentAt: new Date(),
        [field]: 'unsupported-value',
      });
      expect(document.validateSync()?.errors[field]).toBeDefined();
    },
  );

  it('initializes resource status with its string default and enum validation', () => {
    const model = new Mongoose().model(
      'MessagingResource',
      MessagingResourceSchema,
    );
    const document = new model({
      id: 'resource-test',
      name: 'orders',
      provider: 'aws',
      type: 'queue',
    });
    expect(MessagingResourceSchema.path('status').instance).toBe('String');
    expect(document.status).toBe('active');
    expect(document.validateSync()).toBeUndefined();
    document.set('status', 'unsupported-value');
    expect(document.validateSync()?.errors['status']).toBeDefined();
  });
});
