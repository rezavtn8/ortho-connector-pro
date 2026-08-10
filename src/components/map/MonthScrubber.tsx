import { useCallback, useEffect, useRef } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { formatYearMonth } from '@/lib/database.types';
import { cn } from '@/lib/utils';
import { WINDOW_SIZES, type TimeWindow, type WindowSize } from './timeWindow';

/** Milliseconds per month at 1x. */
const STEP_MS = 900;

export const SPEEDS = ['0.5', '1', '2'] as const;
export type Speed = (typeof SPEEDS)[number];

/**
 * How far back compare mode looks.
 *
 * Fixed offsets rather than a free choice of baseline month: these are the four
 * comparisons anyone actually asks for, they survive scrubbing (the baseline moves
 * with the cursor, so playback becomes a rolling "change against three months ago"),
 * and they need one control instead of a second slider handle.
 */
export const COMPARE_OFFSETS = [0, 1, 3, 6, 12] as const;
export type CompareOffset = (typeof COMPARE_OFFSETS)[number];

const COMPARE_LABELS: Record<CompareOffset, string> = {
  0: 'Single month',
  1: 'vs last month',
  3: 'vs 3 months ago',
  6: 'vs 6 months ago',
  12: 'vs last year',
};

const WINDOW_LABELS: Record<string, string> = {
  all: 'All history',
  '12': '12 months',
  '3': '3 months',
  '1': 'Single month',
};

interface MonthScrubberProps {
  months: string[];
  monthIndex: number;
  onMonthIndexChange: (index: number) => void;
  /** The resolved window, so the histogram can shade exactly what is on the map. */
  window: TimeWindow;
  windowSize: WindowSize;
  onWindowSizeChange: (size: WindowSize) => void;
  playing: boolean;
  onPlayingChange: (playing: boolean) => void;
  speed: Speed;
  onSpeedChange: (speed: Speed) => void;
  totalsByMonth: Record<string, number>;
  patientsThisMonth: number;
  compareOffset: CompareOffset;
  onCompareOffsetChange: (offset: CompareOffset) => void;
  /** The month being compared against, or null when not comparing. */
  compareMonth: string | null;
}

/**
 * Time control for the flow map: drag to a month, or play through the history.
 *
 * The mini-histogram beneath the slider shows referral volume per month, so busy
 * and quiet periods are visible before you drag rather than only in hindsight.
 */
