import { useState } from 'react';
import type { DemoOutcome, TestScenario } from '@e2e-monitor/entities';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';

interface ScenarioListProps {
  scenarios?: TestScenario[];
  isLoading: boolean;
  isStarting: boolean;
  onStart: (scenarioId: string, outcome: DemoOutcome) => void;
}

export function ScenarioList({
  scenarios,
  isLoading,
  isStarting,
  onStart,
}: ScenarioListProps) {
  const [outcome, setOutcome] = useState<DemoOutcome>('pass');
  return (
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
          onChange={(event) => setOutcome(event.target.value as DemoOutcome)}
        >
          <option value="pass">Successful processing</option>
          <option value="fail">Consumer failure</option>
          <option value="timeout">Missing consumer (timeout)</option>
        </select>
      </div>
      {isLoading && <p role="status">Loading scenarios…</p>}
      {scenarios?.length === 0 && (
        <p>No scenarios yet. Save a policy to start your first demo.</p>
      )}
      <ul className="space-y-3 max-h-96 overflow-auto">
        {scenarios?.map((scenario) => (
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
              disabled={isStarting}
              onClick={() => onStart(scenario.id, outcome)}
            >
              Run demo
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
