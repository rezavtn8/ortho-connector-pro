import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertTriangle, FolderOpen, Loader2, Search, Sparkles, Users, X,
} from 'lucide-react';
import { useOffices } from '@/hooks/useOffices';
import { useDiscoveredGroups } from '@/hooks/useDiscoveredGroups';
import type { SelectedOffice } from '@/lib/campaigns';

/** A row in the pick list, normalised across both sources. */
interface PickerOffice extends SelectedOffice {
  /** Referrals in the last 12 months — network offices only. */
  l12: number;
  /** Months since last referral — network offices only. */
  mslr: number;
}

const TIER_FILTERS = ['all', 'VIP', 'Warm', 'Cold', 'Dormant'] as const;

type SortKey = 'referrals' | 'name' | 'quiet';

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'referrals', label: 'Most referrals' },
  { value: 'quiet', label: 'Quietest first' },
  { value: 'name', label: 'Name (A–Z)' },
];

/** One-click target sets, computed from the network metrics the app already derives. */
const SEGMENTS: {
  id: string;
  label: string;
  hint: string;
  pick: (offices: PickerOffice[]) => PickerOffice[];
}[] = [
  {
    id: 'vip',
    label: 'VIP partners',
    hint: 'Your top-tier referrers',
    pick: (o) => o.filter((x) => x.badge === 'VIP'),
  },
  {
    id: 'top10',
    label: 'Top 10 by volume',
    hint: 'Highest 12-month referral count',
    pick: (o) => [...o].sort((a, b) => b.l12 - a.l12).slice(0, 10),
  },
  {
    id: 'slipping',
    label: 'Gone quiet',
    hint: 'No referral in 3+ months, but has referred before',
    pick: (o) => o.filter((x) => x.mslr >= 3 && x.l12 > 0),
  },
  {
    id: 'never',
    label: 'Never referred',
    hint: 'In your network with no referrals on record',
    pick: (o) => o.filter((x) => x.l12 === 0),
  },
];

export interface OfficePickerProps {
  selected: SelectedOffice[];
  onChange: (offices: SelectedOffice[]) => void;
  /** Warn when a picked office is missing the field this campaign needs to reach it. */
  requires?: 'email' | 'address';
  /** Show the "also add to my network" switch for discovered offices. */
  addToNetwork: boolean;
  onAddToNetworkChange: (value: boolean) => void;
  preSelectedGroupId?: string | null;
}

/**
 * Target-office selection, shared by the email, letter and gift creators.
 *
 * Selections are held as whole office objects rather than ids. The three creators
 * each used to keep a bare `string[]` and re-read the office's tier out of the
 * *currently filtered* list at submit time, so anything filtered out of view was
 * written to the database as tier "Cold" and vanished from the review step.
 */
