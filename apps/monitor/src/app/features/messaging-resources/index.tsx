import { useState } from 'react';
import { DataTable } from '../../components/data-table';
import { DetailSheet } from './components/DetailSheet';
import type { MessagingResource } from './lib/entities';
import { createColumns } from './components/Columns';
import {
  useCreateMessageResource,
  useGetMessageResources,
  useUpdateMessageResource,
} from './api/hooks';
import { emptyResourceForm, resourceForm } from './lib/resource-form';
import { toast } from 'sonner';
import { Page, PageHeader, PageState } from '../../components/common/Page';

export default function MessagingResources() {
  const [open, setOpen] = useState(false);
  const [currentResource, setCurrentResource] =
    useState<MessagingResource | null>(null);
  const {
    data: messageResources,
    isLoading,
    error,
    refetch,
  } = useGetMessageResources();

  const { mutateAsync: createMessageResource, isPending: creating } =
    useCreateMessageResource();
  const { mutateAsync: updateMessageResource, isPending: updating } =
    useUpdateMessageResource();
  const [form, setForm] = useState(emptyResourceForm);

  const resetForm = () => {
    setForm(emptyResourceForm);
    setCurrentResource(null);
  };

  const handleSave = async () => {
    try {
      const resource = {
        ...form,
        ...(form.subscriptions
          ? {
              subscriptions: [
                ...new Set(
                  form.subscriptions.map((name) => name.trim()).filter(Boolean),
                ),
              ],
            }
          : {}),
      };
      if (currentResource) {
        await updateMessageResource({
          id: currentResource.id,
          ...resource,
        });
      } else {
        await createMessageResource(resource);
      }
      resetForm();
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not save resource',
      );
    }
  };

  const handleEdit = (resource: MessagingResource) => {
    setCurrentResource(resource);
    setForm(resourceForm(resource));
    setOpen(true);
  };

  return (
    <Page>
      <PageHeader
        title="Queues and Topics"
        description="Create queues and topics in Azure Service Bus or AWS, then persist their records in MongoDB."
      />
      {isLoading && <PageState title="Loading resources…" />}
      {error && (
        <PageState
          title="Could not load resources"
          description={error.message}
          retry={() => void refetch()}
        />
      )}

      <DataTable
        searchKey="name"
        searchPlaceholder="Search resources..."
        columns={createColumns(handleEdit)}
        data={messageResources ?? []}
        onAdd={() => {
          resetForm();
          setOpen(true);
        }}
      />
      <DetailSheet
        open={open}
        setOpen={setOpen}
        editing={currentResource !== null}
        form={form}
        saving={creating || updating}
        setForm={setForm}
        handleSave={handleSave}
      />
    </Page>
  );
}
