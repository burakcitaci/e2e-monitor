import type { TestRunSummary } from '@e2e-monitor/entities';
import { Badge } from '../../../components/ui/badge';
import { runStatusLabels } from '../lib/run-status';

interface RunHistoryProps {
  runs?: TestRunSummary[];
  isLoading: boolean;
  selectedId?: string;
  onSelect: (id: string) => void;
}

export function RunHistory({
  runs,
  isLoading,
  selectedId,
  onSelect,
}: RunHistoryProps) {
  return (
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
      {isLoading && <p role="status">Loading runs…</p>}
      {runs?.length === 0 && (
        <p>No runs yet. Choose a scenario and select Run demo.</p>
      )}
      <ul className="space-y-2 max-h-96 overflow-auto">
        {runs?.map((item) => (
          <li key={item.id}>
            <button
              className="w-full rounded-md border p-3 text-left hover:bg-accent focus-visible:outline-2"
              aria-pressed={selectedId === item.id}
              onClick={() => onSelect(item.id)}
            >
              <span className="font-medium">{item.scenarioName}</span>{' '}
              <Badge
                variant={item.status === 'failed' ? 'destructive' : 'outline'}
              >
                {runStatusLabels[item.status]}
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
  );
}
