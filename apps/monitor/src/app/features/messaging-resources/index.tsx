import { useState } from 'react';
import { DataTable } from '../../components/data-table';
import { DetailSheet } from './components/DetailSheet';
import type { MessagingResource } from './lib/entities';
import { createColumns } from './components/Columns';
import {
  useCreateMessageResource,
  useGetMessageResources,
  useUpdateMessageResource,
  useDeleteMessageResource,
} from './api/hooks';
import { emptyResourceForm, resourceForm } from './lib/resource-form';
import { toast } from 'sonner';
import { Page, PageHeader, PageState } from '../../components/common/Page';
import { StatisticsCards } from '../../components/common/StatisticsCards';

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
  const { mutateAsync: deleteMessageResource, isPending: deleting } =
    useDeleteMessageResource();
  const [form, setForm] = useState(emptyResourceForm);
  const resources = messageResources ?? [];
  const statistics = [
    { label: 'Total Resources', value: resources.length },
    {
      label: 'Active',
      value: resources.filter((resource) => resource.status === 'active')
        .length,
    },
    {
      label: 'Queues',
      value: resources.filter((resource) => resource.type === 'queue').length,
    },
    {
      label: 'Topics',
      value: resources.filter((resource) => resource.type === 'topic').length,
    },
  ];

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

      <StatisticsCards items={statistics} />

      <DataTable
        tableClassName="[&_th:last-child]:w-px [&_td:last-child]:whitespace-nowrap"
        searchKey="name"
        searchPlaceholder="Search resources..."
        columns={createColumns()}
        onEditRow={handleEdit}
        onDeleteRow={(resource) => deleteMessageResource(resource.id)}
        deleteDescription="This deletes the selected resources from the broker and MongoDB. This cannot be undone."
        data={resources}
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
        saving={creating || updating || deleting}
        setForm={setForm}
        handleSave={handleSave}
      />
    </Page>
  );
}
