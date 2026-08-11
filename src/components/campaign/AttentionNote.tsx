import React from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, CircleSlash, type LucideIcon } from 'lucide-react';
import type { Attention, AttentionLevel } from '@/lib/campaigns';

export const ATTENTION_STYLE: Record<
  AttentionLevel,
  { icon: LucideIcon; tone: string; dot: string; label: string }
> = {
  overdue: {
    icon: CalendarClock,
    tone: 'bg-destructive/10 text-destructive',
    dot: 'bg-destructive',
    label: 'Overdue',
  },
  empty: {
    icon: CircleSlash,
    tone: 'bg-muted text-muted-foreground',
    dot: 'bg-muted-foreground',
    label: 'Empty',
  },
  stalled: {
    icon: AlertTriangle,
    tone: 'bg-warning/15 text-warning-foreground dark:text-warning',
    dot: 'bg-warning',
    label: 'Not started',
  },
  closeable: {
    icon: CheckCircle2,
    tone: 'bg-success/10 text-success',
    dot: 'bg-success',
    label: 'Ready to close',
  },
};

/** Inline explanation of why a campaign is in the attention queue. */
export function AttentionNote({ attention }: { attention: Attention }) {
  const style = ATTENTION_STYLE[attention.level];
  return (
    <div className={`flex items-start gap-2.5 rounded-lg p-2.5 text-sm ${style.tone}`}>
      <style.icon className="w-4 h-4 shrink-0 mt-0.5" />
      <span>
        <span className="font-medium">{attention.headline}.</span>{' '}
        <span className="opacity-90">{attention.detail}</span>
      </span>
    </div>
  );
}
