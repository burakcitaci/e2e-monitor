import React from 'react';
import { apiClient } from '../../lib/api-client';
import type { Policy } from '../../lib/schemas';
import { PolicyTable } from './PolicyTable';
import { CreatePolicySheet } from './CreatePolicySheet';
import { Button } from '../../components/ui/button';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

export default function PoliciesPage() {
  const navigate = useNavigate();
  const [policies, setPolicies] = React.useState<Policy[]>([]);
  const [createOpen, setCreateOpen] = React.useState(false);
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
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 30_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [load]);
  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
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
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not create policy',
      );
      return false;
    }
  };
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
          if (await create(event)) setCreateOpen(false);
        }}
      />
      <PolicyTable
        policies={policies}
        onOpen={(id) => navigate(`/policies/${encodeURIComponent(id)}`)}
      />
    </div>
  );
}
