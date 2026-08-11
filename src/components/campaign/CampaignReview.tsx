import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Users } from 'lucide-react';
import { format } from 'date-fns';
import { METHOD_META, type DeliveryMethod, type SelectedOffice } from '@/lib/campaigns';

interface CampaignReviewProps {
  method: DeliveryMethod;
  name: string;
  typeLabel: string;
  plannedDate?: Date;
  notes?: string;
  offices: SelectedOffice[];
  addToNetwork?: boolean;
  /** Extra rows for method-specific facts, e.g. the gift bundle and its cost. */
  extras?: { label: string; value: React.ReactNode }[];
  footnote?: string;
}

/** Final wizard step — identical shape for all three campaign types. */
export function CampaignReview({
  method,
  name,
  typeLabel,
  plannedDate,
  notes,
  offices,
  addToNetwork,
  extras = [],
  footnote,
}: CampaignReviewProps) {
  const meta = METHOD_META[method];

  const tierMix = useMemo(() => {
    const counts = new Map<string, number>();
    offices.forEach((o) => counts.set(o.badge, (counts.get(o.badge) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [offices]);

  const discoveredCount = offices.filter((o) => o.origin === 'discovered').length;

  return (
    <div className="space-y-4">
      <Card className="bg-muted/30">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-md ${meta.chip}`}>
              <meta.icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold leading-tight">{name || 'Untitled campaign'}</h3>
              <p className="text-sm text-muted-foreground">
                {meta.label} campaign · {typeLabel}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Offices</span>
              <p className="font-medium flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {offices.length}
                {discoveredCount > 0 && (
                  <span className="text-muted-foreground font-normal">
                    ({discoveredCount} discovered)
                  </span>
                )}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">
                {method === 'physical' ? 'Delivery date' : method === 'letter' ? 'Print date' : 'Send date'}
              </span>
              <p className="font-medium flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {plannedDate ? format(plannedDate, 'MMM d, yyyy') : 'Not scheduled'}
              </p>
            </div>
            {extras.map((extra) => (
              <div key={extra.label}>
                <span className="text-muted-foreground">{extra.label}</span>
                <p className="font-medium">{extra.value}</p>
              </div>
            ))}
          </div>

          {tierMix.length > 0 && (
            <div>
              <span className="text-sm text-muted-foreground">Audience mix</span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {tierMix.map(([tier, count]) => (
                  <Badge key={tier} variant="outline" className="text-xs">
                    {tier}: {count}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {notes && (
            <div className="text-sm">
              <span className="text-muted-foreground">Notes</span>
              <p className="whitespace-pre-wrap">{notes}</p>
            </div>
          )}

          {discoveredCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {addToNetwork
                ? `${discoveredCount} discovered office${discoveredCount === 1 ? '' : 's'} will be added to your network.`
                : `${discoveredCount} discovered office${discoveredCount === 1 ? '' : 's'} will be saved for this campaign only and stay out of your network lists.`}
            </p>
          )}
        </CardContent>
      </Card>

      <div>
        <span className="text-sm font-semibold">Recipients</span>
        <div className="mt-2 space-y-1 max-h-[220px] overflow-y-auto pr-1">
          {offices.map((office) => (
            <div
              key={office.id}
              className="flex items-center justify-between gap-2 text-sm p-2 rounded-md bg-muted/30"
            >
              <span className="truncate">{office.name}</span>
              <Badge variant="outline" className="text-xs shrink-0">
                {office.badge}
              </Badge>
            </div>
          ))}
        </div>
      </div>

      {footnote && <p className="text-xs text-muted-foreground">{footnote}</p>}
    </div>
  );
}
