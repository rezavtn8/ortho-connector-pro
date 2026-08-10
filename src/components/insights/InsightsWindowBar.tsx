import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { formatYearMonth } from '@/lib/database.types';
import { cn } from '@/lib/utils';
import { COMPARE_OFFSETS, type CompareOffset } from '@/components/map/MonthScrubber';
import { WINDOW_SIZES, type TimeWindow, type WindowSize } from '@/components/map/timeWindow';

/**
 * The shared time control for all three Insights diagrams.
 *
 * Deliberately *not* the map's `MonthScrubber`. That component carries playback — an
 * interval timer, a speed toggle, a play/pause/replay button — which exists because
 * watching the network grow month by month is the point of the map. None of that
 * applies here: these diagrams answer "what does the book look like over this period",
 * and animating them would just make three charts flicker. Reusing it would mean either
 * shipping dead controls or adding four "hide this" props to a component the map
 * depends on.
 *
 * The *logic* is shared, which is the part that matters: `resolveWindow`,
 * `baselineWindow`, `WINDOW_SIZES` and `COMPARE_OFFSETS` all come from the map's
 * modules, so a window means the same thing on both screens.
 */

const WINDOW_LABELS: Record<string, string> = {
  all: 'All history',
  '12': '12 months',
  '3': '3 months',
  '1': 'Single month',
};

const COMPARE_LABELS: Record<CompareOffset, string> = {
  0: 'No baseline',
  1: 'vs last month',
  3: 'vs 3 months ago',
  6: 'vs 6 months ago',
  12: 'vs last year',
};

interface InsightsWindowBarProps {
  months: string[];
  monthIndex: number;
  onMonthIndexChange: (index: number) => void;
  window: TimeWindow;
  windowSize: WindowSize;
  onWindowSizeChange: (size: WindowSize) => void;
  baselineOffset: CompareOffset;
  onBaselineOffsetChange: (offset: CompareOffset) => void;
  totalsByMonth: Record<string, number>;
  /** Patients across the resolved window. */
  patientsInWindow: number;
}

export function InsightsWindowBar({
  months,
  monthIndex,
  onMonthIndexChange,
  window: activeWindow,
  windowSize,
  onWindowSizeChange,
  baselineOffset,
  onBaselineOffsetChange,
  totalsByMonth,
  patientsInWindow,
}: InsightsWindowBarProps) {
  if (months.length === 0) return null;

  const lastIndex = Math.max(0, months.length - 1);
  const maxTotal = Math.max(1, ...Object.values(totalsByMonth));
  const monthLabel = months[monthIndex] ? formatYearMonth(months[monthIndex]) : '—';

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card/60 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3 sm:px-4">
      <div className="min-w-[8.5rem] shrink-0">
        <p className="text-sm font-semibold leading-tight">{monthLabel}</p>
        <p className="text-xs leading-tight text-muted-foreground">
          {activeWindow.monthCount > 1
            ? `${activeWindow.monthCount} mo · ${patientsInWindow} patients`
            : `${patientsInWindow} patient${patientsInWindow === 1 ? '' : 's'}`}
        </p>
      </div>

      <div className="min-w-0 flex-1">
        {/* Volume histogram, aligned with the slider beneath it. Shades the whole
            window rather than one bar, so it cannot claim a different period than
            the charts are drawing. */}
        <div className="mb-1 flex h-6 items-end gap-px" aria-hidden="true">
          {months.map((m, i) => {
            const total = totalsByMonth[m] ?? 0;
            const inWindow = i >= activeWindow.startIndex && i <= activeWindow.endIndex;
            return (
              <div
                key={m}
                className={cn(
                  'min-w-px flex-1 rounded-sm transition-colors',
                  i === monthIndex
                    ? 'bg-primary'
                    : inWindow
                      ? 'bg-primary/45'
                      : 'bg-muted-foreground/25',
                )}
                style={{ height: `${Math.max(6, (total / maxTotal) * 100)}%` }}
              />
            );
          })}
        </div>

        <Slider
          value={[monthIndex]}
          min={0}
          max={lastIndex}
          step={1}
          onValueChange={(v) => onMonthIndexChange(v[0])}
          aria-label="Period ending month"
          className="cursor-pointer"
        />
      </div>

      <div className="flex shrink-0 gap-2">
        <Select
          value={String(windowSize)}
          onValueChange={(v) => onWindowSizeChange(v === 'all' ? 'all' : (Number(v) as WindowSize))}
        >
          <SelectTrigger className="h-8 w-[7.5rem] text-xs" aria-label="Time window">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WINDOW_SIZES.map((size) => (
              <SelectItem key={String(size)} value={String(size)} className="text-xs">
                {WINDOW_LABELS[String(size)]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={String(baselineOffset)}
          onValueChange={(v) => onBaselineOffsetChange(Number(v) as CompareOffset)}
        >
          <SelectTrigger className="h-8 w-[8.5rem] text-xs" aria-label="Baseline period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COMPARE_OFFSETS.map((offset) => (
              <SelectItem
                key={offset}
                value={String(offset)}
                // A baseline must cover the same number of months, so this tracks the
                // window, not just the cursor. An option the history cannot reach would
                // silently fall back, which reads as the control being broken.
                disabled={
                  offset > 0 && activeWindow.endIndex - offset - activeWindow.monthCount + 1 < 0
                }
                className="text-xs"
              >
                {COMPARE_LABELS[offset]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
