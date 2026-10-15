import { useState } from 'react';
import type { ScenarioPolicy, TestScenario } from '@e2e-monitor/entities';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';

const initialPolicy: ScenarioPolicy = {
  publisher: 'finance-api',
  consumer: 'payment-worker',
  messageType: 'PaymentRequested',
  provider: 'sqs',
  destination: 'payments',
  timeoutSeconds: 10,
};
const fields = [
  { key: 'publisher', label: 'Publisher service', maxLength: 100 },
  { key: 'consumer', label: 'Consumer service', maxLength: 100 },
  { key: 'messageType', label: 'Message type', maxLength: 150 },
  { key: 'destination', label: 'Queue or topic', maxLength: 260 },
] as const;

interface ScenarioFormProps {
  isSaving: boolean;
  isSaved: boolean;
  onSave: (input: Pick<TestScenario, 'name' | 'policy'>) => void;
}

export function ScenarioForm({ isSaving, isSaved, onSave }: ScenarioFormProps) {
  const [name, setName] = useState('Finance payment flow');
  const [policy, setPolicy] = useState<ScenarioPolicy>(initialPolicy);
  return (
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
          onSave({ name, policy });
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
          {fields.map(({ key, label, maxLength }) => (
            <div key={key}>
              <Label htmlFor={`policy-${key}`}>{label}</Label>
              <Input
                id={`policy-${key}`}
                required
                maxLength={maxLength}
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
                  provider: event.target.value as ScenarioPolicy['provider'],
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
        <Button disabled={isSaving} type="submit">
          {isSaving ? 'Saving…' : 'Save scenario'}
        </Button>
        {isSaved && (
          <p role="status" className="text-sm">
            Scenario saved.
          </p>
        )}
      </form>
    </section>
  );
}
