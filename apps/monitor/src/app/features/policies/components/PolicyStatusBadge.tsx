import { Badge } from '../../../components/ui/badge';
import type { PolicyEvaluation } from '../../../lib/schemas';

const labels = {
  pass: 'Pass',
  fail: 'Fail',
  no_data: 'No data',
  insufficient_data: 'Insufficient data',
  disabled: 'Disabled',
};

export function PolicyStatusBadge({
  status,
  detail = false,
}: {
  status?: PolicyEvaluation['status'];
  detail?: boolean;
}) {
  const label = status
    ? detail && status === 'pass'
      ? 'Passing'
      : detail && status === 'fail'
        ? 'Failing'
        : labels[status]
    : 'Waiting for data';
  return (
    <Badge
      variant={
        status === 'pass'
          ? 'default'
          : status === 'fail'
            ? 'destructive'
            : 'outline'
      }
    >
      {label}
    </Badge>
  );
}
