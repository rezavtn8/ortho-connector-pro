import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { METHOD_META, type CampaignStatus } from '@/lib/campaigns';
import { ATTENTION_STYLE } from './AttentionNote';
import type { Campaign } from '@/hooks/useCampaigns';

interface CampaignAttentionQueueProps {
  campaigns: Campaign[];
  open: boolean;
  onToggle: () => void;
  onOpen: (campaign: Campaign) => void;
  onExecute: (campaign: Campaign) => void;
  onStatus: (campaign: Campaign, status: CampaignStatus) => void;
  onDelete: (campaign: Campaign) => void;
}

/**
 * The work queue: campaigns that are late, idle, empty, or finished but still open.
 *
 * Each row carries the single action that clears it, so the queue empties itself
 * rather than sending you off to hunt through the grid.
 */
export function CampaignAttentionQueue({
  campaigns,
  open,
  onToggle,
  onOpen,
  onExecute,
  onStatus,
  onDelete,
}: CampaignAttentionQueueProps) {
  if (campaigns.length === 0) return null;

  return (
    <Card className="border-warning/40">
      <CardContent className="p-0">
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-3 p-3 text-left"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex -space-x-1 shrink-0">
              {campaigns.slice(0, 4).map((campaign) => (
                <span
                  key={campaign.id}
                  className={`w-2.5 h-2.5 rounded-full ring-2 ring-card ${ATTENTION_STYLE[campaign.attention!.level].dot}`}
                />
              ))}
            </span>
            <span className="font-medium text-sm">
              {campaigns.length} campaign{campaigns.length === 1 ? '' : 's'} need
              {campaigns.length === 1 ? 's' : ''} attention
            </span>
          </div>
          {open ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
        </button>

        {open && (
          <div className="divide-y border-t">
            {campaigns.map((campaign) => {
              const attention = campaign.attention!;
              const style = ATTENTION_STYLE[attention.level];
              const meta = METHOD_META[campaign.method];

              return (
                <div
                  key={campaign.id}
                  className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors"
                >
                  <div className={`p-1.5 rounded-md shrink-0 ${style.tone}`}>
                    <style.icon className="w-3.5 h-3.5" />
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpen(campaign)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="text-sm font-medium truncate">{campaign.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {attention.headline} — {attention.detail}
                    </p>
                  </button>

                  <div className="shrink-0">
                    {attention.level === 'closeable' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => onStatus(campaign, 'Completed')}
                      >
                        Mark completed
                      </Button>
                    ) : attention.level === 'empty' ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs text-destructive hover:text-destructive"
                        onClick={() => onDelete(campaign)}
                      >
                        Delete
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1.5"
                        onClick={() => onExecute(campaign)}
                      >
                        <meta.icon className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Continue</span>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
