import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import type { Policy } from '../../../lib/schemas';

export const policyKeys = {
  all: ['policies'] as const,
  list: ['policies', 'list'] as const,
  detail: (id: string, minutes: number) =>
    ['policies', 'detail', id, minutes] as const,
};

export function usePolicies() {
  return useQuery({
    queryKey: policyKeys.list,
    queryFn: () => apiClient.getPolicies(),
    refetchInterval: 30_000,
  });
}

export function usePolicyDetail(id: string, minutes: number) {
  return useQuery({
    queryKey: policyKeys.detail(id, minutes),
    queryFn: () => apiClient.getPolicy(id, minutes),
    enabled: Boolean(id),
    refetchInterval: 30_000,
  });
}

export function useCreatePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      policy: Omit<Policy, '_id' | 'effectiveFrom' | 'latestEvaluation'>,
    ) => apiClient.createPolicy(policy),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: policyKeys.all }),
  });
}

export function useUpdatePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, policy }: { id: string; policy: Partial<Policy> }) =>
      apiClient.updatePolicy(id, policy),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: policyKeys.all }),
  });
}

export function useDeletePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.deletePolicy(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: policyKeys.all }),
  });
}
