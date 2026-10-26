import { IconBrandAws, IconBrandAzure } from '@tabler/icons-react';
import { MessagingResource } from '../lib/entities';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '../../../components/data-table/DataTableColumnHeader';
import { Badge } from '../../../components/ui/badge';

export const createColumns = (
  handleEdit: (resource: MessagingResource) => void,
  handleDelete: (resource: MessagingResource) => void,
): ColumnDef<MessagingResource>[] => {
  return [
    {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      accessorKey: 'name',

      cell: ({ row }) => <div>{row.original.name}</div>,
    },
    {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Provider" />
      ),
      accessorKey: 'provider',
      enableColumnFilter: true,
      filterFn: (row, _id, value: Array<'aws' | 'azure'>) =>
        value.includes(row.original.provider),
      meta: {
        variant: 'multiSelect',
        label: 'Provider',
        options: [
          { label: 'AWS', value: 'aws' },
          { label: 'Azure', value: 'azure' },
        ],
      },
      cell: ({ row }) =>
        row.original.provider === 'aws' ? (
          <IconBrandAws className="h-5 w-5" />
        ) : (
          <IconBrandAzure className="h-5 w-5" />
        ),
    },
    {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Type" />
      ),
      accessorKey: 'type',
      enableColumnFilter: true,
      filterFn: (row, _id, value: Array<'queue' | 'topic'>) =>
        value.includes(row.original.type),
      meta: {
        variant: 'multiSelect',
        label: 'Type',
        options: [
          { label: 'Queue', value: 'queue' },
          { label: 'Topic', value: 'topic' },
        ],
      },
      cell: ({ row }) => <div>{row.original.type}</div>,
    },
    {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      accessorKey: 'status',
      enableColumnFilter: true,
      filterFn: (row, _id, value: Array<'active' | 'inactive'>) =>
        value.includes(row.original.status),
      meta: {
        variant: 'multiSelect',
        label: 'Status',
        options: [
          { label: 'Active', value: 'active' },
          { label: 'Inactive', value: 'inactive' },
        ],
      },
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Badge variant={row.original.status === 'active' ? 'default' : 'outline'}>
            {row.original.status}
          </Badge>
          <Badge variant="secondary">
            {row.original.brokerAddress ? 'Synced' : 'Unknown'}
          </Badge>
        </div>
      ),
    },
    {
      id: 'actions', // 👈 better than accessorKey for non-data columns
      cell: ({ row }) => (
        <div className="flex gap-2 justify-end">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Edit ${row.original.name}`}
            onClick={() => handleEdit(row.original)}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete ${row.original.name}`}
            onClick={() => handleDelete(row.original)}
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];
};
