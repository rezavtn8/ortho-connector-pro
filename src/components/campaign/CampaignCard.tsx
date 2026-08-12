import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowRight, CalendarDays, CheckCircle2, Clock, Copy, Eye, MoreVertical, Send,
  Trash2, Users, Zap,
} from 'lucide-react';
import { format } from 'date-fns';
import { METHOD_META, type CampaignStatus } from '@/lib/campaigns';
import { ATTENTION_STYLE } from './AttentionNote';
import type { Campaign } from '@/hooks/useCampaigns';

/** Tier hues live as CSS variables; Tailwind has no class for them. */
const TIER_VAR: Record<string, string> = {
  VIP: '--tier-vip',
  Warm: '--tier-warm',
  Cold: '--tier-cold',
  Dormant: '--tier-dormant',
};

export interface CampaignCardProps {
  campaign: Campaign;
  onOpen: (campaign: Campaign) => void;
  onExecute: (campaign: Campaign) => void;
  onDuplicate: (campaign: Campaign) => void;
  onDelete: (campaign: Campaign) => void;
  onStatus: (campaign: Campaign, status: CampaignStatus) => void;
  /** Board columns are narrow — drop the secondary rows there. */
  compact?: boolean;
}

/** The action callbacks every view passes straight through to the cards. */
export type CampaignCardHandlers = Omit<CampaignCardProps, 'campaign' | 'compact'>;

export function CampaignCard({
  campaign,
  onOpen,
  onExecute,
  onDuplicate,
  onDelete,
  onStatus,
  compact = false,
}: CampaignCardProps) {
  // A campaign can arrive from a stale cache or a partial write without its derived
  // roll-up; fall back rather than take the whole page down.
  const method = normalizeMethod(campaign.method ?? campaign.delivery_method);
  const meta = METHOD_META[method] ?? METHOD_META.physical;
  const stats = campaign.stats ?? EMPTY_STATS;
  const progress = campaign.progress ?? progressFor(method, stats);
  const attention = campaign.attention ?? null;
  const attentionStyle = attention ? ATTENTION_STYLE[attention.level] : null;

  const tiers = Object.entries(stats.tiers ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <Card
      className="group relative overflow-hidden hover:shadow-md hover:border-primary/30 transition-all cursor-pointer"
      onClick={() => onOpen(campaign)}
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${meta.accent} opacity-70`} aria-hidden />

      <CardContent className={`space-y-3 pl-5 ${compact ? 'p-3 pl-5' : 'p-4 pl-5'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className={`p-1.5 rounded-md shrink-0 ${meta.chip}`}>
              <meta.icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm leading-snug line-clamp-2">{campaign.name}</h3>
              <p className="text-xs text-muted-foreground capitalize mt-0.5">
                {campaign.campaign_type.replace(/_/g, ' ')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {attentionStyle && (
              <span
                className={`w-2 h-2 rounded-full ${attentionStyle.dot}`}
                title={attention!.headline}
                aria-label={attention!.headline}
              />
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreVertical className="w-3.5 h-3.5" />
                  <span className="sr-only">Campaign actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => onOpen(campaign)}>
                  <Eye className="w-3.5 h-3.5 mr-2" /> View details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExecute(campaign)}>
                  <Zap className="w-3.5 h-3.5 mr-2" /> {meta.action}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDuplicate(campaign)}>
                  <Copy className="w-3.5 h-3.5 mr-2" /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {campaign.statusLabel !== 'Active' && (
                  <DropdownMenuItem onClick={() => onStatus(campaign, 'Active')}>
                    <Send className="w-3.5 h-3.5 mr-2" /> Set active
                  </DropdownMenuItem>
                )}
                {campaign.statusLabel !== 'Completed' && (
                  <DropdownMenuItem onClick={() => onStatus(campaign, 'Completed')}>
                    <CheckCircle2 className="w-3.5 h-3.5 mr-2" /> Mark completed
                  </DropdownMenuItem>
                )}
                {campaign.statusLabel !== 'Draft' && (
                  <DropdownMenuItem onClick={() => onStatus(campaign, 'Draft')}>
                    <Clock className="w-3.5 h-3.5 mr-2" /> Back to draft
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onDelete(campaign)}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{progress.label}</span>
            <span className="font-medium tabular-nums">{progress.pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full ${meta.accent} transition-all`}
              style={{ width: `${progress.pct}%` }}
            />
          </div>
        </div>

        {!compact && (
          <>
            {/* Audience mix */}
            {tiers.length > 0 && (
              <div className="space-y-1">
                <div className="flex h-1.5 rounded-full overflow-hidden bg-muted">
                  {tiers.map(([tier, count]) => (
                    <span
                      key={tier}
                      title={`${tier}: ${count}`}
                      style={{
                        width: `${(count / stats.total) * 100}%`,
                        backgroundColor: `hsl(var(${TIER_VAR[tier] ?? '--tier-cold'}))`,
                      }}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {stats.total} office{stats.total === 1 ? '' : 's'}
                  </span>
                  {campaign.planned_delivery_date && (
                    <span className="flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" />
                      {format(new Date(`${campaign.planned_delivery_date}T00:00:00`), 'MMM d')}
                    </span>
                  )}
                  {tiers.slice(0, 2).map(([tier, count]) => (
                    <span key={tier}>
                      {count} {tier}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {attention && attentionStyle && (
              <div
                className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs ${attentionStyle.tone}`}
              >
                <attentionStyle.icon className="w-3 h-3 shrink-0" />
                <span className="truncate">{attention.headline}</span>
              </div>
            )}

            <Button
              size="sm"
              variant={campaign.statusLabel === 'Completed' ? 'outline' : 'default'}
              className="w-full text-xs h-8 gap-1"
              onClick={(e) => {
                e.stopPropagation();
                onExecute(campaign);
              }}
            >
              {meta.action}
              <ArrowRight className="w-3 h-3" />
            </Button>
          </>
        )}

        {compact && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {stats.total}
            </span>
            {campaign.planned_delivery_date && (
              <span className="flex items-center gap-1">
                <CalendarDays className="w-3 h-3" />
                {format(new Date(`${campaign.planned_delivery_date}T00:00:00`), 'MMM d')}
              </span>
            )}
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {meta.label}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
