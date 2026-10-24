import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PolicyEvaluation } from '../../lib/schemas';

export function PolicyLatencyChart({
  evaluation,
  from,
  to,
}: {
  evaluation: PolicyEvaluation;
  from?: string;
  to?: string;
}) {
  const data = evaluation.messages
    .map((message) => ({
      sentAt: Date.parse(message.sentAt),
      latency: message.latencySeconds,
      outcome: message.outcome,
    }))
    .sort((left, right) => left.sentAt - right.sentAt);
  if (!data.length) {
    return (
      <div className="flex h-72 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        No matching messages in the evaluation window.
      </div>
    );
  }
  const received = data.filter((message) => message.latency !== null).length;
  const tickTime = (value: number) =>
    new Date(value).toLocaleString([], {
      ...(from && to && Date.parse(to) - Date.parse(from) >= 86_400_000
        ? { month: 'short' as const, day: 'numeric' as const }
        : {}),
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className="space-y-3">
      <div
        className="h-80 w-full"
        role="img"
        aria-label="Message delivery latency line chart compared with policy threshold"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 24, right: 32, bottom: 20, left: 16 }}
          >
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 3"
              className="stroke-border"
            />
            <XAxis
              dataKey="sentAt"
              type="number"
              domain={[
                from ? Date.parse(from) : 'dataMin',
                to ? Date.parse(to) : 'dataMax',
              ]}
              tickFormatter={tickTime}
              tickLine={false}
              axisLine={false}
              minTickGap={32}
              padding={{ left: 24, right: 24 }}
              tickMargin={12}
              height={48}
              className="text-xs"
            />
            <YAxis
              domain={[
                0,
                (maximum: number) =>
                  Math.max(maximum * 1.15, evaluation.thresholdSeconds * 1.25),
              ]}
              tickFormatter={(value: number) => `${value.toFixed(2)}s`}
              tickLine={false}
              axisLine={false}
              width={72}
              tickMargin={12}
              className="text-xs"
            />
            <Tooltip
              cursor={{ stroke: 'var(--border)', strokeDasharray: '3 3' }}
              labelFormatter={(value) =>
                new Date(Number(value)).toLocaleString()
              }
              formatter={(value, _name, item) => [
                `${Number(value).toFixed(3)}s · ${String(item.payload.outcome)}`,
                'Delivery latency',
              ]}
              contentStyle={{
                background: 'var(--popover)',
                border: '1px solid var(--border)',
                borderRadius: '0.5rem',
                color: 'var(--popover-foreground)',
              }}
            />
            <ReferenceLine
              y={evaluation.thresholdSeconds}
              stroke="#f59e0b"
              strokeDasharray="7 5"
              strokeWidth={2}
              label={{
                value: `Threshold ${evaluation.thresholdSeconds}s`,
                position: 'insideTopRight',
                fill: '#d97706',
                fontSize: 12,
              }}
            />
            <Line
              dataKey="latency"
              name="Delivery latency"
              type="monotone"
              stroke="var(--primary)"
              strokeWidth={2.5}
              dot={{ r: 3, strokeWidth: 2 }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted-foreground">
        The line connects {received} received message
        {received === 1 ? '' : 's'} by sent time. Missing and pending messages
        have no latency value and remain in the evidence table.
      </p>
    </div>
  );
}
