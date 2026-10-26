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
  onAdd,
  onOpen,
  onEdit,
  onDeleteRow,
}: {
  policies: Policy[];
  onAdd: () => void;
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
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Provider" />
        ),
        enableColumnFilter: true,
        filterFn: (row, _id, value: string[]) =>
          value.includes(row.original.provider),
        meta: {
          variant: 'multiSelect',
          label: 'Provider',
          options: [
            { label: 'Azure', value: 'azure' },
            { label: 'AWS', value: 'aws' },
          ],
        },
        cell: ({ row }) => (
          <Badge variant="outline">{row.original.provider}</Badge>
        ),
      },
      {
        accessorKey: 'enabled',
        header: 'State',
        enableColumnFilter: true,
        filterFn: (row, _id, value: string[]) =>
          value.includes(row.original.enabled ? 'enabled' : 'disabled'),
        meta: {
          variant: 'multiSelect',
          label: 'State',
          options: [
            { label: 'Enabled', value: 'enabled' },
            { label: 'Disabled', value: 'disabled' },
          ],
        },
        cell: ({ row }) => (
          <Badge variant={row.original.enabled ? 'active' : 'inactive'}>
            {row.original.enabled ? 'Enabled' : 'Disabled'}
          </Badge>
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
        accessorFn: (policy) => policy.latestEvaluation?.status ?? 'waiting',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        enableColumnFilter: true,
        filterFn: (row, id, value: string[]) =>
          value.includes(row.getValue(id)),
        meta: {
          variant: 'multiSelect',
          label: 'Status',
          options: [
            { label: 'Pass', value: 'pass' },
            { label: 'Fail', value: 'fail' },
            { label: 'No data', value: 'no_data' },
            { label: 'Insufficient data', value: 'insufficient_data' },
            { label: 'Disabled', value: 'disabled' },
            { label: 'Waiting for data', value: 'waiting' },
          ],
        },
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
      onAdd={onAdd}
      onRowClick={(policy) => onOpen(policy._id)}
      onDeleteRow={onDeleteRow}
      onEditRow={onEdit}
    />
  );
}
