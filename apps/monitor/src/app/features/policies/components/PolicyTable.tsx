import React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import {
  DataTable,
  DataTableColumnHeader,
} from '../../../components/data-table';
import { PolicyStatusBadge } from './PolicyStatusBadge';
import type { Policy } from '../../../lib/schemas';
import { Badge } from '../../../components/ui/badge';

export function PolicyTable({
  policies,
  onOpen,
  onEdit,
  onDeleteRow,
}: {
  policies: Policy[];
  onOpen: (id: string) => void;
  onEdit: (policy: Policy) => void;
  onDeleteRow?: (policy: Policy) => Promise<unknown>;
}) {
  const columns = React.useMemo<ColumnDef<Policy>[]>(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Policy" />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        accessorKey: 'provider',
        header: 'Provider',
        cell: ({ row }) => (
          <Badge variant="outline">{row.original.provider}</Badge>
        ),
      },
      {
        id: 'route',
        header: 'Route',
        cell: ({ row }) => (
          <div className="max-w-48 text-xs">
            <p className="truncate" title={row.original.sourceService}>
              {row.original.sourceService}
            </p>
            <p
              className="truncate text-muted-foreground"
              title={row.original.destinationService}
            >
              → {row.original.destinationService}
            </p>
          </div>
        ),
      },
      {
        accessorKey: 'destination',
        header: 'Destination',
        cell: ({ row }) => (
          <div className="max-w-56 text-xs">
            <p className="truncate" title={row.original.destination}>
              {row.original.destination}
            </p>
            <p
              className="truncate text-muted-foreground"
              title={row.original.subscription}
            >
              subscription/{row.original.subscription}
            </p>
          </div>
        ),
      },
      {
        accessorKey: 'thresholdSeconds',
        header: 'Expectation',
        cell: ({ row }) => (
          <span className="text-xs">
            {row.original.requiredSuccessPercentage}% within{' '}
            {row.original.thresholdSeconds}s
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const result = row.original.latestEvaluation;
          if (!result) return <PolicyStatusBadge />;
          return (
            <div className="space-y-1">
              <PolicyStatusBadge status={result.status} />
              <p className="whitespace-nowrap text-xs text-muted-foreground">
                {result.counts.passed} passed · {result.counts.late} late ·{' '}
                {result.counts.missing} missing · {result.counts.pending}{' '}
                pending
              </p>
            </div>
          );
        },
      },
    ],
    [],
  );
  return (
    <DataTable
      columns={columns}
      data={policies}
      searchKey="name"
      searchPlaceholder="Search policies..."
      onRowClick={(policy) => onOpen(policy._id)}
      onDeleteRow={onDeleteRow}
      onEditRow={onEdit}
    />
  );
}
