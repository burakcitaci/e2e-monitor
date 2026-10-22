/** Normalize AMQP data bodies from external publishers before storing display text. */
export function serializeServiceBusBody(body: unknown): string {
  if (typeof body === 'string') return body;
  if (Buffer.isBuffer(body)) return body.toString('utf8');
  if (body instanceof Uint8Array) return Buffer.from(body).toString('utf8');
  return JSON.stringify(body) ?? '';
}
