import { config } from './config';
import { z, ZodError } from 'zod';
import type {
  ChatHistoryPage,
  ChatMode,
  ChatReply,
  ChatTurn,
  SavedChat,
  SavedChatTurn,
} from '@e2e-monitor/entities';
import {
  chatHistorySchema,
  savedChatSchema,
  chatReplySchema,
  chatStatusSchema,
} from './messaging-chat-schemas';
import {
  trackingMessagesResponseSchema,
  trackingMessageResponseSchema,
  deleteMessageResponseSchema,
  apiResponseSchema,
  TrackingMessage,
  MessageResources,
  messageResourcesResponseSchema,
  messageResourceResponseSchema,
  policiesResponseSchema,
  policyResponseSchema,
  policyEvaluationSchema,
  policyDetailSchema,
  Policy,
} from './schemas';

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
    public data?: unknown,
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

  async getPolicies() {
    const response = await this.request(
      '/policies',
      undefined,
      policiesResponseSchema,
    );
    return (response as ApiResponse<Policy[]>).data ?? [];
  }

  async createPolicy(policy: Omit<Policy, '_id' | 'effectiveFrom'>) {
    const response = await this.request(
      '/policies',
      { method: 'POST', body: JSON.stringify(policy) },
      policyResponseSchema,
    );
    return (response as ApiResponse<Policy>).data;
  }

  async getPolicy(id: string, minutes?: number) {
    const response = await this.request(
      `/policies/${encodeURIComponent(id)}${minutes ? `?minutes=${minutes}` : ''}`,
      undefined,
      apiResponseSchema(policyDetailSchema),
    );
    return (response as ApiResponse<z.infer<typeof policyDetailSchema>>).data;
  }

  async evaluatePolicy(id: string) {
    const response = await this.request(
      `/policies/${encodeURIComponent(id)}/evaluate`,
      undefined,
      apiResponseSchema(policyEvaluationSchema),
    );
    return (response as ApiResponse<z.infer<typeof policyEvaluationSchema>>)
      .data;
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit,
    schema?: z.ZodTypeAny,
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
          errorData.message ||
            `HTTP ${response.status}: ${response.statusText}`,
          errorData,
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
          const errorMessage =
            parseError instanceof ZodError
              ? parseError.issues
                  .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
                  .join(', ')
              : 'Unknown error';

          throw new ApiError(
            500,
            `Invalid response format: ${errorMessage}`,
            data,
          );
        }
      }

      return data as T;
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(
        0,
        error instanceof Error ? error.message : 'Network error',
      );
    }
  }

  async getChatStatus(): Promise<{ configured: boolean; model: string }> {
    const response = await this.request(
      '/messaging-chat/status',
      undefined,
      apiResponseSchema(chatStatusSchema),
    );
    if (
      !isApiResponse<{ configured: boolean; model: string }>(response) ||
      !response.success ||
      !response.data
    )
      throw new ApiError(500, 'Could not load chatbot configuration.');
    return response.data;
  }

  async chat(
    messages: ChatTurn[],
    mode: ChatMode = 'structured',
  ): Promise<ChatReply> {
    const response = await this.request(
      mode === 'tools'
        ? '/messaging-chat/messages/tools'
        : '/messaging-chat/messages',
      { method: 'POST', body: JSON.stringify({ messages }) },
      apiResponseSchema(chatReplySchema),
    );
    if (
      !isApiResponse<ChatReply>(response) ||
      !response.success ||
      !response.data
    )
      throw new ApiError(500, 'Could not get a chatbot reply.');
    return response.data;
  }

  private async chatHistoryRequest<T>(
    path: string,
    schema: z.ZodType<T>,
    options?: RequestInit,
  ): Promise<T> {
    const response = await this.request(
      path,
      options,
      apiResponseSchema(schema),
    );
    if (
      !isApiResponse<T>(response) ||
      !response.success ||
      response.data === undefined
    )
      throw new ApiError(500, 'Chat history request failed.');
    return response.data;
  }
  getChatHistory(page = 1): Promise<ChatHistoryPage> {
    return this.chatHistoryRequest(
      `/messaging-chat/conversations?page=${page}`,
      chatHistorySchema,
    );
  }
  getSavedChat(id: string): Promise<SavedChat> {
    return this.chatHistoryRequest(
      `/messaging-chat/conversations/${encodeURIComponent(id)}`,
      savedChatSchema,
    );
  }
  createChat(input: { id: string; mode: ChatMode }): Promise<SavedChat> {
    return this.chatHistoryRequest(
      '/messaging-chat/conversations',
      savedChatSchema,
      { method: 'POST', body: JSON.stringify(input) },
    );
  }
  appendChatTurn(input: {
    id: string;
    revision: number;
    turn: SavedChatTurn;
  }): Promise<SavedChat> {
    return this.chatHistoryRequest(
      `/messaging-chat/conversations/${encodeURIComponent(input.id)}/turns`,
      savedChatSchema,
      {
        method: 'POST',
        body: JSON.stringify({ revision: input.revision, turn: input.turn }),
      },
    );
  }

  // Tracking Messages API
  async getTrackingMessages(): Promise<TrackingMessage[]> {
    const response = await this.request<
      | { success: boolean; message?: string; data?: TrackingMessage[] }
      | TrackingMessage[]
    >('/tracked-messages/tracking', undefined, trackingMessagesResponseSchema);

    // Handle wrapped response format
    if (isApiResponse<TrackingMessage[]>(response)) {
      if (!response.success) {
        throw new ApiError(
          500,
          response.message || 'Failed to fetch tracking messages',
        );
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
      `/tracked-messages/tracking/${encodeURIComponent(id)}`,
      undefined,
      trackingMessageResponseSchema,
    );

    if (
      !isApiResponse<TrackingMessage>(response) ||
      !response.success ||
      !response.data
    ) {
      throw new ApiError(
        500,
        isApiResponse(response)
          ? response.message || 'Failed to fetch tracking message'
          : 'Invalid response format',
      );
    }

    return response.data;
  }

  async getTrackingMessagesByEmulator(
    emulator: string,
  ): Promise<TrackingMessage[]> {
    const response = await this.request(
      `/tracked-messages/tracking/emulator/${emulator}`,
      undefined,
      trackingMessagesResponseSchema,
    );

    if (
      !isApiResponse<TrackingMessage[]>(response) ||
      !response.success ||
      !response.data
    ) {
      throw new ApiError(
        500,
        isApiResponse(response)
          ? response.message || 'Failed to fetch tracking messages by broker'
          : 'Invalid response format',
      );
    }

    return response.data;
  }

  async createTrackingMessage(
    message: Partial<TrackingMessage>,
  ): Promise<TrackingMessage> {
    const response = await this.request(
      '/tracked-messages/tracking',
      {
        method: 'POST',
        body: JSON.stringify(message),
      },
      trackingMessageResponseSchema,
    );

    if (
      !isApiResponse<TrackingMessage>(response) ||
      !response.success ||
      !response.data
    ) {
      throw new ApiError(
        500,
        isApiResponse(response)
          ? response.message || 'Failed to create tracking message'
          : 'Invalid response format',
      );
    }

    return response.data;
  }

  async updateTrackingMessage(
    id: string,
    message: Partial<TrackingMessage>,
  ): Promise<TrackingMessage> {
    const response = await this.request(
      `/tracked-messages/tracking/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(message),
      },
      trackingMessageResponseSchema,
    );

    if (
      !isApiResponse<TrackingMessage>(response) ||
      !response.success ||
      !response.data
    ) {
      throw new ApiError(
        500,
        isApiResponse(response)
          ? response.message || 'Failed to update tracking message'
          : 'Invalid response format',
      );
    }

    return response.data;
  }

  async deleteTrackingMessage(id: string): Promise<{ message: string }> {
    const response = await this.request(
      `/tracked-messages/tracking/${id}`,
      {
        method: 'DELETE',
      },
      deleteMessageResponseSchema,
    );

    if (!isApiResponse<{ message?: string }>(response) || !response.success) {
      throw new ApiError(
        500,
        isApiResponse(response)
          ? response.message || 'Failed to delete tracking message'
          : 'Invalid response format',
      );
    }

    return {
      message: response.message || 'Tracking message deleted successfully',
    };
  }

  // Saved resource metadata API
  async getMessageResources(): Promise<MessageResources[]> {
    const response = await this.request(
      '/message-resources/resources',
      undefined,
      messageResourcesResponseSchema,
    );
    if (
      !isApiResponse<MessageResources[]>(response) ||
      !response.success ||
      !response.data
    ) {
      throw new ApiError(
        500,
        isApiResponse(response)
          ? response.message || 'Failed to fetch message resources'
          : 'Invalid response format',
      );
    }
    return response.data;
  }
  async createMessageResource(
    resource: Omit<MessageResources, 'id'>,
  ): Promise<MessageResources> {
    const response = await this.request(
      '/message-resources/resources',
      {
        method: 'POST',
        body: JSON.stringify(resource),
      },
      messageResourceResponseSchema,
    );
    if (
      !isApiResponse<MessageResources>(response) ||
      !response.success ||
      !response.data
    ) {
      throw new ApiError(
        500,
        isApiResponse(response)
          ? response.message || 'Failed to create message resource'
          : 'Invalid response format',
      );
    }
    return response.data;
  }

  //Message Resources API
  async updateMessageResource(
    resource: MessageResources,
  ): Promise<MessageResources> {
    const response = await this.request(
      `/message-resources/resources/${resource.id}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          name: resource.name,
          provider: resource.provider,
          type: resource.type,
          status: resource.status,
        }),
      },
      messageResourceResponseSchema,
    );
    if (
      !isApiResponse<MessageResources>(response) ||
      !response.success ||
      !response.data
    ) {
      throw new ApiError(
        500,
        isApiResponse(response)
          ? response.message || 'Failed to update message resource'
          : 'Invalid response format',
      );
    }
    return response.data;
  }
}

export const apiClient = new ApiClient();
export { ApiError };
export type { ApiClient };
