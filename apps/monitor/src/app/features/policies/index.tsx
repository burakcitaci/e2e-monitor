import React from 'react';
import { PolicyTable } from './components/PolicyTable';
import { CreatePolicySheet } from './components/CreatePolicySheet';
import { Button } from '../../components/ui/button';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Page, PageHeader, PageState } from '../../components/common/Page';
import { useCreatePolicy, usePolicies } from './api/hooks';
import { emptyPolicyForm, policyFromForm } from './lib/policy-form';

export default function PoliciesPage() {
  const navigate = useNavigate();
  const { data: policies = [], isLoading, error, refetch } = usePolicies();
  const createPolicy = useCreatePolicy();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [form, setForm] = React.useState(emptyPolicyForm);
  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await createPolicy.mutateAsync(policyFromForm(form));
      setForm(emptyPolicyForm);
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not create policy',
      );
      return false;
    }
  };
  return (
    <Page>
      <PageHeader
        title="Policies"
        description="Define delivery-time expectations for captured backend messages."
        actions={
          <Button onClick={() => setCreateOpen(true)}>Create policy</Button>
        }
      />
      {isLoading && <PageState title="Loading policies…" />}
      {error && (
        <PageState
          title="Could not load policies"
          description={error.message}
          retry={() => void refetch()}
        />
      )}
      <CreatePolicySheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        form={form}
        setForm={setForm}
        pending={createPolicy.isPending}
        onSubmit={async (event) => {
          if (await create(event)) setCreateOpen(false);
        }}
      />
      <PolicyTable
        policies={policies}
        onOpen={(id) => navigate(`/policies/${encodeURIComponent(id)}`)}
      />
    </Page>
  );
}
