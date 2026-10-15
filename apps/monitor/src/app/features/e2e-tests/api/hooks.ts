import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DemoOutcome, TestScenario } from '@e2e-monitor/entities';
import { apiClient } from '../../../lib/api-client';

export const e2eTestKeys = {
  scenarios: ['e2e-scenarios'] as const,
  runs: ['e2e-runs'] as const,
  run: (id?: string) => ['e2e-run', id] as const,
};

export function useTestScenarios() {
  return useQuery({
    queryKey: e2eTestKeys.scenarios,
    queryFn: () => apiClient.getTestScenarios(),
  });
}

export function useTestRuns() {
  return useQuery({
    queryKey: e2eTestKeys.runs,
    queryFn: () => apiClient.getTestRuns(),
    refetchInterval: 3000,
  });
}

export function useTestRun(id?: string) {
  return useQuery({
    queryKey: e2eTestKeys.run(id),
    queryFn: () => {
      if (!id) throw new Error('Select a test run.');
      return apiClient.getTestRun(id);
    },
    enabled: Boolean(id),
    refetchInterval: (query) =>
      query.state.data?.status === 'running' ? 1000 : false,
  });
}

export function useCreateTestScenario() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: Pick<TestScenario, 'name' | 'policy'>) =>
      apiClient.createTestScenario(input),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: e2eTestKeys.scenarios }),
  });
}

export function useStartDemoRun() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      scenarioId,
      outcome,
    }: {
      scenarioId: string;
      outcome: DemoOutcome;
    }) => apiClient.startDemoRun(scenarioId, outcome),
    onSuccess: (run) => {
      client.setQueryData(e2eTestKeys.run(run.id), run);
      void client.invalidateQueries({ queryKey: e2eTestKeys.runs });
    },
  });
}
