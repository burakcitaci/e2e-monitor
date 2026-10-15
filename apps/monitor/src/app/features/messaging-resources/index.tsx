import { useState } from 'react';
import { DataTable } from '../../components/data-table';
import { DetailSheet } from './components/DetailSheet';
import { MessagingResource, Provider, ResourceType } from './lib/entities';
import { createColumns } from './components/Columns';
import {
  useCreateMessageResource,
  useGetMessageResources,
  useGetSqsQueueResources,
  useUpdateMessageResource,
} from './api/messaging-resource';
import { serviceBusConfig } from './lib/utils';

export default function MessagingResources() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [currentResource, setCurrentResource] =
    useState<MessagingResource | null>(null);
  const { data: messageResources } = useGetMessageResources();
  const { data: sqsResources, isLoading: sqsLoading, error: sqsError, refetch: refreshSqs } = useGetSqsQueueResources();

  const { mutate: createMessageResource } = useCreateMessageResource();
  const { mutate: updateMessageResource } = useUpdateMessageResource();
  const [form, setForm] = useState<Omit<MessagingResource, 'id'>>({
    name: '',
    provider: Provider.AWS,
    type: ResourceType.QUEUE,
    status: 'active',
  });

  const resetForm = () => {
    setForm({
      name: '',
      provider: Provider.AWS,
      type: ResourceType.QUEUE,
      status: 'active',
    });
    setEditing(false);
    setCurrentResource(null);
  };

  const handleSave = () => {
    if (editing) {
      if (!currentResource) return;
      updateMessageResource({
        id: currentResource.id,
        ...form,
      });
    } else {
      createMessageResource(form);
    }
    resetForm();
    setOpen(false);
  };

  const handleEdit = (resource: MessagingResource) => {
    setEditing(true);
    setCurrentResource(resource);
    setForm({
      name: resource.name,
      provider: resource.provider,
      type: resource.type,
      status: resource.status,
    });
    setOpen(true);
  };

  const handleDelete = (id: string) => {
    console.log(id);
  };

  const handleActivate = (id: string) => {
    console.log(id);
  };

  const allMessageResources: MessagingResource[] = [
    ...(messageResources ?? []),
    ...(sqsResources ?? []).filter((queue) => !(messageResources ?? []).some(
      (saved) => saved.provider === queue.provider && saved.type === queue.type && saved.name === queue.name,
    )),
    ...serviceBusConfig.Topics.map((topic) => ({
      id: `azure-topic-${topic.Name}`,
      name: topic.Name,
      provider: Provider.AZURE,
      type: ResourceType.TOPIC,
      status: 'active' as const,
    })),
    ...serviceBusConfig.Queues.map((queue) => ({
      id: `azure-queue-${queue.Name}`,
      name: queue.Name,
      provider: Provider.AZURE,
      type: ResourceType.QUEUE,
      status: 'active' as const,
    })),
  ];
  return (
    <div className="p-6 min-w-0">
      <div className="flex flex-col gap-1 mb-4">
        <h1 className="text-2xl font-bold">Queues and Topics</h1>
        <h2 className="text-sm text-muted-foreground">
          Manage your queues and topics here.
        </h2>
      </div>

      {sqsLoading && <p role="status">Discovering SQS queues…</p>}
      {sqsError && <div role="alert" className="mb-4 text-sm text-destructive">
        Could not load SQS queues: {sqsError.message}. Saved resources are still shown.
        <button className="ml-2 underline" onClick={() => refreshSqs()}>Retry</button>
      </div>}

      <DataTable
        searchKey="name"
        searchPlaceholder="Search resources..."
        columns={createColumns(handleActivate, handleEdit, handleDelete)}
        data={allMessageResources ?? []}
        onAdd={() => {
          setCurrentResource(null);
          setEditing(false);
          resetForm();
          setOpen(true);
        }}
      />
      <DetailSheet
        open={open}
        setOpen={setOpen}
        editing={editing}
        form={{ ...form, id: currentResource?.id ?? '' }}
        setForm={setForm}
        handleSave={handleSave}
      />
    </div>
  );
}
