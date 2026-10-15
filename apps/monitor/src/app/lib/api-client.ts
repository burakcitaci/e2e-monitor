import { config } from './config';
import { z, ZodError } from 'zod';
import {
  trackingMessagesResponseSchema,
  trackingMessageResponseSchema,
  sendMessageResponseSchema,
  deleteMessageResponseSchema,
  apiResponseSchema,
  TrackingMessage,
  SendServiceBusMessage,
  ReceiveServiceBusMessage,
  ServiceBusConfig,
  serviceBusConfigSchema,
  SendSqsMessage,
  ReceiveSqsMessage,
  AwsSqsConfig,
  awsSqsConfigSchema,
  AwsSqsMessagesResponse,
  awsSqsMessagesResponseSchema,
  azureServiceBusMessagesResponseSchema,
  ServiceBusMessagesResponse,
  MessageResources,
  messageResourcesResponseSchema,
  messageResourceResponseSchema,
  sendSqsMessageResponseSchema,
} from './schemas';

// Local types for API responses
type AwsSqsMessagesData = {
  data: TrackingMessage[];
  queueName?: string;
  queueUrl?: string;
};

type ServiceBusMessagesData = {
  data: TrackingMessage[];
};

// API Response types
type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data?: T;
};

// Type guard for API response
function isApiResponse<T>(response: unknown): response is ApiResponse<T> {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    typeof (response as { success: unknown }).success === 'boolean'
  );
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl = config.api.baseUrl) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit,
    schema?: z.ZodTypeAny
  ): Promise<ApiResponse<T> | T> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        credentials: 'include', // Include cookies for CORS requests
        ...options,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          response.status,
          errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          errorData
        );
      }

      const data = await response.json();

      if (schema) {
        try {
          return schema.parse(data) as T;
        } catch (parseError: unknown) {
          // Log the actual data received for debugging
          console.error('Schema validation failed:', {
            endpoint,
            receivedData: data,
            error: parseError,
          });
          const errorMessage = parseError instanceof ZodError
            ? parseError.issues
                .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
                .join(', ')
            : 'Unknown error';

          throw new ApiError(
            500,
            `Invalid response format: ${errorMessage}`,
            data
          );
        }
      }

      return data as T;
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(0, error instanceof Error ? error.message : 'Network error');
    }
  }

  async settleMessage(
    id: string,
    token: string,
    disposition: 'complete' | 'abandon' | 'defer' | 'deadletter',
  ) {
    return this.request(
      `/tracked-messages/tracking/${encodeURIComponent(id)}/settle/${encodeURIComponent(token)}`,
      {
        method: 'POST',
        body: JSON.stringify({ disposition }),
      },
    );
  }

  // AWS SQS API
  async getAwsSqsMessages(): Promise<AwsSqsMessagesData> {
    const response = await this.request<AwsSqsMessagesResponse>(
      '/aws-sqs/messages',
      undefined,
      awsSqsMessagesResponseSchema
    );

    // Handle wrapped response format with array of tracking messages
    if (isApiResponse<TrackingMessage[]>(response)) {
      if (!response.success) {
        throw new ApiError(500, response.message || 'Failed to fetch AWS SQS messages');
      }
         
      return {
        data: response.data || []
      };
    }

    // Handle unwrapped array format (direct array)
    if (Array.isArray(response)) {
      return {
        data: response
      };
    }

    throw new ApiError(500, 'Invalid response format from AWS SQS messages endpoint');
  }
  // Azure Service Bus API
  async getServiceBusMessages(): Promise<ServiceBusMessagesData> {
    const response = await this.request<ServiceBusMessagesResponse>(
      '/service-bus/messages',
      undefined,
      azureServiceBusMessagesResponseSchema
    );

    // Handle wrapped response format with array of tracking messages
    if (isApiResponse<TrackingMessage[]>(response)) {
      if (!response.success) {
        throw new ApiError(500, response.message || 'Failed to fetch AWS SQS messages');
      }
         
      return {
        data: response.data || []
      };
    }

    // Handle unwrapped array format (direct array)
    if (Array.isArray(response)) {
      return {
        data: response
      };
    }

    throw new ApiError(500, 'Invalid response format from Service Bus messages endpoint');
  }
  // Tracking Messages API
  async getTrackingMessages(): Promise<TrackingMessage[]> {
    const response = await this.request<
      | { success: boolean; message?: string; data?: TrackingMessage[] }
      | TrackingMessage[]
    >(
      '/tracked-messages/tracking',
      undefined,
      trackingMessagesResponseSchema
    );

    // Handle wrapped response format
    if (isApiResponse<TrackingMessage[]>(response)) {
      if (!response.success) {
        throw new ApiError(500, response.message || 'Failed to fetch tracking messages');
      }
      // Return empty array if data is undefined/null
      return response.data || [];
    }

    // Handle unwrapped array format (backwards compatibility)
    if (Array.isArray(response)) {
      return response;
    }

    // Fallback: return empty array instead of throwing
    console.warn('Unexpected response format, returning empty array');
    return [];
  }

  async getTrackingMessage(id: string): Promise<TrackingMessage> {
    const response = await this.request(
      `/tracked-messages/tracking/${id}`,
      undefined,
      trackingMessageResponseSchema
    );

    if (!isApiResponse<TrackingMessage>(response) || !response.success || !response.data) {
      throw new ApiError(500, isApiResponse(response) ? (response.message || 'Failed to fetch tracking message') : 'Invalid response format');
    }

    return response.data;
  }

  async getTrackingMessagesByEmulator(emulator: string): Promise<TrackingMessage[]> {
    const response = await this.request(
      `/tracked-messages/tracking/emulator/${emulator}`,
      undefined,
      trackingMessagesResponseSchema
    );

    if (!isApiResponse<TrackingMessage[]>(response) || !response.success || !response.data) {
      throw new ApiError(500, isApiResponse(response) ? (response.message || 'Failed to fetch tracking messages by broker') : 'Invalid response format');
    }

    return response.data;
  }

  async createTrackingMessage(message: Partial<TrackingMessage>): Promise<TrackingMessage> {
    const response = await this.request(
      '/tracked-messages/tracking',
      {
        method: 'POST',
        body: JSON.stringify(message),
      },
      trackingMessageResponseSchema
    );

    if (!isApiResponse<TrackingMessage>(response) || !response.success || !response.data) {
      throw new ApiError(500, isApiResponse(response) ? (response.message || 'Failed to create tracking message') : 'Invalid response format');
    }

    return response.data;
  }

  async updateTrackingMessage(
    id: string,
    message: Partial<TrackingMessage>
  ): Promise<TrackingMessage> {
    const response = await this.request(
      `/tracked-messages/tracking/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(message),
      },
      trackingMessageResponseSchema
    );

    if (!isApiResponse<TrackingMessage>(response) || !response.success || !response.data) {
      throw new ApiError(500, isApiResponse(response) ? (response.message || 'Failed to update tracking message') : 'Invalid response format');
    }

    return response.data;
  }

  async deleteTrackingMessage(id: string): Promise<{ message: string }> {
    const response = await this.request(
      `/tracked-messages/tracking/${id}`,
      {
        method: 'DELETE',
      },
      deleteMessageResponseSchema
    );

    if (!isApiResponse<{ message?: string }>(response) || !response.success) {
      throw new ApiError(500, isApiResponse(response) ? (response.message || 'Failed to delete tracking message') : 'Invalid response format');
    }

    return { message: response.message || 'Tracking message deleted successfully' };
  }

  // Service Bus API
  async sendMessage(message: SendServiceBusMessage) {
    const response = await this.request(
      '/service-bus/messages',
      {
        method: 'POST',
        body: JSON.stringify(message),
      },
      sendMessageResponseSchema
    );

    if (!isApiResponse<{ queueName: string; messageId: string }>(response) || !response.success || !response.data) {
      throw new ApiError(500, isApiResponse(response) ? (response.message || 'Failed to send message') : 'Invalid response format');
    }

    return response.data;
  }

  async receiveMessage(message: ReceiveServiceBusMessage) {
    const response = await this.request(
      '/service-bus/messages/receive',
      {
        method: 'POST',
        body: JSON.stringify(message),
      },
      apiResponseSchema(
        z.object({
          queueName: z.string(),
          messageId: z.string(),
          body: z.string(),
        }).nullable()
      )
    );

    return response;
  }

  async getServiceBusConfig(): Promise<ServiceBusConfig> {
    const response = await this.request(
      '/service-bus/config',
      undefined,
      z.object({
        success: z.boolean(),
        data: serviceBusConfigSchema,
      })
    );

    if (!isApiResponse<ServiceBusConfig>(response) || !response.success || !response.data) {
      throw new ApiError(500, isApiResponse(response) ? (response.message || 'Failed to fetch Service Bus config') : 'Invalid response format');
    }

    return response.data;
  }

  // AWS SQS API
  async sendSqsMessage(message: SendSqsMessage) {
    const response = await this.request(
      '/aws-sqs/messages',
      {
        method: 'POST',
        body: JSON.stringify(message),
      },
      sendSqsMessageResponseSchema
    );

    if (!isApiResponse<{ queueName: string; messageId: string; queueUrl: string; md5OfBody: string }>(response) || !response.success || !response.data) {
      throw new ApiError(500, isApiResponse(response) ? (response.message || 'Failed to send SQS message') : 'Invalid response format');
    }

    return response.data;
  }

  async receiveSqsMessage(message: ReceiveSqsMessage) {
    const response = await this.request(
      '/aws-sqs/messages/receive',
      {
        method: 'POST',
        body: JSON.stringify(message),
      },
      apiResponseSchema(
        z.object({
          queueName: z.string(),
          queueUrl: z.string(),
          messageId: z.string(),
          receiptHandle: z.string().optional(),
          body: z.string(),
          messageAttributes: z.record(z.string(), z.any()).optional(),
          md5OfBody: z.string().optional(),
        }).nullable()
      )
    );

    return response;
  }

  async getAwsSqsConfig(): Promise<AwsSqsConfig> {
    const response = await this.request(
      '/aws-sqs/config',
      undefined,
      z.object({
        success: z.boolean(),
        data: awsSqsConfigSchema,
      })
    );

    if (!isApiResponse<AwsSqsConfig>(response) || !response.success || !response.data) {
      throw new ApiError(500, isApiResponse(response) ? (response.message || 'Failed to fetch AWS SQS config') : 'Invalid response format');
    }

    return response.data;
  }

  // Message Resources API
  async getSqsQueueResources(): Promise<MessageResources[]> {
    const response = await this.request('/aws-sqs/queues', undefined, messageResourcesResponseSchema);
    if (!isApiResponse<MessageResources[]>(response) || !response.success || !response.data) {
      throw new ApiError(500, 'Failed to discover SQS queues');
    }
    return response.data;
  }

  async getMessageResources(): Promise<MessageResources[]> {
    const response = await this.request('/message-resources/resources', undefined, messageResourcesResponseSchema);
    if (!isApiResponse<MessageResources[]>(response) || !response.success || !response.data) {
      throw new ApiError(500, isApiResponse(response) ? (response.message || 'Failed to fetch message resources') : 'Invalid response format');
    }
    return response.data;
  }
  async createMessageResource(resource: Omit<MessageResources, 'id'>): Promise<MessageResources> {
    const response = await this.request('/message-resources/resources', {
      method: 'POST',
      body: JSON.stringify(resource),
    }, messageResourceResponseSchema);
    if (!isApiResponse<MessageResources>(response) || !response.success || !response.data) {
      throw new ApiError(500, isApiResponse(response) ? (response.message || 'Failed to create message resource') : 'Invalid response format');
    }
    return response.data;
  }

  //Message Resources API
  async updateMessageResource(resource: MessageResources): Promise<MessageResources> {
    const response = await this.request(`/message-resources/resources/${resource.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: resource.name,
        provider: resource.provider,
        type: resource.type,
        status: resource.status,
      }),
    }, messageResourceResponseSchema);
    if (!isApiResponse<MessageResources>(response) || !response.success || !response.data) {
      throw new ApiError(500, isApiResponse(response) ? (response.message || 'Failed to update message resource') : 'Invalid response format');
    }
    return response.data;
  }
}

export const apiClient = new ApiClient();
export { ApiError };
export type { ApiClient };
