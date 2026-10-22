import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '../../lib/api-client';
import { TrackingMessage } from '../../lib/schemas';

// Query keys
export const trackingMessageKeys = {
  all: ['tracking-messages'] as const,
  lists: () => [...trackingMessageKeys.all, 'list'] as const,
  list: () => [...trackingMessageKeys.lists()] as const,
  details: () => [...trackingMessageKeys.all, 'detail'] as const,
  detail: (id: string) => [...trackingMessageKeys.details(), id] as const,
  listsByEmulator: (emulator: string) =>
    [...trackingMessageKeys.all, 'list', emulator] as const,
};

// Hooks
export const useTrackingMessages = () => {
  return useQuery({
    queryKey: trackingMessageKeys.list(),
    queryFn: () => apiClient.getTrackingMessages(),
    staleTime: 5000, // 5 seconds - consider data stale quickly for monitoring
    refetchInterval: 3000, // Poll every 3 seconds to get real-time updates
    retry: (failureCount, error) => {
      // Don't retry on 4xx errors
      if (
        error instanceof ApiError &&
        error.status >= 400 &&
        error.status < 500
      ) {
        return false;
      }
      return failureCount < 3;
    },
  });
};

export const useTrackingMessage = (id: string) => {
  return useQuery({
    queryKey: trackingMessageKeys.detail(id),
    queryFn: () => apiClient.getTrackingMessage(id),
    enabled: !!id,
    staleTime: 3000,
    refetchInterval: 3000,
    retry: (failureCount, error) => {
      if (
        error instanceof ApiError &&
        error.status >= 400 &&
        error.status < 500
      )
        return false;
      return failureCount < 3;
    },
  });
};

export const useTrackingMessagesByEmulator = (emulator: string) => {
  console.log('useTrackingMessagesByEmulator', emulator);
  return useQuery({
    queryKey: trackingMessageKeys.listsByEmulator(emulator),
    queryFn: () => apiClient.getTrackingMessagesByEmulator(emulator),
    enabled: !!emulator,
    staleTime: 5000, // 5 seconds - consider data stale quickly for monitoring
  });
};

// Update ALL three mutation hooks in your tracking-messages hook file:

export const useCreateTrackingMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (message: Partial<TrackingMessage>) =>
      apiClient.createTrackingMessage(message),
    onSuccess: () => {
      // Invalidate all tracking message queries
      queryClient.invalidateQueries({ queryKey: trackingMessageKeys.all });
    },
  });
};

export const useUpdateTrackingMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      message,
    }: {
      id: string;
      message: Partial<TrackingMessage>;
    }) => apiClient.updateTrackingMessage(id, message),
    onSuccess: (_, { id }) => {
      // Invalidate all tracking message queries
      queryClient.invalidateQueries({ queryKey: trackingMessageKeys.all });
    },
  });
};

export const useDeleteTrackingMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.deleteTrackingMessage(id),
    onSuccess: () => {
      // Invalidate all tracking message queries
      queryClient.invalidateQueries({ queryKey: trackingMessageKeys.all });
    },
  });
};