export function MonthScrubber({
  months,
  monthIndex,
  onMonthIndexChange,
  window: activeWindow,
  windowSize,
  onWindowSizeChange,
  playing,
  onPlayingChange,
  speed,
  onSpeedChange,
  totalsByMonth,
  patientsThisMonth,
  compareOffset,
  onCompareOffsetChange,
  compareMonth,
}: MonthScrubberProps) {
  const lastIndex = Math.max(0, months.length - 1);
  const atEnd = monthIndex >= lastIndex;
  const monthLabel = months[monthIndex] ? formatYearMonth(months[monthIndex]) : '—';

  const maxTotal = Math.max(1, ...Object.values(totalsByMonth));

  // Playback timer. Reading the index from a ref keeps the interval from being
  // torn down and recreated on every tick.
  const indexRef = useRef(monthIndex);
  indexRef.current = monthIndex;

  useEffect(() => {
    if (!playing || months.length < 2) return;

    const id = window.setInterval(() => {
      const next = indexRef.current + 1;
      if (next > lastIndex) {
        onPlayingChange(false);
        return;
      }
      onMonthIndexChange(next);
    }, STEP_MS / Number(speed));

    return () => window.clearInterval(id);
  }, [playing, speed, lastIndex, months.length, onMonthIndexChange, onPlayingChange]);

  const togglePlay = useCallback(() => {
    if (months.length < 2) return;
    // Replaying from the end restarts rather than doing nothing.
    if (!playing && atEnd) onMonthIndexChange(0);
    onPlayingChange(!playing);
  }, [playing, atEnd, months.length, onMonthIndexChange, onPlayingChange]);

  const handleSlider = useCallback(
    (values: number[]) => {
      if (playing) onPlayingChange(false); // scrubbing takes over from playback
      onMonthIndexChange(values[0]);
    },
    [playing, onMonthIndexChange, onPlayingChange],
  );

  if (months.length === 0) return null;

  const PlayIcon = playing ? Pause : atEnd ? RotateCcw : Play;

  return (
    <div
      className="border-t bg-card/60 px-3 py-2.5 sm:px-4"
      onKeyDown={(e) => {
        if (e.key === ' ' || e.code === 'Space') {
          e.preventDefault();
          togglePlay();
        }
      }}
    >
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={togglePlay}
          disabled={months.length < 2}
          aria-label={playing ? 'Pause playback' : atEnd ? 'Replay from start' : 'Play through months'}
        >
          <PlayIcon className="h-4 w-4" />
        </Button>

        <div className="min-w-[7.5rem] shrink-0">
          <p className="text-sm font-semibold leading-tight">{monthLabel}</p>
          <p className="text-xs text-muted-foreground leading-tight">
            {compareMonth ? (
              <>vs {formatYearMonth(compareMonth)}</>
            ) : activeWindow.monthCount > 1 ? (
              <>
                {activeWindow.monthCount} mo · {patientsThisMonth} pt
              </>
            ) : (
              <>
                {patientsThisMonth} patient{patientsThisMonth === 1 ? '' : 's'}
              </>
            )}
          </p>
        </div>

        <div className="flex-1 min-w-0">
          {/* Volume histogram, aligned with the slider track beneath it. */}
          <div className="flex items-end gap-px h-6 mb-1" aria-hidden="true">
            {months.map((m, i) => {
              const total = totalsByMonth[m] ?? 0;
              // Shade the whole window, brightest at the cursor. Highlighting one
              // bar while the map aggregates twelve is how the histogram and the
              // map end up telling different stories.
              const inWindow = i >= activeWindow.startIndex && i <= activeWindow.endIndex;
              return (
                <div
                  key={m}
                  className={cn(
                    'flex-1 min-w-px rounded-sm transition-colors',
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
            onValueChange={handleSlider}
            aria-label="Month"
            className="cursor-pointer"
          />
        </div>

        <Select
          value={String(windowSize)}
          onValueChange={(v) => onWindowSizeChange(v === 'all' ? 'all' : (Number(v) as WindowSize))}
        >
          <SelectTrigger className="h-8 w-[7.5rem] shrink-0 text-xs" aria-label="Time window">
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
          value={String(compareOffset)}
          onValueChange={(v) => onCompareOffsetChange(Number(v) as CompareOffset)}
        >
          <SelectTrigger className="h-8 w-[8.5rem] shrink-0 text-xs" aria-label="Compare months">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COMPARE_OFFSETS.map((offset) => (
              <SelectItem
                key={offset}
                value={String(offset)}
                // A baseline must cover the *same* number of months, so this tracks
                // the window, not just the cursor. Comparing twelve months against a
                // truncated four would read as a collapse that never happened; and
                // offering a baseline the history cannot reach at all would silently
                // fall back, which reads as the control being broken.
                disabled={
                  offset > 0 &&
                  activeWindow.endIndex - offset - activeWindow.monthCount + 1 < 0
                }
                className="text-xs"
              >
                {COMPARE_LABELS[offset]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <ToggleGroup
          type="single"
          value={speed}
          onValueChange={(v) => v && onSpeedChange(v as Speed)}
          className="shrink-0 hidden sm:flex"
          aria-label="Playback speed"
        >
          {SPEEDS.map((s) => (
            <ToggleGroupItem key={s} value={s} className="h-8 px-2 text-xs" aria-label={`${s}x speed`}>
              {s}×
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </div>
  );
}
