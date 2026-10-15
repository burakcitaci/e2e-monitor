import { MessageActions } from '../../messages/components/MessageActions';
import { ColumnDef, Row } from '@tanstack/react-table';
import { Eye, Trash } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { DataTableColumnHeader } from '../../../components/data-table/DataTableColumnHeader';
import { Option, SqsMessageRow, TrackingMessage } from '../lib/entities';

export const createColumns = (
  onMessageSelect: (message: TrackingMessage) => void,
  onMessageDelete: (messageId: string) => void,
  sentByOptions: Option[],
  receivedByOptions: Option[],
  dispositionOptions: Option[],
  sentByFilterFn: (row: Row<SqsMessageRow>, id: string, value: unknown) => boolean,
  receivedByFilterFn: (row: Row<SqsMessageRow>, id: string, value: unknown) => boolean,
  dispositionFilterFn: (row: Row<SqsMessageRow>, id: string, value: unknown) => boolean
): ColumnDef<SqsMessageRow>[] => [
  {
    accessorKey: 'sentBy',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Sent By" />
    ),
    cell: ({ row }) => {
      return (
        <div className="text-xs truncate max-w-32">
          {row.original.sentBy || '-'}
        </div>
      );
    },
    enableColumnFilter: true,
    filterFn: sentByFilterFn,
    meta: {
      variant: 'multiSelect',
      label: 'Sent By',
      options: sentByOptions,
    },
    
  },
  {
    accessorKey: 'receivedBy',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Received By" />
    ),
    cell: ({ row }) => {
      return (
        <div className="text-xs truncate max-w-32">
          {row.original.receivedBy || '-'}
        </div>
      );
    },
     enableColumnFilter: true,
    filterFn: receivedByFilterFn,
    meta: {
      variant: 'multiSelect',
      label: 'Received By',
      options: receivedByOptions,
    },
  },
  {
    id: 'source',
    accessorKey: 'source',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Source" />
    ),
    cell: ({ row }) => {
      const source = row.original.source;
      return (
        <Badge
          variant={source === 'queue' ? 'default' : 'secondary'}
          className="text-xs px-2 py-0.5 h-5"
        >
          {source === 'queue' ? 'Queue' : 'Tracking'}
        </Badge>
      );
    },
  },
  {
    id: 'disposition',
    accessorKey: 'disposition',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Disposition" />
    ),
    cell: ({ row }) => {
      const disposition = row.original.disposition;
      const variantMap: Record<
        string,
        'default' | 'secondary' | 'destructive' | 'outline'
      > = {
        complete: 'default',
        abandon: 'secondary',
        deadletter: 'destructive',
        defer: 'outline',
      };

      return (
        <Badge
          variant={variantMap[disposition] || 'secondary'}
          className="text-xs px-2 py-0.5 h-5"
        >
          {disposition}
        </Badge>
      );
    },
    enableColumnFilter: true,
    filterFn: dispositionFilterFn,
    meta: {
      variant: 'multiSelect',
      label: 'Disposition',
      options: dispositionOptions,
    },
  },
  {
    accessorKey: 'body',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Body" />
    ),
    cell: ({ row }) => {
      const body = row.original.body;
      let bodyText = 'N/A';

      if (typeof body === 'string') {
        bodyText = body;
      } else if (typeof body === 'object' && body !== null) {
        const isEmpty = Object.keys(body).length === 0;
        bodyText = isEmpty ? '{}' : JSON.stringify(body, null, 2);
      }

      return (
        <div className="max-w-48 truncate text-xs leading-tight">
          {bodyText}
        </div>
      );
    },
  },
  {
    accessorKey: 'sentAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Sent At" />
    ),
    cell: ({ row }) => {
      const timestamp = row.original.sentAt;
      return (
        <div className="text-xs text-muted-foreground whitespace-nowrap">
          {timestamp ? timestamp.toLocaleString() : 'N/A'}
        </div>
      );
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      return (
        <div className="flex gap-1">
          <MessageActions message={row.original as TrackingMessage} />
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => {
              // Assuming row.original has tracking message data
              console.log(row.original);
              if ('_id' in row.original) {
                onMessageSelect(row.original as TrackingMessage);
              }
            }}
          >
            <Eye className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => {
              onMessageDelete(
                (row.original as TrackingMessage)._id ??
                  row.original.messageId,
              );
            }}
          >
            <Trash className="h-3 w-3" />
          </Button>
        </div>
      );
    },
  },
];
