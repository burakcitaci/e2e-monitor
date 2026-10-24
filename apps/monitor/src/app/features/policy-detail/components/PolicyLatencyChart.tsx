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
import type { PolicyEvaluation } from '../../../lib/schemas';
import { useNavigate } from 'react-router';
import { useState } from 'react';
import { Button } from '../../../components/ui/button';
import { latencyBuckets } from '../lib/latency-buckets';

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
  const rangeFrom = Date.parse(from ?? '');
  const rangeTo = Date.parse(to ?? '');
  const aggregated = rangeTo - rangeFrom >= 86_400_000;
  const buckets = aggregated
    ? latencyBuckets(evaluation.messages, rangeFrom, rangeTo)
    : null;
  const plotSpacing = aggregated ? 'time' : spacing;
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
  const chartData: { timestamp: number; latency: number | null }[] =
    buckets?.points ?? data;
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
    if (aggregated)
      return <circle cx={cx} cy={cy} r={2} fill="var(--color-blue-300)" />;
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
          r={spacing === 'time' ? 2 : 3}
          fill={
            payload.outcome === 'passed'
              ? 'var(--color-blue-300)'
              : 'var(--destructive)'
          }
          stroke="var(--background)"
          strokeWidth={1.5}
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
    <section
      aria-labelledby="delivery-latency-title"
      className="min-w-0 overflow-hidden rounded-2xl border bg-card text-card-foreground"
    >
      <div className="flex flex-col border-b lg:flex-row">
        <div className="flex-1 space-y-1 px-6 py-5">
          <h2 id="delivery-latency-title" className="text-base font-semibold">
            Delivery latency
          </h2>
          <p className="text-sm text-muted-foreground">
            {buckets
              ? `p95 delivery latency per ${buckets.minutes < 60 ? `${buckets.minutes} minutes` : `${buckets.minutes / 60} hour${buckets.minutes > 60 ? 's' : ''}`}.`
              : 'Message delivery times for the selected range.'}
          </p>
        </div>
        <dl className="grid grid-cols-2 border-t lg:border-t-0 lg:border-l">
          <div className="min-w-32 bg-muted/30 px-6 py-4">
            <dt className="text-xs text-muted-foreground">Received messages</dt>
            <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
              {received.toLocaleString()}{' '}
              <span className="text-sm font-normal text-muted-foreground">
                / {data.length.toLocaleString()}
              </span>
            </dd>
          </div>
          <div className="min-w-32 border-l px-6 py-4">
            <dt className="text-xs text-muted-foreground">Policy threshold</dt>
            <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
              {evaluation.thresholdSeconds}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                s
              </span>
            </dd>
          </div>
        </dl>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span className="h-0.5 w-4 bg-blue-300" />
            {aggregated ? 'p95 latency' : 'Latency'}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="w-4 border-t-2 border-dashed border-amber-500" />
            Threshold
          </span>
        </div>
        {!aggregated && (
          <div
            className="flex gap-1 rounded-lg bg-muted/50 p-1"
            role="group"
            aria-label="Chart spacing"
          >
            <Button
              size="sm"
              variant={spacing === 'message' ? 'default' : 'ghost'}
              className="cursor-pointer"
              aria-pressed={spacing === 'message'}
              onClick={() => setSpacing('message')}
            >
              Per message
            </Button>
            <Button
              size="sm"
              variant={spacing === 'time' ? 'default' : 'ghost'}
              className="cursor-pointer"
              aria-pressed={spacing === 'time'}
              onClick={() => setSpacing('time')}
            >
              Time
            </Button>
          </div>
        )}
      </div>
      <div className="overflow-x-auto px-2 pt-5 sm:px-4">
        <div
          className="h-60 w-full sm:h-64"
          style={
            plotSpacing === 'message'
              ? { minWidth: Math.max(640, data.length * 24 + 160) }
              : undefined
          }
          role="region"
          aria-label="Message delivery latency line chart compared with policy threshold"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              key={plotSpacing}
              data={chartData}
              margin={{ top: 20, right: 24, bottom: 8, left: 0 }}
            >
              <CartesianGrid
                vertical={false}
                className="stroke-border"
                strokeOpacity={0.45}
              />
              <XAxis
                dataKey={plotSpacing === 'message' ? 'detailId' : 'timestamp'}
                type={plotSpacing === 'message' ? 'category' : 'number'}
                domain={
                  plotSpacing === 'time'
                    ? [
                        from ? Date.parse(from) : 'dataMin',
                        to ? Date.parse(to) : 'dataMax',
                      ]
                    : undefined
                }
                tickFormatter={(value) =>
                  tickTime(
                    plotSpacing === 'message'
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
                tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
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
                tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
              />
              <Tooltip
                cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
                labelFormatter={(value) =>
                  new Date(
                    plotSpacing === 'message'
                      ? (data.find((message) => message.detailId === value)
                          ?.timestamp ?? 0)
                      : Number(value),
                  ).toLocaleString()
                }
                formatter={(value, _name, item) => [
                  aggregated
                    ? `${Number(value).toFixed(3)}s · ${item.payload.received}/${item.payload.total} received · max ${Number(item.payload.maximum).toFixed(3)}s`
                    : `${Number(value).toFixed(3)}s`,
                  aggregated
                    ? 'Bucket p95'
                    : `Delivery latency · ${String(item.payload.outcome)}`,
                ]}
                contentStyle={{
                  background: 'var(--popover)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.75rem',
                  color: 'var(--popover-foreground)',
                  boxShadow: '0 8px 24px rgb(0 0 0 / 0.10)',
                  padding: '10px 14px',
                  fontSize: 12,
                }}
                labelStyle={{ fontWeight: 500, marginBottom: 4 }}
              />
              <ReferenceLine
                y={evaluation.thresholdSeconds}
                stroke="#f59e0b"
                strokeDasharray="7 5"
                strokeWidth={1.5}
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
                type="monotoneX"
                stroke="var(--color-blue-300)"
                strokeWidth={2}
                dot={marker}
                activeDot={{
                  r: 5,
                  fill: 'var(--color-blue-300)',
                  stroke: 'var(--background)',
                  strokeWidth: 2,
                  pointerEvents: 'none',
                }}
                isAnimationActive={false}
                connectNulls={!aggregated}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <p className="border-t px-6 py-4 text-xs leading-relaxed text-muted-foreground">
        {aggregated ? (
          'Each point shows the p95 latency of received messages sent in that time bucket. Empty buckets remain gaps. Missing and pending messages have no latency; all individual messages remain in the evidence table. Hover for received/total counts and maximum latency.'
        ) : (
          <>
            The line connects {received} received message
            {received === 1 ? '' : 's'} by sent time. Missing and pending
            messages have no latency value and remain in the evidence table.
            Click a marker to inspect its message.{' '}
            {spacing === 'message'
              ? 'Messages are evenly spaced in send order; scroll horizontally to inspect each one. Time gaps are not to scale.'
              : 'Positions follow actual sent timestamps, so bursts can overlap.'}{' '}
            Tooltips show original timestamps.
          </>
        )}
      </p>
    </section>
  );
}
