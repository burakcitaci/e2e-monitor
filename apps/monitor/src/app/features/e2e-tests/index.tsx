import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  DemoOutcome,
  RunStatus,
  ScenarioPolicy,
} from '@e2e-monitor/entities';
import { apiClient } from '../../lib/api-client';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';

const statusLabels: Record<RunStatus, string> = {
  running: 'Running',
  passed: 'Passed',
  failed: 'Failed',
  timed_out: 'Timed out',
};
const initialPolicy: ScenarioPolicy = {
  publisher: 'finance-api',
  consumer: 'payment-worker',
  messageType: 'PaymentRequested',
  provider: 'sqs',
  destination: 'payments',
  timeoutSeconds: 10,
};
const fields = [
  ['publisher', 'Publisher service'],
  ['consumer', 'Consumer service'],
  ['messageType', 'Message type'],
  ['destination', 'Queue or topic'],
] as const;

export default function E2eTestsPage() {
  const client = useQueryClient();
  const [name, setName] = useState('Finance payment flow');
  const [policy, setPolicy] = useState<ScenarioPolicy>(initialPolicy);
  const [outcome, setOutcome] = useState<DemoOutcome>('pass');
  const [selectedId, setSelectedId] = useState<string>();
  const scenarios = useQuery({
    queryKey: ['e2e-scenarios'],
    queryFn: () => apiClient.getTestScenarios(),
  });
  const runs = useQuery({
    queryKey: ['e2e-runs'],
    queryFn: () => apiClient.getTestRuns(),
    refetchInterval: 3000,
  });
  const detail = useQuery({
    queryKey: ['e2e-run', selectedId],
    queryFn: () => {
      if (!selectedId) throw new Error('Select a test run.');
      return apiClient.getTestRun(selectedId);
    },
    enabled: Boolean(selectedId),
    refetchInterval: (query) =>
      query.state.data?.status === 'running' ? 1000 : false,
  });
  const create = useMutation({
    mutationFn: () => apiClient.createTestScenario({ name, policy }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['e2e-scenarios'] }),
  });
  const start = useMutation({
    mutationFn: (id: string) => apiClient.startDemoRun(id, outcome),
    onSuccess: (run) => {
      client.setQueryData(['e2e-run', run.id], run);
      setSelectedId(run.id);
      void client.invalidateQueries({ queryKey: ['e2e-runs'] });
    },
  });
  const error =
    create.error ??
    start.error ??
    scenarios.error ??
    runs.error ??
    detail.error;
  const run = detail.data;

  return (
    <main className="p-6 space-y-6 min-w-0">
      <div>
        <h1 className="text-2xl font-bold">E2E Tests</h1>
        <p className="text-muted-foreground">
          Define a policy and follow a message from publisher to successful
          processing.
        </p>
      </div>
      <div className="rounded-lg border border-amber-500 p-4" role="note">
        <strong>Demo mode — simulated backends</strong>
        <p className="text-sm">
          These runs demonstrate policy evaluation. They do not send or consume
          broker messages, call your backends, or prove a real business flow.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-destructive">
          {error.message}
        </p>
      )}
      <div className="grid gap-6 xl:grid-cols-2">
        <section
          className="rounded-lg border p-4 space-y-4"
          aria-labelledby="create-scenario-title"
        >
          <h2 id="create-scenario-title" className="font-semibold text-lg">
            Create scenario
          </h2>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate();
            }}
          >
            <div>
              <Label htmlFor="scenario-name">Scenario name</Label>
              <Input
                id="scenario-name"
                required
                maxLength={120}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map(([key, label]) => (
                <div key={key}>
                  <Label htmlFor={`policy-${key}`}>{label}</Label>
                  <Input
                    id={`policy-${key}`}
                    required
                    maxLength={
                      key === 'destination'
                        ? 260
                        : key === 'messageType'
                          ? 150
                          : 100
                    }
                    value={policy[key]}
                    onChange={(event) =>
                      setPolicy({ ...policy, [key]: event.target.value })
                    }
                  />
                </div>
              ))}
              <div>
                <Label htmlFor="policy-provider">Provider</Label>
                <select
                  id="policy-provider"
                  className="w-full rounded-md border bg-background p-2"
                  value={policy.provider}
                  onChange={(event) =>
                    setPolicy({
                      ...policy,
                      provider: event.target
                        .value as ScenarioPolicy['provider'],
                    })
                  }
                >
                  <option value="sqs">AWS SQS</option>
                  <option value="azure-service-bus">Azure Service Bus</option>
                </select>
              </div>
              <div>
                <Label htmlFor="policy-timeout">Deadline (seconds)</Label>
                <Input
                  id="policy-timeout"
                  type="number"
                  required
                  min={1}
                  max={3600}
                  step={1}
                  value={policy.timeoutSeconds}
                  onChange={(event) =>
                    setPolicy({
                      ...policy,
                      timeoutSeconds: Number(event.target.value),
                    })
                  }
                />
              </div>
            </div>
            <Button disabled={create.isPending} type="submit">
              {create.isPending ? 'Saving…' : 'Save scenario'}
            </Button>
            {create.isSuccess && (
              <p role="status" className="text-sm">
                Scenario saved.
              </p>
            )}
          </form>
        </section>
        <section
          className="rounded-lg border p-4 space-y-4"
          aria-labelledby="scenarios-title"
        >
          <h2 id="scenarios-title" className="font-semibold text-lg">
            Scenarios
          </h2>
          <div>
            <Label htmlFor="demo-outcome">Simulated outcome</Label>
            <select
              id="demo-outcome"
              className="w-full rounded-md border bg-background p-2"
              value={outcome}
              onChange={(event) =>
                setOutcome(event.target.value as DemoOutcome)
              }
            >
              <option value="pass">Successful processing</option>
              <option value="fail">Consumer failure</option>
              <option value="timeout">Missing consumer (timeout)</option>
            </select>
          </div>
          {scenarios.isLoading && <p role="status">Loading scenarios…</p>}
          {scenarios.data?.length === 0 && (
            <p>No scenarios yet. Save a policy to start your first demo.</p>
          )}
          <ul className="space-y-3 max-h-96 overflow-auto">
            {scenarios.data?.map((scenario) => (
              <li key={scenario.id} className="rounded-md border p-3 space-y-2">
                <h3 className="font-semibold">{scenario.name}</h3>
                <p className="text-sm break-words">
                  {scenario.policy.publisher} → {scenario.policy.consumer} ·{' '}
                  {scenario.policy.messageType}
                </p>
                <p className="text-sm text-muted-foreground">
                  {scenario.policy.provider} · {scenario.policy.destination} ·
                  within {scenario.policy.timeoutSeconds}s
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={start.isPending}
                  onClick={() => start.mutate(scenario.id)}
                >
                  Run demo
                </Button>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <section
          className="rounded-lg border p-4 space-y-3"
          aria-labelledby="runs-title"
        >
          <h2 id="runs-title" className="font-semibold text-lg">
            Recent runs
          </h2>
          <p className="text-sm text-muted-foreground">
            Latest 50 runs. Every result here is simulated.
          </p>
          {runs.isLoading && <p role="status">Loading runs…</p>}
          {runs.data?.length === 0 && (
            <p>No runs yet. Choose a scenario and select Run demo.</p>
          )}
          <ul className="space-y-2 max-h-96 overflow-auto">
            {runs.data?.map((item) => (
              <li key={item.id}>
                <button
                  className="w-full rounded-md border p-3 text-left hover:bg-accent focus-visible:outline-2"
                  aria-pressed={selectedId === item.id}
                  onClick={() => setSelectedId(item.id)}
                >
                  <span className="font-medium">{item.scenarioName}</span>{' '}
                  <Badge
                    variant={
                      item.status === 'failed' ? 'destructive' : 'outline'
                    }
                  >
                    {statusLabels[item.status]}
                  </Badge>{' '}
                  <Badge variant="secondary">Simulated</Badge>
                  <span className="block text-sm text-muted-foreground">
                    {new Date(item.startedAt).toLocaleString()}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section
          className="rounded-lg border p-4 space-y-3 min-w-0"
          aria-labelledby="timeline-title"
        >
          <h2 id="timeline-title" className="font-semibold text-lg">
            Run timeline
          </h2>
          {!selectedId && <p>Select a run to inspect its evidence.</p>}
          {detail.isLoading && selectedId && (
            <p role="status">Loading timeline…</p>
          )}
          {run && (
            <>
              <p role="status">
                <strong>{statusLabels[run.status]}</strong> · Simulated run
              </p>
              <p>{run.reason}</p>
              <dl className="text-sm space-y-1">
                <dt className="font-medium">Correlation ID</dt>
                <dd className="font-mono break-all">{run.correlationId}</dd>
                <dt className="font-medium">Deadline</dt>
                <dd>{new Date(run.deadlineAt).toLocaleString()}</dd>
                <dt className="font-medium">Policy snapshot</dt>
                <dd>
                  {run.policy.publisher} → {run.policy.consumer}:{' '}
                  {run.policy.messageType}, {run.policy.destination}, within{' '}
                  {run.policy.timeoutSeconds}s
                </dd>
              </dl>
              {run.evidence.length === 0 && (
                <p>Waiting for simulated publisher evidence…</p>
              )}
              <ol className="space-y-3" aria-label="Evidence timeline">
                {run.evidence.map((event) => (
                  <li key={event.eventId} className="border-l-2 pl-3">
                    <p className="font-medium">
                      {event.service} · {event.kind}
                    </p>
                    <p className="text-sm">{event.detail}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(event.receivedAt).toLocaleTimeString()}
                    </p>
                    <p className="text-xs font-mono break-all">
                      Message: {event.messageId}
                    </p>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
