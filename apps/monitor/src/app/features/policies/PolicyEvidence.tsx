import { Link } from 'react-router';
import type { Policy, PolicyEvaluation } from '../../lib/schemas';
import { Badge } from '../../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';

export function PolicyEvidence({
  policy,
  evaluation,
}: {
  policy: Policy;
  evaluation: PolicyEvaluation;
}) {
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div>
        <h2 className="font-semibold">Evidence for {policy.name}</h2>
        <p className="text-sm text-muted-foreground">
          {policy.sourceService} → {policy.destinationService} through{' '}
          {policy.destination}/subscriptions/{policy.subscription}. Messages
          become missing after {policy.thresholdSeconds}s without a receive
          report.
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Message</TableHead>
            <TableHead>Outcome</TableHead>
            <TableHead>Sent at</TableHead>
            <TableHead>Latency</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {evaluation.messages.length ? (
            evaluation.messages.map((message) => (
              <TableRow key={message.detailId}>
                <TableCell>
                  <Link
                    className="font-mono text-xs text-primary hover:underline"
                    to={`/messages/${encodeURIComponent(message.detailId)}`}
                  >
                    {message.messageId}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      message.outcome === 'passed'
                        ? 'default'
                        : message.outcome === 'pending'
                          ? 'outline'
                          : 'destructive'
                    }
                  >
                    {message.outcome}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(message.sentAt).toLocaleString()}
                </TableCell>
                <TableCell className="text-xs">
                  {message.latencySeconds === null
                    ? 'Not received'
                    : `${message.latencySeconds.toFixed(3)}s`}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={4}
                className="text-center text-muted-foreground"
              >
                No sent messages matched this policy in its evaluation window.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </section>
  );
}
