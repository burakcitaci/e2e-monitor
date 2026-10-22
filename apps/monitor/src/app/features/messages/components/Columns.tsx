import { Link } from 'react-router';
import type { ColumnDef, Row } from '@tanstack/react-table';
import type { TrackingMessage } from '@e2e-monitor/entities';
import { DataTableColumnHeader } from '../../../components/data-table';
import { Badge } from '../../../components/ui/badge';
import type { Option } from '../../../types/data-table';
import { MessageActions } from './MessageActions';
import {
  messageDetailPath,
  messageStatus,
  messageStatusLabels,
} from '../message-presentation';

const MessageActionsCell = ({ row }: { row: Row<TrackingMessage> }) => (
  <MessageActions message={row.original} />
);
type Filter = (
  row: Row<TrackingMessage>,
  id: string,
  value: unknown,
) => boolean;

export const createColumns = (
  sentByOptions: Option[],
  sentByFilterFn: Filter,
  statusFilterFn: Filter,
): ColumnDef<TrackingMessage>[] => [
  { id: 'actions', header: 'Actions', cell: MessageActionsCell },
  {
    accessorKey: 'body',
    header: 'Message',
    cell: ({ row }) => {
      const message = row.original;
      return (
        <Link
          to={messageDetailPath(message)}
          className="block max-w-64 truncate font-mono text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:underline"
          title={message.body}
        >
          {message.body || 'View message'}
        </Link>
      );
    },
  },
  {
    accessorKey: 'queue',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Destination" />
    ),
    cell: ({ row }) => (
      <div className="max-w-48 truncate text-xs" title={row.original.queue}>
        {row.original.queue || '-'}
      </div>
    ),
  },
  {
    accessorKey: 'sentBy',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Services" />
    ),
    cell: ({ row }) => (
      <div className="text-xs max-w-40">
        <p className="truncate" title={row.original.sentBy}>
          {row.original.sentBy || 'Unknown publisher'}
        </p>
        <p
          className="truncate text-muted-foreground"
          title={row.original.receivedBy}
        >
          → {row.original.receivedBy || 'Awaiting subscriber'}
        </p>
      </div>
    ),
    enableColumnFilter: true,
    filterFn: sentByFilterFn,
    meta: {
      variant: 'multiSelect',
      label: 'Publisher',
      options: sentByOptions,
    },
  },
  {
    id: 'status',
    accessorFn: messageStatus,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = messageStatus(row.original);
      return (
        <Badge
          variant={
            status === 'completed'
              ? 'default'
              : status === 'deadletter'
                ? 'destructive'
                : 'outline'
          }
        >
          {messageStatusLabels[status] ?? status}
        </Badge>
      );
    },
    enableColumnFilter: true,
    filterFn: statusFilterFn,
    meta: {
      variant: 'multiSelect',
      label: 'Status',
      options: [
        { label: 'Sent', value: 'sent' },
        { label: 'Processing', value: 'processing' },
        { label: 'Received', value: 'received' },
        { label: 'Completed', value: 'completed' },
        { label: 'Pending', value: 'pending' },
        { label: 'Abandoned', value: 'abandon' },
        { label: 'Deferred', value: 'defer' },
        { label: 'Dead-lettered', value: 'deadletter' },
      ],
    },
  },
  {
    accessorKey: 'sentAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Sent At" />
    ),
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {row.original.sentAt
          ? new Date(row.original.sentAt).toLocaleString()
          : 'Not reported'}
      </span>
    ),
  },
];
