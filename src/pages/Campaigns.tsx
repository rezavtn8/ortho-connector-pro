import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  AlertCircle, CalendarRange, FileText, Gift, LayoutGrid, Loader2, Mail, Plus,
  Search, Columns3, Target, WifiOff,
} from 'lucide-react';

import { ResilientErrorBoundary } from '@/components/ResilientErrorBoundary';
import { EmailCampaignCreator } from '@/components/campaign/EmailCampaignCreator';
import { PhysicalCampaignCreator } from '@/components/campaign/PhysicalCampaignCreator';
import { LetterCampaignCreator } from '@/components/campaign/LetterCampaignCreator';
import { EmailExecutionDialog } from '@/components/campaign/EmailExecutionDialog';
import { GiftDeliveryDialog } from '@/components/campaign/GiftDeliveryDialog';
import { LetterExecutionDialog } from '@/components/campaign/LetterExecutionDialog';
import { CampaignDetailDialog } from '@/components/campaign/CampaignDetailDialog';
import { CampaignOverview } from '@/components/campaign/CampaignOverview';
import { CampaignAttentionQueue } from '@/components/campaign/CampaignAttentionQueue';
import { CampaignCard } from '@/components/campaign/CampaignCard';
import { CampaignBoard } from '@/components/campaign/CampaignBoard';
import { CampaignTimeline } from '@/components/campaign/CampaignTimeline';

import { useCampaigns, useCampaignActions, type Campaign } from '@/hooks/useCampaigns';
import { useOffices } from '@/hooks/useOffices';
import { attentionRank, type CampaignStatus, type DeliveryMethod } from '@/lib/campaigns';

type ViewMode = 'grid' | 'board' | 'timeline';
type SortKey = 'recent' | 'schedule' | 'progress' | 'name';

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'recent', label: 'Newest first' },
  { value: 'schedule', label: 'By send date' },
  { value: 'progress', label: 'Least finished' },
  { value: 'name', label: 'Name (A–Z)' },
];

const CREATORS: {
  method: DeliveryMethod;
  label: string;
  description: string;
  icon: React.ElementType;
}[] = [
  {
    method: 'email',
    label: 'Email campaign',
    description: 'AI drafts a personalised email per office; you review and send.',
    icon: Mail,
  },
  {
    method: 'letter',
    label: 'Letter campaign',
    description: 'Tier-based letters, restyled and exported as one print-ready PDF.',
    icon: FileText,
  },
  {
    method: 'physical',
    label: 'Gift campaign',
    description: 'Plan a bundle, budget it, and track every hand-off.',
    icon: Gift,
  },
];

