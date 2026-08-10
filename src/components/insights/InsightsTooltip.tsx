import { cn } from '@/lib/utils';

export interface TooltipRow {
  label: string;
  value: string;
  /** A CSS color for the swatch. Omit for a plain row. */
  swatch?: string;
}

export interface TooltipState {
  title: string;
  subtitle?: string;
  rows: TooltipRow[];
  /** Client coordinates within the chart wrapper. */
  x: number;
  y: number;
}

/**
 * One tooltip, shared by all three diagrams.
 *
 * Rendered as a sibling of the `<svg>` rather than as SVG content: text inside an SVG
 * cannot wrap, cannot use the app's type scale, and cannot escape the viewBox, so a
 * tooltip near the right edge would be clipped by the chart it belongs to.
 *
 * The wrapper must be `relative`. Positioning flips to the other side of the cursor
 * near an edge, so the tooltip stays inside the card instead of forcing the page to
 * scroll sideways.
 */
export function InsightsTooltip({
  state,
  width,
  height,
}: {
  state: TooltipState | null;
  /** Wrapper size in px, used only to decide which side to flip to. */
  width: number;
  height: number;
}) {
  if (!state) return null;

  const flipX = width > 0 && state.x > width * 0.6;
  const flipY = height > 0 && state.y > height * 0.7;

  return (
    <div
      role="tooltip"
      className={cn(
        'pointer-events-none absolute z-20 max-w-[15rem] rounded-md border bg-popover',
        'px-2.5 py-2 text-popover-foreground shadow-elegant',
      )}
      style={{
        left: state.x,
        top: state.y,
        transform: `translate(${flipX ? 'calc(-100% - 12px)' : '12px'}, ${
          flipY ? 'calc(-100% - 12px)' : '12px'
        })`,
      }}
    >
      <p className="text-xs font-semibold leading-tight">{state.title}</p>
      {state.subtitle && (
        <p className="mt-0.5 text-[0.7rem] leading-tight text-muted-foreground">{state.subtitle}</p>
      )}
      {state.rows.length > 0 && (
        <dl className="mt-1.5 space-y-0.5">
          {state.rows.map((row) => (
            <div key={row.label} className="flex items-center gap-1.5 text-[0.7rem] leading-tight">
              {row.swatch && (
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{ background: row.swatch }}
                />
              )}
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="ml-auto font-medium tabular-nums">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
