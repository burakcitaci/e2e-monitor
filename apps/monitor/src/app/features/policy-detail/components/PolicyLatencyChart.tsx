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
import { useId, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { latencyBuckets } from '../lib/latency-buckets';

export function PolicyLatencyChart({
  evaluation,
  from,
  to,
}: {
  evaluation: PolicyEvaluation;
  from?: string;
  to?: string;
}) {
  const gradientId = `latency-${useId().replace(/:/g, '')}`;
  const [spacing, setSpacing] = useState<'message' | 'time'>('message');
  const rangeFrom = Date.parse(from ?? '');
  const rangeTo = Date.parse(to ?? '');
  const aggregated =
    Number.isFinite(rangeFrom) &&
    Number.isFinite(rangeTo) &&
    (rangeTo - rangeFrom >= 86_400_000 || evaluation.messages.length > 120);
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
  const { minimum, maximum } = chartData.reduce(
    (range, point) =>
      point.latency === null
        ? range
        : {
            minimum: Math.min(range.minimum, point.latency),
            maximum: Math.max(range.maximum, point.latency),
          },
    { minimum: Infinity, maximum: -Infinity },
  );
  const thresholdOffset =
    maximum > minimum
      ? Math.max(
          0,
          Math.min(
            1,
            (maximum - evaluation.thresholdSeconds) / (maximum - minimum),
          ),
        )
      : 0;
  const lineColor =
    minimum > evaluation.thresholdSeconds
      ? 'var(--destructive)'
      : maximum <= evaluation.thresholdSeconds
        ? 'var(--color-blue-300)'
        : `url(#${gradientId})`;
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
      className="min-w-0 overflow-hidden rounded-sm border bg-card text-card-foreground"
    >
      <div className="flex flex-col border-b lg:flex-row">
        <div className="flex-1 space-y-1 px-6 py-5">
          <h2 id="delivery-latency-title" className="text-base font-semibold">
            Delivery latency
          </h2>
          <p className="text-sm text-muted-foreground">
            {buckets
              ? `p95 delivery latency per ${buckets.label}.`
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
      <div className="min-w-0 px-2 pt-5 sm:px-4">
        <div
          className="h-60 w-full overflow-hidden sm:h-64"
          role="region"
          aria-label="Message delivery latency line chart compared with policy threshold"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              key={plotSpacing}
              data={chartData}
              margin={{ top: 20, right: 24, bottom: 8, left: 0 }}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset={thresholdOffset}
                    stopColor="var(--destructive)"
                  />
                  <stop
                    offset={thresholdOffset}
                    stopColor="var(--color-blue-300)"
                  />
                </linearGradient>
              </defs>
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
                isAnimationActive={false}
                allowEscapeViewBox={{ x: false, y: false }}
                wrapperStyle={{
                  pointerEvents: 'none',
                  maxWidth: 'min(18rem, calc(100vw - 3rem))',
                }}
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
                  whiteSpace: 'normal',
                  overflowWrap: 'anywhere',
                }}
                itemStyle={{ whiteSpace: 'normal' }}
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
                stroke={lineColor}
                strokeWidth={2}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <p className="border-t px-6 py-4 text-xs leading-relaxed text-muted-foreground">
        {aggregated ? (
          'Each point shows the p95 latency of received messages sent in that time bucket. The line connects populated buckets across empty intervals; empty buckets are not zero latency. Missing and pending messages have no latency; all individual messages remain in the evidence table. Hover for received/total counts and maximum latency.'
        ) : (
          <>
            The line connects {received} received message
            {received === 1 ? '' : 's'} by sent time. Missing and pending
            messages have no latency value and remain in the evidence table.
            Open a message from the evidence table to inspect it.{' '}
            {spacing === 'message'
              ? 'Messages are evenly spaced in send order. Time gaps are not to scale. Dense ranges automatically use p95 time buckets.'
              : 'Positions follow actual sent timestamps, so bursts can overlap.'}{' '}
            Tooltips show original timestamps.
          </>
        )}
      </p>
    </section>
  );
}
