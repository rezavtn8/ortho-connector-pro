import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, DollarSign, Network, Rocket } from 'lucide-react';
import type { Campaign } from '@/hooks/useCampaigns';

interface CampaignOverviewProps {
  campaigns: Campaign[];
  /** Offices in the user's network, for the coverage figure. */
  networkOfficeCount: number;
  attentionCount: number;
  onShowAttention: () => void;
}

/**
 * The four numbers worth knowing before touching anything else on the page.
 *
 * These replace a row of four badges that all counted the same thing (campaigns by
 * status) and told you nothing about whether the outreach was working.
 */
export function CampaignOverview({
  campaigns,
  networkOfficeCount,
  attentionCount,
  onShowAttention,
}: CampaignOverviewProps) {
  const summary = useMemo(() => {
    const active = campaigns.filter((c) => c.statusLabel === 'Active');
    const drafts = campaigns.filter((c) => c.statusLabel === 'Draft');

    const touched = new Set<string>();
    let spend = 0;
    let referrals = 0;

    for (const campaign of campaigns) {
      campaign.stats.officeIds.forEach((id) => touched.add(id));
      if (campaign.statusLabel !== 'Draft') spend += campaign.estimated_cost ?? 0;
      referrals += campaign.actual_referrals ?? 0;
    }

    const outstanding = active.reduce(
      (sum, c) => sum + (c.progress.total - c.progress.done),
      0,
    );

    return {
      activeCount: active.length,
      draftCount: drafts.length,
      outstanding,
      touched: touched.size,
      coverage: networkOfficeCount ? Math.round((touched.size / networkOfficeCount) * 100) : 0,
      spend,
      referrals,
      costPerReferral: referrals > 0 && spend > 0 ? spend / referrals : null,
    };
  }, [campaigns, networkOfficeCount]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Tile
        icon={Rocket}
        label="In flight"
        value={summary.activeCount}
        detail={
          summary.outstanding
            ? `${summary.outstanding} deliveries outstanding`
            : summary.draftCount
              ? `${summary.draftCount} draft${summary.draftCount === 1 ? '' : 's'} waiting`
              : 'Nothing outstanding'
        }
      />

      <Tile
        icon={AlertTriangle}
        label="Needs attention"
        value={attentionCount}
        detail={attentionCount ? 'Tap to review the queue' : 'Everything is on track'}
        tone={attentionCount ? 'warn' : 'default'}
        onClick={attentionCount ? onShowAttention : undefined}
      />

      <Tile
        icon={Network}
        label="Network reached"
        value={networkOfficeCount ? `${summary.coverage}%` : summary.touched}
        detail={
          networkOfficeCount
            ? `${summary.touched} of ${networkOfficeCount} offices have been in a campaign`
            : `${summary.touched} offices contacted`
        }
        bar={networkOfficeCount ? summary.coverage : undefined}
      />

      <Tile
        icon={DollarSign}
        label="Committed spend"
        value={`$${summary.spend.toLocaleString()}`}
        detail={
          summary.costPerReferral !== null
            ? `$${summary.costPerReferral.toFixed(0)} per attributed referral`
            : summary.referrals > 0
              ? `${summary.referrals} referrals attributed`
              : 'Record results to see cost per referral'
        }
      />
    </div>
  );
}

interface TileProps {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  detail: string;
  tone?: 'default' | 'warn';
  bar?: number;
  onClick?: () => void;
}

function Tile({ icon: Icon, label, value, detail, tone = 'default', bar, onClick }: TileProps) {
  const interactive = !!onClick;
  return (
    <Card
      onClick={onClick}
      className={`transition-colors ${interactive ? 'cursor-pointer hover:border-primary/40' : ''} ${
        tone === 'warn' ? 'border-warning/40 bg-warning/5' : ''
      }`}
    >
      <CardContent className="p-4 space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon className={`w-3.5 h-3.5 ${tone === 'warn' ? 'text-warning' : ''}`} />
          {label}
        </div>
        <p className="text-2xl font-semibold tabular-nums leading-none">{value}</p>
        {bar !== undefined && (
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary" style={{ width: `${bar}%` }} />
          </div>
        )}
        <p className="text-xs text-muted-foreground leading-snug">{detail}</p>
      </CardContent>
    </Card>
  );
}