function CampaignsContent() {
  const { data: campaigns = [], isLoading, error, refetch, isOffline } = useCampaigns();
  const { data: offices } = useOffices();
  const actions = useCampaignActions();

  const [creator, setCreator] = useState<DeliveryMethod | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [executeOpen, setExecuteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | CampaignStatus>('all');
  const [method, setMethod] = useState<'all' | DeliveryMethod>('all');
  const [sort, setSort] = useState<SortKey>('recent');
  const [view, setView] = useState<ViewMode>('grid');
  const [attentionOpen, setAttentionOpen] = useState(false);

  // Always read the live row: a stale copy would show pre-mutation counts in the
  // detail dialog after a status change or a delivery being marked sent.
  const selected = useMemo(
    () => campaigns.find((c) => c.id === selectedId) ?? null,
    [campaigns, selectedId],
  );

  const needsAttention = useMemo(
    () =>
      campaigns
        .filter((c) => c.attention)
        .sort(
          (a, b) =>
            attentionRank(a.attention!.level) - attentionRank(b.attention!.level) ||
            a.name.localeCompare(b.name),
        ),
    [campaigns],
  );

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = campaigns.filter((campaign) => {
      if (status !== 'all' && campaign.statusLabel !== status) return false;
      if (method !== 'all' && campaign.method !== method) return false;
      if (query && !campaign.name.toLowerCase().includes(query)) {
        return !!campaign.notes?.toLowerCase().includes(query);
      }
      return true;
    });

    const sorted = [...list];
    switch (sort) {
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'progress':
        sorted.sort((a, b) => a.progress.pct - b.progress.pct);
        break;
      case 'schedule':
        sorted.sort((a, b) => {
          if (!a.planned_delivery_date) return 1;
          if (!b.planned_delivery_date) return -1;
          return a.planned_delivery_date.localeCompare(b.planned_delivery_date);
        });
        break;
      default:
        sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
    return sorted;
  }, [campaigns, search, status, method, sort]);

  const openDetail = (campaign: Campaign) => {
    setSelectedId(campaign.id);
    setDetailOpen(true);
  };

  const openExecution = (campaign: Campaign) => {
    setSelectedId(campaign.id);
    setDetailOpen(false);
    setExecuteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const removed = await actions.remove(deleteTarget);
    setDeleteTarget(null);
    if (removed && deleteTarget.id === selectedId) {
      setDetailOpen(false);
      setSelectedId(null);
    }
  };

  const cardHandlers = {
    onOpen: openDetail,
    onExecute: openExecution,
    onDuplicate: actions.duplicate,
    onDelete: (campaign: Campaign) => setDeleteTarget(campaign),
    onStatus: actions.setStatus,
  };

  const filtersActive = !!search || status !== 'all' || method !== 'all';

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error && campaigns.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md w-full">
          <CardContent className="text-center py-8">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              {isOffline ? (
                <WifiOff className="w-6 h-6 text-destructive" />
              ) : (
                <AlertCircle className="w-6 h-6 text-destructive" />
              )}
            </div>
            <h3 className="font-semibold text-lg mb-2">
              {isOffline ? "You're offline" : 'Could not load campaigns'}
            </h3>
            <p className="text-muted-foreground text-sm mb-4">
              {isOffline
                ? 'Campaigns are not available while offline.'
                : 'Something went wrong reading your campaigns.'}
            </p>
            <Button onClick={() => refetch()} disabled={isOffline} variant="outline" className="gap-2">
              <Loader2 className="h-4 w-4" /> Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isOffline && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="flex items-center gap-3 p-3">
            <WifiOff className="h-4 w-4 text-warning" />
            <p className="text-sm">You're offline — showing the last campaigns loaded.</p>
          </CardContent>
        </Card>
      )}

      {campaigns.length === 0 ? (
        <FirstRun onPick={setCreator} disabled={isOffline} />
      ) : (
        <>
          <CampaignOverview
            campaigns={campaigns}
            networkOfficeCount={offices?.length ?? 0}
            attentionCount={needsAttention.length}
            onShowAttention={() => setAttentionOpen(true)}
          />

          <CampaignAttentionQueue
            campaigns={needsAttention}
            open={attentionOpen}
            onToggle={() => setAttentionOpen((v) => !v)}
            onOpen={openDetail}
            onExecute={openExecution}
            onStatus={actions.setStatus}
            onDelete={(campaign) => setDeleteTarget(campaign)}
          />

          {/* Toolbar */}
          <div className="flex flex-col lg:flex-row gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search campaigns and notes…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="letter">Letter</SelectItem>
                  <SelectItem value="physical">Gift</SelectItem>
                </SelectContent>
              </Select>

              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                <SelectTrigger className="w-[150px]">
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

              <ToggleGroup
                type="single"
                value={view}
                onValueChange={(v) => v && setView(v as ViewMode)}
                className="border rounded-md"
              >
                <ToggleGroupItem value="grid" aria-label="Grid view" className="h-9 w-9 p-0">
                  <LayoutGrid className="w-4 h-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="board" aria-label="Status board" className="h-9 w-9 p-0">
                  <Columns3 className="w-4 h-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="timeline" aria-label="Schedule" className="h-9 w-9 p-0">
                  <CalendarRange className="w-4 h-4" />
                </ToggleGroupItem>
              </ToggleGroup>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="gap-1.5" disabled={isOffline}>
                    <Plus className="w-4 h-4" /> New campaign
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  {CREATORS.map((option) => (
                    <DropdownMenuItem
                      key={option.method}
                      onClick={() => setCreator(option.method)}
                      className="items-start gap-2.5 py-2.5"
                    >
                      <option.icon className="w-4 h-4 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-sm">{option.label}</p>
                        <p className="text-xs text-muted-foreground">{option.description}</p>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Results */}
          {visible.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Target className="w-6 h-6 text-muted-foreground" />
                </div>
                <h3 className="font-medium mb-1">No campaigns match</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {filtersActive
                    ? 'Try widening the filters.'
                    : 'Create your first campaign to get started.'}
                </p>
                {filtersActive && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearch('');
                      setStatus('all');
                      setMethod('all');
                    }}
                  >
                    Clear filters
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : view === 'board' ? (
            <CampaignBoard campaigns={visible} {...cardHandlers} />
          ) : view === 'timeline' ? (
            <CampaignTimeline campaigns={visible} onOpen={openDetail} onExecute={openExecution} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {visible.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} {...cardHandlers} />
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Showing {visible.length} of {campaigns.length} campaigns
          </p>
        </>
      )}

      {/* Creators */}
      <EmailCampaignCreator
        open={creator === 'email'}
        onOpenChange={(open) => !open && setCreator(null)}
        onCampaignCreated={actions.refresh}
      />
      <LetterCampaignCreator
        open={creator === 'letter'}
        onOpenChange={(open) => !open && setCreator(null)}
        onCampaignCreated={actions.refresh}
      />
      <PhysicalCampaignCreator
        open={creator === 'physical'}
        onOpenChange={(open) => !open && setCreator(null)}
        onCampaignCreated={actions.refresh}
      />

      {/* Detail + execution */}
      {selected && (
        <>
          <CampaignDetailDialog
            campaign={selected}
            open={detailOpen}
            onOpenChange={setDetailOpen}
            onExecute={() => openExecution(selected)}
            onDelete={() => setDeleteTarget(selected)}
          />

          {selected.method === 'email' && (
            <EmailExecutionDialog
              campaign={selected}
              open={executeOpen}
              onOpenChange={setExecuteOpen}
              onCampaignUpdated={actions.refresh}
            />
          )}
          {selected.method === 'letter' && (
            <LetterExecutionDialog
              campaign={selected}
              open={executeOpen}
              onOpenChange={setExecuteOpen}
              onCampaignUpdated={actions.refresh}
            />
          )}
          {selected.method === 'physical' && (
            <GiftDeliveryDialog
              campaign={selected}
              open={executeOpen}
              onOpenChange={setExecuteOpen}
              onCampaignUpdated={actions.refresh}
            />
          )}
        </>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name}" and its {deleteTarget?.stats.total ?? 0} delivery record
              {deleteTarget?.stats.total === 1 ? '' : 's'} will be removed. Drafted emails and
              letters go with them. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Shown only when the account has no campaigns at all. */
function FirstRun({
  onPick,
  disabled,
}: {
  onPick: (method: DeliveryMethod) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-4">
      <Card className="border-dashed">
        <CardContent className="py-10 text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Target className="w-6 h-6 text-primary" />
          </div>
          <h3 className="font-semibold text-lg">Start reaching your referral network</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            A campaign picks a set of offices, writes the outreach for each of them, and keeps
            track of what actually went out.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {CREATORS.map((option) => (
          <Card key={option.method} className="flex flex-col">
            <CardContent className="p-5 flex flex-col gap-3 flex-1">
              <div className="p-2 rounded-md bg-muted w-fit">
                <option.icon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold">{option.label}</h4>
                <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
              </div>
              <Button
                variant="outline"
                className="w-full gap-1.5"
                disabled={disabled}
                onClick={() => onPick(option.method)}
              >
                <Plus className="w-4 h-4" /> Create
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function Campaigns() {
  return (
    <ResilientErrorBoundary>
      <CampaignsContent />
    </ResilientErrorBoundary>
  );
}
