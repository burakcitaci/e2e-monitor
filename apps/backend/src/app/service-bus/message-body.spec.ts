import { describe, expect, it } from '@jest/globals';
import { serializeServiceBusBody } from './message-body';

describe('serializeServiceBusBody', () => {
  it.each([
    ['Hello from financing', 'Hello from financing'],
    [Buffer.from('Hello from financing'), 'Hello from financing'],
    [Buffer.from('Finanzierung: €'), 'Finanzierung: €'],
    [new Uint8Array(Buffer.from('hello')), 'hello'],
    [Buffer.from('{"amount":42}'), '{"amount":42}'],
    [{ amount: 42 }, '{"amount":42}'],
    [null, 'null'],
    [undefined, ''],
  ])('converts %p to display text', (body, expected) => {
    expect(serializeServiceBusBody(body)).toBe(expected);
  });
});
