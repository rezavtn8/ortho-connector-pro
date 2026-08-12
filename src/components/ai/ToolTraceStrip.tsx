/**
 * What the assistant looked at, above its answer.
 *
 * Two jobs. While the turn runs it is the progress indicator — "Opening an office
 * record" is a truthful account of a four-second wait, where a spinner labelled
 * "Thinking…" is not. Afterwards it is the audit trail: the user can see the answer
 * came from their own visit history rather than from the model's imagination, which
 * is the difference between a number they will act on and one they will re-check by
 * hand.
 *
 * Collapsed to one line once the answer arrives, because by then it is reassurance
 * rather than content.
 */

import { useState } from 'react';
import { Check, ChevronDown, Loader2, Search, AlertTriangle } from 'lucide-react';
import { toolLabel, type ToolTrace } from '@/lib/agentProtocol';
import { cn } from '@/lib/utils';

export function ToolTraceStrip({
  traces,
  running,
}: {
  traces: ToolTrace[];
  running: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (traces.length === 0) return null;

  const active = traces.find((t) => t.summary === null);
  const failed = traces.some((t) => !t.ok);
  const expanded = open || (running && Boolean(active));

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'group inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs transition-colors',
          'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
        )}
        aria-expanded={expanded}
      >
        {active ? (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" aria-hidden />
        ) : failed ? (
          <AlertTriangle className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-500" aria-hidden />
        ) : (
          <Search className="h-3 w-3 shrink-0" aria-hidden />
        )}
        <span className="font-medium">
          {active
            ? toolLabel(active.name)
            : `Checked ${traces.length} ${traces.length === 1 ? 'source' : 'sources'}`}
        </span>
        <ChevronDown
          className={cn('h-3 w-3 shrink-0 transition-transform', expanded && 'rotate-180')}
          aria-hidden
        />
      </button>

      {expanded && (
        <ul className="mt-1 space-y-1 border-l border-border/60 pl-3 text-xs text-muted-foreground">
          {traces.map((trace) => (
            <li key={trace.id} className="flex items-start gap-1.5">
              {trace.summary === null ? (
                <Loader2 className="mt-0.5 h-3 w-3 shrink-0 animate-spin text-primary" aria-hidden />
              ) : trace.ok ? (
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" aria-hidden />
              ) : (
                <AlertTriangle
                  className="mt-0.5 h-3 w-3 shrink-0 text-amber-600 dark:text-amber-500"
                  aria-hidden
                />
              )}
              <span>{trace.summary ?? toolLabel(trace.name)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
