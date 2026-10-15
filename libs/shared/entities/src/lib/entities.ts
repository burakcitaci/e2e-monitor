/**
 * Serializable contracts shared by the monitor and backend-facing clients.
 *
 * Keep this library browser-safe: runtime SDKs, filesystem access, and emulator
 * configuration belong in their respective applications.
 */
export interface TrackingMessage {
  _id: string;
  messageId: string;
  body: string;
  sentBy: string;
  sentAt: Date;
  status: 'sent' | 'processing' | 'received';
  queue?: string;
  receivedAt?: Date;
  receivedBy?: string;
  disposition?: 'complete' | 'abandon' | 'deadletter' | 'defer';
  emulatorType?: 'sqs' | 'azure-service-bus';
  pendingDeliveries?: { token: string; queue: string; expiresAt: Date }[];
}
