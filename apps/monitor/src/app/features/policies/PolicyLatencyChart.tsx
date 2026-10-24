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
import { useNavigate } from 'react-router';
import { useState } from 'react';
import { Button } from '../../components/ui/button';

type ChartMessage = PolicyEvaluation['messages'][number] & {
  timestamp: number;
  latency: number | null;
};

export function PolicyLatencyChart({
  evaluation,
  from,
  to,
}: {
  evaluation: PolicyEvaluation;
  from?: string;
  to?: string;
}) {
  const navigate = useNavigate();
  const [spacing, setSpacing] = useState<'message' | 'time'>('message');
  const data = evaluation.messages
    .map((message) => ({
      ...message,
      timestamp: Date.parse(message.sentAt),
      latency: message.latencySeconds,
    }))
    .sort(
      (left, right) =>
        left.timestamp - right.timestamp ||
        left.detailId.localeCompare(right.detailId),
    );
  const marker = ({
    cx,
    cy,
    payload,
  }: {
    cx?: number;
    cy?: number;
    payload?: ChartMessage;
  }) => {
    if (
      cx === undefined ||
      cy === undefined ||
      !payload ||
      payload.latency === null
    )
      return <g />;
    const description = `${payload.messageId} · Sent: ${payload.sentAt} · Received: ${payload.receivedAt} · ${payload.latency.toFixed(3)}s · ${payload.outcome}`;
    return (
      <a
        href={`/messages/${encodeURIComponent(payload.detailId)}`}
        aria-label={`Open message ${payload.messageId}`}
        onClick={(event) => {
          event.preventDefault();
          navigate(`/messages/${encodeURIComponent(payload.detailId)}`);
        }}
      >
        <circle
          cx={cx}
          cy={cy}
          r={spacing === 'time' ? 2.5 : 5}
          fill={payload.outcome === 'passed' ? 'var(--primary)' : '#ef4444'}
          stroke={spacing === 'time' ? 'var(--primary)' : 'var(--background)'}
          strokeWidth={spacing === 'time' ? 1 : 2}
          className="cursor-pointer"
        >
          <title>{description}</title>
        </circle>
      </a>
    );
  };
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {received} received / {data.length} matching messages
        </p>
        <div className="flex gap-1" role="group" aria-label="Chart spacing">
          <Button
            size="sm"
            variant={spacing === 'message' ? 'default' : 'outline'}
            aria-pressed={spacing === 'message'}
            onClick={() => setSpacing('message')}
          >
            Per message
          </Button>
          <Button
            size="sm"
            variant={spacing === 'time' ? 'default' : 'outline'}
            aria-pressed={spacing === 'time'}
            onClick={() => setSpacing('time')}
          >
            Time
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div
          className="h-80 w-full"
          style={
            spacing === 'message'
              ? { minWidth: Math.max(640, data.length * 24 + 160) }
              : undefined
          }
          role="region"
          aria-label="Message delivery latency line chart compared with policy threshold"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              key={spacing}
              data={data}
              margin={{ top: 24, right: 32, bottom: 20, left: 16 }}
            >
              <CartesianGrid
                vertical={false}
                strokeDasharray="3 3"
                className="stroke-border"
              />
              <XAxis
                dataKey={spacing === 'message' ? 'detailId' : 'timestamp'}
                type={spacing === 'message' ? 'category' : 'number'}
                domain={
                  spacing === 'time'
                    ? [
                        from ? Date.parse(from) : 'dataMin',
                        to ? Date.parse(to) : 'dataMax',
                      ]
                    : undefined
                }
                tickFormatter={(value) =>
                  tickTime(
                    spacing === 'message'
                      ? (data.find((message) => message.detailId === value)
                          ?.timestamp ?? 0)
                      : Number(value),
                  )
                }
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
                    Math.max(
                      maximum * 1.15,
                      evaluation.thresholdSeconds * 1.25,
                    ),
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
                  new Date(
                    spacing === 'message'
                      ? (data.find((message) => message.detailId === value)
                          ?.timestamp ?? 0)
                      : Number(value),
                  ).toLocaleString()
                }
                formatter={(value, _name, item) => [
                  `${Number(value).toFixed(3)}s · ${String(item.payload.outcome)}`,
                  String(item.payload.messageId),
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
                type="linear"
                stroke="var(--primary)"
                strokeWidth={2.5}
                dot={marker}
                activeDot={false}
                isAnimationActive={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        The line connects {received} received message
        {received === 1 ? '' : 's'} by sent time. Missing and pending messages
        have no latency value and remain in the evidence table. Click a marker
        to inspect its message.{' '}
        {spacing === 'message'
          ? 'Messages are evenly spaced in send order; scroll horizontally to inspect each one. Time gaps are not to scale.'
          : 'Positions follow actual sent timestamps, so bursts can overlap.'}{' '}
        Tooltips show original timestamps.
      </p>
    </div>
  );
}
