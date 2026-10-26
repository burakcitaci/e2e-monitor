import React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import {
  DataTable,
  DataTableColumnHeader,
} from '../../../components/data-table';
import { PolicyStatusBadge } from './PolicyStatusBadge';
import type { Policy } from '../../../lib/schemas';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';

export function PolicyTable({
  policies,
  onOpen,
  onEdit,
  onDelete,
}: {
  policies: Policy[];
  onOpen: (id: string) => void;
  onEdit: (policy: Policy) => void;
  onDelete: (policy: Policy) => void;
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
        cell: ({ row }) => <Badge variant="outline">{row.original.provider}</Badge>,
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
        id: 'actions',
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" aria-label={`Edit ${row.original.name}`} onClick={(event) => { event.stopPropagation(); onEdit(row.original); }}><Pencil className="size-4" /></Button>
            <Button variant="ghost" size="icon" aria-label={`Delete ${row.original.name}`} onClick={(event) => { event.stopPropagation(); onDelete(row.original); }}><Trash2 className="size-4 text-destructive" /></Button>
          </div>
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
    />
  );
}
