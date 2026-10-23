import React from 'react';
import { apiClient } from '../../lib/api-client';
import type { Policy, PolicyEvaluation } from '../../lib/schemas';
import { PolicyTable, type PolicyRow } from './PolicyTable';
import { CreatePolicySheet } from './CreatePolicySheet';
import { Button } from '../../components/ui/button';
import { PolicyEvidence } from './PolicyEvidence';

export default function PoliciesPage() {
  const [policies, setPolicies] = React.useState<Policy[]>([]);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [results, setResults] = React.useState<
    Record<string, PolicyEvaluation>
  >({});
  const [selectedPolicyId, setSelectedPolicyId] = React.useState<string>();
  const emptyForm = {
    name: '',
    namespace: 'local',
    sourceService: '',
    destinationService: '',
    destination: '',
    subscription: '',
    thresholdSeconds: '1',
    requiredSuccessPercentage: '95',
    evaluationWindowMinutes: '30',
    minimumSampleCount: '1',
  };
  const [form, setForm] = React.useState(emptyForm);
  const load = React.useCallback(
    async () => setPolicies(await apiClient.getPolicies()),
    [],
  );
  React.useEffect(() => {
    void load();
  }, [load]);
  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    await apiClient.createPolicy({
      ...form,
      thresholdSeconds: Number(form.thresholdSeconds),
      requiredSuccessPercentage: Number(form.requiredSuccessPercentage),
      evaluationWindowMinutes: Number(form.evaluationWindowMinutes),
      minimumSampleCount: Number(form.minimumSampleCount),
      enabled: true,
    });
    setForm(emptyForm);
    await load();
  };
  const evaluate = async (id: string) => {
    const result = await apiClient.evaluatePolicy(id);
    if (result) {
      setResults((current) => ({ ...current, [id]: result }));
      setSelectedPolicyId(id);
    }
  };
  const rows = policies.map((policy): PolicyRow => ({
    ...policy,
    result: results[policy._id],
  }));
  const selectedPolicy = policies.find(
    (policy) => policy._id === selectedPolicyId,
  );
  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Policies</h1>
          <p className="text-sm text-muted-foreground">
            Define delivery-time expectations for captured backend messages.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>Create policy</Button>
      </div>
      <CreatePolicySheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        form={form}
        setForm={setForm}
        onSubmit={async (event) => {
          await create(event);
          setCreateOpen(false);
        }}
      />
      <PolicyTable policies={rows} onEvaluate={(id) => void evaluate(id)} />
      {selectedPolicyId && selectedPolicy && results[selectedPolicyId] && (
        <PolicyEvidence
          policy={selectedPolicy}
          evaluation={results[selectedPolicyId]}
        />
      )}
    </div>
  );
}
