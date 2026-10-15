import { DataTableColumnHeader } from "../../../components/data-table";
import { Option } from '../../../types/data-table';
import { Row } from "@tanstack/react-table";
import { TrackingMessage } from "@e2e-monitor/entities";
import { Badge } from "../../../components/ui/badge";
import { ColumnDef } from "@tanstack/react-table";
import { MessageActions } from './MessageActions';

// Keep this component identity stable when polling rebuilds filter options.
const MessageActionsCell = ({ row }: { row: Row<TrackingMessage> }) => (
  <MessageActions message={row.original} />
);

export const createColumns = (
  sentByOptions: Option[],
  receivedByOptions: Option[],
  emulatorTypeOptions: Option[],
  sentByFilterFn: (row: Row<TrackingMessage>, id: string, value: unknown) => boolean,
  receivedByFilterFn: (row: Row<TrackingMessage>, id: string, value: unknown) => boolean,
  emulatorTypeFilterFn: (row: Row<TrackingMessage>, id: string, value: unknown) => boolean,
  statusFilterFn: (row: Row<TrackingMessage>, id: string, value: unknown) => boolean,
): ColumnDef<TrackingMessage>[] => [
  {
    id: 'actions',
    header: 'Actions',
    cell: MessageActionsCell,
  },
  {
    accessorKey: 'body',
    header: 'Message',
    cell: ({ row }) => (
      <div
        className="max-w-56 truncate text-xs font-mono"
        title={row.original.body}
      >
        {row.original.body}
      </div>
    ),
  },
  {
    accessorKey: 'queue',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Queue" />
    ),
    cell: ({ row }) => {
      return (
        <div className="text-xs truncate max-w-32">
          {row.original.queue || '-'}
        </div>
      );
    },
  },
  {
    accessorKey: 'emulatorType',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Emulator" />
    ),
    cell: ({ row }) => {
      const emulatorType = row.original.emulatorType;
      const displayText = emulatorType === 'azure-service-bus' ? 'Azure SB' :
                         emulatorType === 'sqs' ? 'SQS' :
                         emulatorType || '-';

      return <div className="text-xs">
          {displayText}
        </div>;
    },
    enableColumnFilter: true,
    filterFn: emulatorTypeFilterFn,
    meta: {
      variant: 'multiSelect',
      label: 'Emulator',
      options: emulatorTypeOptions,
    },
  },
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
      const status = row.original.status;
      const receivedBy = row.original.receivedBy;
      
      if (status === 'processing') {
        return (
          <Badge variant="outline" className="text-xs px-2 py-0.5 h-5">
            Pending
          </Badge>
        );
      }
      
      return (
        <div className="text-xs truncate max-w-32">
          {receivedBy || '-'}
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
    id: 'status',
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = row.original.status;
      const variantMap: Record<string, 'default' | 'secondary' | 'outline'> = {
        received: 'default',
        processing: 'outline',
        sent: 'secondary',
      };
      return (
        <Badge
          variant={variantMap[status] || 'secondary'}
          className="text-xs px-2 py-0.5 h-5"
        >
          {row.original.pendingDeliveries?.length
            ? 'Pending'
            : status.charAt(0).toUpperCase() + status.slice(1)}
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
      ] as Option[],
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
      const status = row.original.status;
      
      // Show "Processing" badge when message is being processed
      if (status === 'processing') {
        return (
          <Badge variant="outline" className="text-xs px-2 py-0.5 h-5">
            Pending
          </Badge>
        );
      }
      
      // Only show disposition when message has been received/processed
      if (status !== 'received' || !disposition) {
        return <div className="text-xs text-muted-foreground">-</div>;
      }
      
      const variantMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
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
          {disposition.charAt(0).toUpperCase() + disposition.slice(1)}
        </Badge>
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
          {timestamp ? new Date(timestamp).toLocaleString() : 'N/A'}
        </div>
      );
    },
  },
  {
    accessorKey: 'receivedAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Received At" />
    ),
    cell: ({ row }) => {
      const timestamp = row.original.receivedAt;
      return (
        <div className="text-xs text-muted-foreground whitespace-nowrap">
          {timestamp ? new Date(timestamp).toLocaleString() : 'N/A'}
        </div>
      );
    },
  },
];
