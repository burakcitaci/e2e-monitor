import { useState } from 'react';
import { DataTable } from '../../components/data-table';
import { DetailSheet } from './components/DetailSheet';
import { MessagingResource, Provider, ResourceType } from './lib/entities';
import { createColumns } from './components/Columns';
import {
  useCreateMessageResource,
  useGetMessageResources,
  useUpdateMessageResource,
} from './api/messaging-resource';
import { serviceBusConfig } from './lib/utils';
import { toast } from 'sonner';

export default function MessagingResources() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [currentResource, setCurrentResource] =
    useState<MessagingResource | null>(null);
  const { data: messageResources } = useGetMessageResources();

  const { mutateAsync: createMessageResource, isPending: creating } =
    useCreateMessageResource();
  const { mutateAsync: updateMessageResource, isPending: updating } =
    useUpdateMessageResource();
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

  const handleSave = async () => {
    try {
      if (editing) {
        if (!currentResource) return;
        await updateMessageResource({
          id: currentResource.id,
          ...form,
        });
      } else {
        await createMessageResource(form);
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
          Manage saved destination metadata. This does not create or modify
          broker resources.
        </h2>
      </div>

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
        form={form}
        saving={creating || updating}
        setForm={setForm}
        handleSave={handleSave}
      />
    </div>
  );
}
