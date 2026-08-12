/**
 * Review count over time — the practice against its closest rivals.
 *
 * Change-over-time on a single measure, so: one line per practice, one shared
 * y-axis, no second scale. Rating is deliberately *not* plotted here; a 0–5
 * rating and a 0–500 review count on one frame would need a dual axis, which
 * is the fastest way to make two unrelated slopes look like a relationship.
 * Rating lives in its own panel.
 *
 * Series are capped at five because the categorical palette has five fixed
 * slots and hues are never cycled — a sixth line would repeat a colour and
 * silently claim two practices are the same one. `--chart-1` is always this
 * practice, so adding or removing a competitor never repaints the others.
 */

import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { LineChart as LineChartIcon } from 'lucide-react';
import type { CompetitorRow } from '@/hooks/useCompetitorIntel';
import type { SeriesPoint } from '@/lib/competitorIntel';

/** Fixed slots. Index 0 is always us; competitors take 1..4 in rank order. */
const SERIES_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const MAX_RIVALS = SERIES_COLORS.length - 1;

interface Props {
  clinicName: string;
  mySeries: SeriesPoint[];
  competitors: CompetitorRow[];
}

interface Row {
  date: string;
  [key: string]: string | number | null;
}

export function ReviewRaceChart({ clinicName, mySeries, competitors }: Props) {
  const charted = useMemo(
    () => competitors.filter((c) => c.series.length > 0).slice(0, MAX_RIVALS),
    [competitors],
  );

  const series = useMemo(() => {
    const entries = [
      { key: 'me', label: clinicName || 'Your practice', points: mySeries },
      ...charted.map((c) => ({ key: c.id, label: c.name, points: c.series })),
    ].filter((s) => s.points.length > 0);
    return entries;
  }, [charted, clinicName, mySeries]);

  /**
   * One row per date across every series, with gaps left null.
   *
   * Snapshots only exist on days someone refreshed, and those days differ per
   * competitor. `connectNulls` then draws each line straight across its own
   * missing days rather than dropping to zero — a competitor with no snapshot
   * on Tuesday did not lose all their reviews on Tuesday.
   */
  const data = useMemo<Row[]>(() => {
    const dates = [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort();
    const lookup = new Map(
      series.map((s) => [s.key, new Map(s.points.map((p) => [p.date, p.reviews]))]),
    );
    return dates.map((date) => {
      const row: Row = { date };
      for (const s of series) row[s.key] = lookup.get(s.key)!.get(date) ?? null;
      return row;
    });
  }, [series]);

  const hidden = competitors.filter((c) => c.series.length > 0).length - charted.length;

  if (data.length < 2) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <LineChartIcon className="h-4 w-4" />
            Review race
          </CardTitle>
          <CardDescription>Total reviews over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-dashed border-border py-12 text-center">
            <p className="text-sm font-medium">Not enough history yet</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
              This chart needs snapshots from at least two different days. Refresh again tomorrow
              and the trend starts building.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <LineChartIcon className="h-4 w-4" />
          Review race
        </CardTitle>
        <CardDescription>
          Total Google reviews over time
          {hidden > 0 && ` · showing your ${MAX_RIVALS} highest-threat competitors of ${hidden + MAX_RIVALS}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Legend sits above the plot: identity is never carried by colour alone. */}
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {series.map((s, i) => (
            <span key={s.key} className="flex items-center gap-1.5 text-xs">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: SERIES_COLORS[i] }}
              />
              <span className={i === 0 ? 'font-semibold' : 'text-muted-foreground'}>{s.label}</span>
            </span>
          ))}
        </div>

        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={shortDate}
              minTickGap={24}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              width={48}
              allowDecimals={false}
            />
            <Tooltip
              content={<RaceTooltip series={series} />}
              cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
            />
            {series.map((s, i) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={SERIES_COLORS[i]}
                strokeWidth={i === 0 ? 2.5 : 2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: 'hsl(var(--background))' }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function shortDate(value: string): string {
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed)) return value;
  return new Date(parsed).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function RaceTooltip({
  active,
  label,
  payload,
  series,
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{ dataKey: string; value: number | null }>;
  series: Array<{ key: string; label: string }>;
}) {
  if (!active || !payload?.length) return null;

  const byKey = new Map(payload.map((p) => [p.dataKey, p.value]));

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-md">
      <p className="mb-1.5 text-xs font-medium text-popover-foreground">{shortDate(label ?? '')}</p>
      <div className="space-y-1">
        {series.map((s, i) => {
          const value = byKey.get(s.key);
          if (value == null) return null;
          return (
            <div key={s.key} className="flex items-center gap-2 text-xs">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: SERIES_COLORS[i] }}
              />
              <span className="flex-1 text-muted-foreground">{s.label}</span>
              <span className="font-medium tabular-nums text-popover-foreground">
                {value.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
