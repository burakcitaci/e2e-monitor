import React from 'react';
import { PolicyTable } from './components/PolicyTable';
import { CreatePolicySheet } from './components/CreatePolicySheet';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Page, PageHeader, PageState } from '../../components/common/Page';
import { StatisticsCards } from '../../components/common/StatisticsCards';
import {
  useCreatePolicy,
  useDeletePolicy,
  usePolicies,
  useUpdatePolicy,
} from './api/hooks';
import { emptyPolicyForm, policyFromForm } from './lib/policy-form';
import type { Policy } from '../../lib/schemas';

export default function PoliciesPage() {
  const navigate = useNavigate();
  const { data: policies = [], isLoading, error, refetch } = usePolicies();
  const createPolicy = useCreatePolicy();
  const updatePolicy = useUpdatePolicy();
  const deletePolicy = useDeletePolicy();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Policy | null>(null);
  const [form, setForm] = React.useState(emptyPolicyForm);
  const statistics = [
    { label: 'Total Policies', value: policies.length },
    {
      label: 'Enabled',
      value: policies.filter((policy) => policy.enabled).length,
    },
    {
      label: 'Passing',
      value: policies.filter(
        (policy) => policy.latestEvaluation?.status === 'pass',
      ).length,
    },
    {
      label: 'Failing',
      value: policies.filter(
        (policy) => policy.latestEvaluation?.status === 'fail',
      ).length,
    },
  ];
  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (editing)
        await updatePolicy.mutateAsync({
          id: editing._id,
          policy: policyFromForm(form),
        });
      else await createPolicy.mutateAsync(policyFromForm(form));
      setForm(emptyPolicyForm);
      setEditing(null);
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not save policy',
      );
      return false;
    }
  };
  return (
    <Page>
      <PageHeader
        title="Policies"
        description="Define delivery-time expectations for captured backend messages."
      />
      {isLoading && <PageState title="Loading policies…" />}
      {error && (
        <PageState
          title="Could not load policies"
          description={error.message}
          retry={() => void refetch()}
        />
      )}
      <StatisticsCards items={statistics} />
      <CreatePolicySheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        form={form}
        setForm={setForm}
        editing={editing !== null}
        pending={createPolicy.isPending || updatePolicy.isPending}
        onSubmit={async (event) => {
          if (await create(event)) setCreateOpen(false);
        }}
      />
      <PolicyTable
        onAdd={() => {
          setEditing(null);
          setForm(emptyPolicyForm);
          setCreateOpen(true);
        }}
        onDeleteRow={(policy) => deletePolicy.mutateAsync(policy._id)}
        policies={policies}
        onOpen={(id) => navigate(`/policies/${encodeURIComponent(id)}`)}
        onEdit={(policy) => {
          setEditing(policy);
          setForm({
            ...policy,
            thresholdSeconds: String(policy.thresholdSeconds),
            requiredSuccessPercentage: String(policy.requiredSuccessPercentage),
            evaluationWindowMinutes: String(policy.evaluationWindowMinutes),
            minimumSampleCount: String(policy.minimumSampleCount),
          });
          setCreateOpen(true);
        }}
      />
    </Page>
  );
}
