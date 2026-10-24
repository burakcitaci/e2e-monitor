import { Link, useNavigate } from 'react-router';
import type { ColumnDef } from '@tanstack/react-table';
import type { Policy, PolicyEvaluation } from '../../../lib/schemas';
import { Badge } from '../../../components/ui/badge';
import {
  DataTable,
  DataTableColumnHeader,
} from '../../../components/data-table';
import { PageSection } from '../../../components/common/Page';

type EvidenceMessage = PolicyEvaluation['messages'][number];
const detailPath = (message: EvidenceMessage) =>
  `/messages/${encodeURIComponent(message.detailId)}`;

const columns: ColumnDef<EvidenceMessage>[] = [
  {
    accessorKey: 'messageId',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Message" />
    ),
    cell: ({ row }) => (
      <Link
        className="block max-w-64 truncate font-mono text-xs font-medium text-primary hover:underline"
        to={detailPath(row.original)}
        title={row.original.messageId}
      >
        {row.original.messageId}
      </Link>
    ),
  },
  {
    accessorKey: 'outcome',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Outcome" />
    ),
    cell: ({ row }) => (
      <Badge
        variant={
          row.original.outcome === 'passed'
            ? 'default'
            : row.original.outcome === 'pending'
              ? 'outline'
              : 'destructive'
        }
      >
        {row.original.outcome}
      </Badge>
    ),
  },
  {
    accessorKey: 'sentAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Sent At" />
    ),
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-muted-foreground">
        {new Date(row.original.sentAt).toLocaleString()}
      </span>
    ),
  },
  {
    accessorKey: 'receivedAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Received At" />
    ),
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-muted-foreground">
        {row.original.receivedAt
          ? new Date(row.original.receivedAt).toLocaleString()
          : 'Not received'}
      </span>
    ),
  },
  {
    accessorKey: 'latencySeconds',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Latency" />
    ),
    cell: ({ row }) =>
      row.original.latencySeconds === null
        ? '—'
        : `${row.original.latencySeconds.toFixed(3)}s`,
  },
];

export function PolicyEvidence({
  policy,
  evaluation,
}: {
  policy: Policy;
  evaluation: PolicyEvaluation;
}) {
  const navigate = useNavigate();
  return (
    <PageSection
      title={`Evidence for ${policy.name}`}
      description={
        <>
          {policy.sourceService} → {policy.destinationService} through{' '}
          {policy.destination}/subscriptions/{policy.subscription}. Messages
          become missing after {policy.thresholdSeconds}s without a receive
          report.
        </>
      }
    >
      <DataTable
        columns={columns}
        data={evaluation.messages}
        searchKey="messageId"
        searchPlaceholder="Search messages..."
        onRowClick={(message) => navigate(detailPath(message))}
      />
    </PageSection>
  );
}
