import { useState } from 'react';
import {
  useCreateTestScenario,
  useStartDemoRun,
  useTestRun,
  useTestRuns,
  useTestScenarios,
} from './api/hooks';
import { ScenarioForm } from './components/ScenarioForm';
import { ScenarioList } from './components/ScenarioList';
import { RunHistory } from './components/RunHistory';
import { RunTimeline } from './components/RunTimeline';

export default function E2eTestsPage() {
  const [selectedId, setSelectedId] = useState<string>();
  const scenarios = useTestScenarios();
  const runs = useTestRuns();
  const detail = useTestRun(selectedId);
  const create = useCreateTestScenario();
  const start = useStartDemoRun();
  const error =
    create.error ??
    start.error ??
    scenarios.error ??
    runs.error ??
    detail.error;

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
        <ScenarioForm
          isSaving={create.isPending}
          isSaved={create.isSuccess}
          onSave={(input) => create.mutate(input)}
        />
        <ScenarioList
          scenarios={scenarios.data}
          isLoading={scenarios.isLoading}
          isStarting={start.isPending}
          onStart={(scenarioId, outcome) =>
            start.mutate(
              { scenarioId, outcome },
              { onSuccess: (run) => setSelectedId(run.id) },
            )
          }
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <RunHistory
          runs={runs.data}
          isLoading={runs.isLoading}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <RunTimeline
          run={detail.data}
          isLoading={detail.isLoading}
          hasSelection={Boolean(selectedId)}
        />
      </div>
    </main>
  );
}
