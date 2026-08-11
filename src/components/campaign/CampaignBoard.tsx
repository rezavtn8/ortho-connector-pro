import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CampaignCard, type CampaignCardHandlers } from './CampaignCard';
import { CAMPAIGN_STATUSES, type CampaignStatus } from '@/lib/campaigns';
import type { Campaign } from '@/hooks/useCampaigns';

const COLUMN_HINT: Record<CampaignStatus, string> = {
  Draft: 'Built but not started',
  Active: 'Out in the field',
  Completed: 'Closed out',
};

const COLUMN_RAIL: Record<CampaignStatus, string> = {
  Draft: 'bg-muted-foreground/40',
  Active: 'bg-primary',
  Completed: 'bg-success',
};

interface CampaignBoardProps extends CampaignCardHandlers {
  campaigns: Campaign[];
}

/** Status board — the fastest way to see what is stuck between built and sent. */
export function CampaignBoard({ campaigns, ...handlers }: CampaignBoardProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {CAMPAIGN_STATUSES.map((status) => {
        const column = campaigns.filter((c) => c.statusLabel === status);
        const offices = column.reduce((sum, c) => sum + c.stats.total, 0);

        return (
          <div key={status} className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-1 h-4 rounded-full ${COLUMN_RAIL[status]}`} aria-hidden />
                <div className="min-w-0">
                  <p className="font-medium text-sm leading-none">{status}</p>
                  <p className="text-xs text-muted-foreground mt-1">{COLUMN_HINT[status]}</p>
                </div>
              </div>
              <Badge variant="outline" className="shrink-0 tabular-nums">
                {column.length}
              </Badge>
            </div>

            <div className="space-y-2 rounded-lg bg-muted/30 p-2 min-h-[120px]">
              {column.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} compact {...handlers} />
              ))}
              {column.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">Nothing here</p>
              )}
            </div>

            {offices > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                {offices} office{offices === 1 ? '' : 's'} across {column.length} campaign
                {column.length === 1 ? '' : 's'}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
