import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../../lib/api-client';
import {
  policyKeys,
  useCreatePolicy,
  usePolicies,
  usePolicyDetail,
} from './hooks';
import { emptyPolicyForm, policyFromForm } from '../lib/policy-form';

vi.mock('../../../lib/api-client', () => ({
  apiClient: {
    getPolicies: vi.fn(),
    getPolicy: vi.fn(),
    createPolicy: vi.fn(),
  },
}));
const api = vi.mocked(apiClient);
let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

beforeEach(() => {
  vi.resetAllMocks();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});
afterEach(() => client.clear());

describe('policy server state', () => {
  it('refreshes a mounted list after creation from any caller', async () => {
    api.getPolicies.mockResolvedValue([]);
    api.createPolicy.mockResolvedValue(undefined);
    const list = renderHook(() => usePolicies(), { wrapper });
    const creation = renderHook(() => useCreatePolicy(), { wrapper });
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true));
    await act(async () => {
      await creation.result.current.mutateAsync(
        policyFromForm(emptyPolicyForm),
      );
    });
    expect(api.getPolicies).toHaveBeenCalledTimes(2);
  });

  it('keeps failed creates visible to callers without invalidating cached policies', async () => {
    client.setQueryData(policyKeys.list, []);
    api.createPolicy.mockRejectedValue(
      new Error('An identical policy already exists'),
    );
    const { result } = renderHook(() => useCreatePolicy(), { wrapper });
    await act(async () => {
      await expect(
        result.current.mutateAsync(policyFromForm(emptyPolicyForm)),
      ).rejects.toThrow('An identical policy already exists');
    });
    expect(client.getQueryState(policyKeys.list)?.isInvalidated).toBe(false);
  });

  it('guards missing IDs and isolates analysis caches by range', async () => {
    const { rerender } = renderHook(
      ({ id, minutes }) => usePolicyDetail(id, minutes),
      { wrapper, initialProps: { id: '', minutes: 30 } },
    );
    expect(api.getPolicy).not.toHaveBeenCalled();
    api.getPolicy.mockRejectedValue(new Error('No fixture'));
    rerender({ id: 'policy', minutes: 30 });
    await waitFor(() =>
      expect(api.getPolicy).toHaveBeenCalledWith('policy', 30),
    );
    rerender({ id: 'policy', minutes: 60 });
    await waitFor(() =>
      expect(api.getPolicy).toHaveBeenCalledWith('policy', 60),
    );
    expect(client.getQueryState(policyKeys.detail('policy', 30))).toBeDefined();
    expect(client.getQueryState(policyKeys.detail('policy', 60))).toBeDefined();
  });
});