export function OfficePicker({
  selected,
  onChange,
  requires,
  addToNetwork,
  onAddToNetworkChange,
  preSelectedGroupId,
}: OfficePickerProps) {
  const [source, setSource] = useState<'network' | 'discovered'>(
    preSelectedGroupId ? 'discovered' : 'network',
  );
  const [groupId, setGroupId] = useState<string | null>(preSelectedGroupId ?? null);
  const [discovered, setDiscovered] = useState<PickerOffice[]>([]);
  const [loadingDiscovered, setLoadingDiscovered] = useState(false);
  const [search, setSearch] = useState('');
  const [tier, setTier] = useState<string>('all');
  const [sort, setSort] = useState<SortKey>('referrals');

  const { data: officesData, isLoading: loadingOffices } = useOffices();
  const { groups, getGroupOffices } = useDiscoveredGroups();

  const network: PickerOffice[] = useMemo(
    () =>
      (officesData || []).map((office) => ({
        id: office.id,
        name: office.name || 'Unnamed office',
        address: office.address || '',
        badge: office.tier || 'Cold',
        email: office.email,
        origin: 'network' as const,
        l12: office.l12 || 0,
        mslr: office.mslr ?? 99,
      })),
    [officesData],
  );

  useEffect(() => {
    if (source !== 'discovered' || !groupId) {
      setDiscovered([]);
      return;
    }
    let cancelled = false;
    setLoadingDiscovered(true);
    getGroupOffices(groupId)
      .then((offices) => {
        if (cancelled) return;
        setDiscovered(
          offices.map((o: any) => ({
            id: o.id,
            name: o.name,
            address: o.address || '',
            badge: o.office_type || 'Discovered',
            email: o.email,
            origin: 'discovered' as const,
            l12: 0,
            mslr: 99,
          })),
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingDiscovered(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, groupId]);

  const pool = source === 'network' ? network : discovered;

  const visible = useMemo(() => {
    let list = pool;
    if (source === 'network' && tier !== 'all') list = list.filter((o) => o.badge === tier);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (o) => o.name.toLowerCase().includes(q) || o.address.toLowerCase().includes(q),
      );
    }
    const sorted = [...list];
    if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'quiet') sorted.sort((a, b) => b.mslr - a.mslr || b.l12 - a.l12);
    else sorted.sort((a, b) => b.l12 - a.l12 || a.name.localeCompare(b.name));
    return sorted;
  }, [pool, source, tier, search, sort]);

  const selectedIds = useMemo(() => new Set(selected.map((o) => o.id)), [selected]);

  const toggle = (office: PickerOffice) => {
    onChange(
      selectedIds.has(office.id)
        ? selected.filter((o) => o.id !== office.id)
        : [...selected, stripMetrics(office)],
    );
  };

  const allVisibleSelected = visible.length > 0 && visible.every((o) => selectedIds.has(o.id));

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      const drop = new Set(visible.map((o) => o.id));
      onChange(selected.filter((o) => !drop.has(o.id)));
    } else {
      const additions = visible.filter((o) => !selectedIds.has(o.id)).map(stripMetrics);
      onChange([...selected, ...additions]);
    }
  };

  const applySegment = (segmentId: string) => {
    const segment = SEGMENTS.find((s) => s.id === segmentId);
    if (!segment) return;
    const additions = segment.pick(network).filter((o) => !selectedIds.has(o.id));
    onChange([...selected, ...additions.map(stripMetrics)]);
  };

  /** Switching source keeps the other source's picks — they merge into one campaign. */
  const switchSource = (next: 'network' | 'discovered') => {
    setSource(next);
    setSearch('');
    setTier('all');
  };

  const missing = requires
    ? selected.filter((o) => (requires === 'email' ? !o.email : !o.address))
    : [];

  const loading = source === 'network' ? loadingOffices : loadingDiscovered;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-base font-semibold">Target offices</Label>
        <div className="flex items-center gap-2">
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORTS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={toggleAllVisible} disabled={!visible.length}>
            {allVisibleSelected ? 'Clear these' : `Select ${visible.length}`}
          </Button>
        </div>
      </div>

      {/* Source */}
      <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-lg w-fit">
        <Button
          variant={source === 'network' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => switchSource('network')}
          className="gap-1.5 h-8"
        >
          <Users className="h-3.5 w-3.5" /> My network
        </Button>
        <Button
          variant={source === 'discovered' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => switchSource('discovered')}
          className="gap-1.5 h-8"
        >
          <FolderOpen className="h-3.5 w-3.5" /> Discovered groups
        </Button>
      </div>

      {source === 'discovered' && (
        <div className="space-y-2">
          <Select value={groupId ?? ''} onValueChange={(v) => setGroupId(v || null)}>
            <SelectTrigger>
              <SelectValue placeholder="Select a group…" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name} ({g.member_count || 0} offices)
                </SelectItem>
              ))}
              {groups.length === 0 && (
                <div className="p-3 text-sm text-muted-foreground text-center">
                  No groups yet — build one on the Find Offices page.
                </div>
              )}
            </SelectContent>
          </Select>
          <div className="flex items-start gap-2">
            <Checkbox
              id="addToNetwork"
              checked={addToNetwork}
              onCheckedChange={(c) => onAddToNetworkChange(c === true)}
              className="mt-0.5"
            />
            <div>
              <Label htmlFor="addToNetwork" className="text-sm font-medium cursor-pointer">
                Also add these offices to my network
              </Label>
              <p className="text-xs text-muted-foreground">
                Either way they are saved so this campaign can reach them; leave it off to keep
                them out of your office lists and reports.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Segments — network only, they read referral metrics */}
      {source === 'network' && network.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground flex items-center gap-1 mr-1">
            <Sparkles className="w-3 h-3" /> Quick add
          </span>
          {SEGMENTS.map((segment) => {
            const count = segment.pick(network).length;
            if (!count) return null;
            return (
              <Button
                key={segment.id}
                variant="outline"
                size="sm"
                title={segment.hint}
                className="h-7 text-xs"
                onClick={() => applySegment(segment.id)}
              >
                {segment.label} ({count})
              </Button>
            );
          })}
        </div>
      )}

      {/* Search + tiers */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or address…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {source === 'network' && (
          <div className="flex gap-1.5 flex-wrap">
            {TIER_FILTERS.map((t) => (
              <Badge
                key={t}
                variant={tier === t ? 'default' : 'outline'}
                className="cursor-pointer capitalize"
                onClick={() => setTier(t)}
              >
                {t === 'all'
                  ? `All (${network.length})`
                  : `${t} (${network.filter((o) => o.badge === t).length})`}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : source === 'discovered' && !groupId ? (
        <p className="text-center text-sm text-muted-foreground py-8 border rounded-lg border-dashed">
          Pick a group above to see its offices.
        </p>
      ) : (
        <div className="space-y-1 max-h-[320px] overflow-y-auto border rounded-lg p-2">
          {visible.map((office) => {
            const isSelected = selectedIds.has(office.id);
            return (
              <div
                key={office.id}
                onClick={() => toggle(office)}
                className={`flex items-center gap-3 p-2.5 rounded-md cursor-pointer transition-colors ${
                  isSelected ? 'bg-primary/5' : 'hover:bg-muted/50'
                }`}
              >
                <Checkbox checked={isSelected} onCheckedChange={() => toggle(office)} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{office.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {office.address || 'No address on file'}
                  </div>
                </div>
                {source === 'network' && (
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0 hidden sm:block">
                    {office.l12} in 12mo
                  </span>
                )}
                <Badge variant="outline" className="text-xs shrink-0">
                  {office.badge}
                </Badge>
              </div>
            );
          })}
          {visible.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              Nothing matches those filters.
            </p>
          )}
        </div>
      )}

      {/* Selection summary */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            {selected.length} office{selected.length === 1 ? '' : 's'} selected
          </span>
          {selected.length > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onChange([])}>
              Clear all
            </Button>
          )}
        </div>

        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5 max-h-[92px] overflow-y-auto">
            {selected.map((office) => (
              <Badge key={office.id} variant="secondary" className="gap-1 pr-1 font-normal">
                <span className="max-w-[180px] truncate">{office.name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${office.name}`}
                  className="rounded-sm hover:bg-background/60 p-0.5"
                  onClick={() => onChange(selected.filter((o) => o.id !== office.id))}
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {missing.length > 0 && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-warning/10 text-sm">
            <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <span>
              <span className="font-medium">
                {missing.length} selected office{missing.length === 1 ? ' has' : 's have'} no{' '}
                {requires === 'email' ? 'email address' : 'mailing address'}.
              </span>{' '}
              {requires === 'email'
                ? 'Their drafts will still be written — you will need to look the address up before sending.'
                : 'Add one on the office page or the letter will print without a recipient block.'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function stripMetrics(office: PickerOffice): SelectedOffice {
  const { l12, mslr, ...rest } = office;
  return rest;
}
