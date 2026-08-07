import { useCallback, useEffect, useRef } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { formatYearMonth } from '@/lib/database.types';
import { cn } from '@/lib/utils';

/** Milliseconds per month at 1x. */
const STEP_MS = 900;

export const SPEEDS = ['0.5', '1', '2'] as const;
export type Speed = (typeof SPEEDS)[number];

interface MonthScrubberProps {
  months: string[];
  monthIndex: number;
  onMonthIndexChange: (index: number) => void;
  playing: boolean;
  onPlayingChange: (playing: boolean) => void;
  speed: Speed;
  onSpeedChange: (speed: Speed) => void;
  totalsByMonth: Record<string, number>;
  patientsThisMonth: number;
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
  playing,
  onPlayingChange,
  speed,
  onSpeedChange,
  totalsByMonth,
  patientsThisMonth,
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
            {patientsThisMonth} patient{patientsThisMonth === 1 ? '' : 's'}
          </p>
        </div>

        <div className="flex-1 min-w-0">
          {/* Volume histogram, aligned with the slider track beneath it. */}
          <div className="flex items-end gap-px h-6 mb-1" aria-hidden="true">
            {months.map((m, i) => {
              const total = totalsByMonth[m] ?? 0;
              return (
                <div
                  key={m}
                  className={cn(
                    'flex-1 min-w-px rounded-sm transition-colors',
                    i === monthIndex ? 'bg-primary' : 'bg-muted-foreground/25',
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
