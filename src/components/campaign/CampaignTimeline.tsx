import React, { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { format, isSameMonth, startOfDay } from 'date-fns';
import { METHOD_META } from '@/lib/campaigns';
import { now } from '@/lib/dateSync';
import { ATTENTION_STYLE } from './AttentionNote';
import type { Campaign } from '@/hooks/useCampaigns';

interface CampaignTimelineProps {
  campaigns: Campaign[];
  onOpen: (campaign: Campaign) => void;
  onExecute: (campaign: Campaign) => void;
}

interface Group {
  key: string;
  label: string;
  hint?: string;
  campaigns: Campaign[];
}

/**
 * The outreach calendar: what is late, what lands this month, what is coming, and
 * what was never given a date at all — the bucket that quietly grows the most.
 */
export function CampaignTimeline({ campaigns, onOpen, onExecute }: CampaignTimelineProps) {
  const groups = useMemo<Group[]>(() => {
    const today = startOfDay(now());
    const overdue: Campaign[] = [];
    const unscheduled: Campaign[] = [];
    const byMonth = new Map<string, Campaign[]>();

    for (const campaign of campaigns) {
      if (!campaign.planned_delivery_date) {
        unscheduled.push(campaign);
        continue;
      }
      const date = startOfDay(new Date(`${campaign.planned_delivery_date}T00:00:00`));
      if (date < today && campaign.statusLabel !== 'Completed' && campaign.progress.pct < 100) {
        overdue.push(campaign);
        continue;
      }
      const key = format(date, 'yyyy-MM');
      const bucket = byMonth.get(key);
      if (bucket) bucket.push(campaign);
      else byMonth.set(key, [campaign]);
    }

    const byDate = (a: Campaign, b: Campaign) =>
      (a.planned_delivery_date ?? '').localeCompare(b.planned_delivery_date ?? '');

    const months = [...byMonth.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, list]) => {
        const date = new Date(`${key}-01T00:00:00`);
        return {
          key,
          label: format(date, 'MMMM yyyy'),
          hint: isSameMonth(date, today) ? 'This month' : undefined,
          campaigns: list.sort(byDate),
        };
      });

    return [
      ...(overdue.length
        ? [{ key: 'overdue', label: 'Past due', hint: 'Send date has passed', campaigns: overdue.sort(byDate) }]
        : []),
      ...months,
      ...(unscheduled.length
        ? [{ key: 'unscheduled', label: 'No date set', hint: 'Give these a send date', campaigns: unscheduled }]
        : []),
    ];
  }, [campaigns]);

  if (groups.length === 0) return null;

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.key} className="space-y-2">
          <div className="flex items-baseline gap-2">
            <h3 className="font-semibold text-sm">{group.label}</h3>
            {group.hint && (
              <span
                className={`text-xs ${group.key === 'overdue' ? 'text-destructive' : 'text-muted-foreground'}`}
              >
                {group.hint}
              </span>
            )}
            <span className="text-xs text-muted-foreground ml-auto tabular-nums">
              {group.campaigns.length}
            </span>
          </div>

          <div className="border rounded-lg divide-y overflow-hidden">
            {group.campaigns.map((campaign) => {
              const meta = METHOD_META[campaign.method];
              const attentionStyle = campaign.attention
                ? ATTENTION_STYLE[campaign.attention.level]
                : null;

              return (
                <div
                  key={campaign.id}
                  onClick={() => onOpen(campaign)}
                  className="flex items-center gap-3 p-3 hover:bg-muted/40 transition-colors cursor-pointer"
                >
                  <div className="w-12 shrink-0 text-center">
                    {campaign.planned_delivery_date ? (
                      <>
                        <p className="text-xs text-muted-foreground leading-none">
                          {format(new Date(`${campaign.planned_delivery_date}T00:00:00`), 'MMM')}
                        </p>
                        <p className="text-lg font-semibold leading-tight tabular-nums">
                          {format(new Date(`${campaign.planned_delivery_date}T00:00:00`), 'd')}
                        </p>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>

                  <div className={`p-1.5 rounded-md shrink-0 ${meta.chip}`}>
                    <meta.icon className="w-3.5 h-3.5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{campaign.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="h-1 w-24 rounded-full bg-muted overflow-hidden shrink-0">
                        <div
                          className={`h-full rounded-full ${meta.accent}`}
                          style={{ width: `${campaign.progress.pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground truncate">
                        {campaign.progress.label}
                      </span>
                    </div>
                  </div>

                  {attentionStyle && (
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${attentionStyle.dot}`}
                      title={campaign.attention!.headline}
                    />
                  )}

                  <Badge variant="outline" className="text-xs shrink-0 hidden sm:inline-flex">
                    {campaign.statusLabel}
                  </Badge>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 h-8 gap-1 text-xs hidden md:inline-flex"
                    onClick={(e) => {
                      e.stopPropagation();
                      onExecute(campaign);
                    }}
                  >
                    Open <ArrowRight className="w-3 h-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
