import React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable, DataTableColumnHeader } from '../../components/data-table';
import { Badge } from '../../components/ui/badge';
import type { Policy, PolicyEvaluation } from '../../lib/schemas';

export type PolicyRow = Policy & { result?: PolicyEvaluation };

export function PolicyTable({
  policies,
  onEvaluate,
}: {
  policies: PolicyRow[];
  onEvaluate: (id: string) => void;
}) {
  const columns = React.useMemo<ColumnDef<PolicyRow>[]>(
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
          const result = row.original.result;
          if (!result) return <Badge variant="outline">Not evaluated</Badge>;
          const labels = {
            pass: 'Pass',
            fail: 'Fail',
            no_data: 'No data',
            insufficient_data: 'Insufficient data',
            disabled: 'Disabled',
          };
          return (
            <div className="space-y-1">
              <Badge
                variant={
                  result.status === 'pass'
                    ? 'default'
                    : result.status === 'fail'
                      ? 'destructive'
                      : 'outline'
                }
              >
                {labels[result.status]}
              </Badge>
              <p className="whitespace-nowrap text-xs text-muted-foreground">
                {result.counts.passed} passed · {result.counts.late} late ·{' '}
                {result.counts.missing} missing · {result.counts.pending}{' '}
                pending
              </p>
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <button
            className="rounded border px-3 py-1 text-xs"
            onClick={() => onEvaluate(row.original._id)}
          >
            Evaluate
          </button>
        ),
      },
    ],
    [onEvaluate],
  );
  return (
    <DataTable
      columns={columns}
      data={policies}
      searchKey="name"
      searchPlaceholder="Search policies..."
    />
  );
}
