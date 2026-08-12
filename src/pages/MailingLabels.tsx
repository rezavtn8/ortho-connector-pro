import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InlineEditCell } from '@/components/InlineEditCell';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Download,
  Search,
  MapPin,
  CheckCircle2,
  Loader2,
  Printer,
  FileDown,
  RotateCcw,
  ArrowLeft,
  FolderOpen,
  AlertTriangle,
  Copy,
  Settings2,
  X,
} from 'lucide-react';
import {
  buildPrintQueue,
  downloadLabelsPDF,
  AVERY_TEMPLATES,
  type LabelData,
} from '@/utils/pdfLabelGenerator';
import { useOffices } from '@/hooks/useOffices';
import { useDiscoveredGroups } from '@/hooks/useDiscoveredGroups';
import { useLabelPrintSettings, type LabelNameFormat } from '@/hooks/useLabelPrintSettings';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  parseAddress,
  extractContactName,
  isIncomplete,
  missingFields,
  markDuplicates,
  type LabelRow,
} from '@/lib/mailingLabels';
// xlsx is ~94 kB gzipped and only needed when the user actually exports, so it is
// imported on demand inside the handler rather than at module scope.
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { AddressCorrectionDialog } from '@/components/AddressCorrectionDialog';
import { MailingLabelPreview } from '@/components/MailingLabelPreview';
import { LabelCustomizationDialog } from '@/components/LabelCustomizationDialog';

type SourceFilter = 'all' | 'partner' | 'discovered' | 'group';
type SortKey = 'name' | 'city' | 'zip';
type IssueView = 'all' | 'incomplete' | 'duplicates';

type DecoratedRow = LabelRow & { isDuplicate: boolean; incomplete: boolean };

const TIERS = ['VIP', 'Warm', 'Cold', 'Dormant'] as const;

const SORT_LABELS: Record<SortKey, string> = {
  name: 'Name (A–Z)',
  city: 'City',
  zip: 'ZIP code',
};

/** Small labelled figure used in the summary strip. */
function Stat({
  value,
  label,
  tone = 'default',
  icon,
}: {
  value: React.ReactNode;
  label: string;
  tone?: 'default' | 'warning';
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-2">
      <div
        className={`text-2xl font-semibold tabular-nums flex items-center gap-1.5 ${
          tone === 'warning' ? 'text-amber-600 dark:text-amber-500' : ''
        }`}
      >
        {icon}
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export function MailingLabels() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const selectedIds = useMemo(
    () => searchParams.get('ids')?.split(',').filter(Boolean) ?? [],
    [searchParams],
  );
  const isDiscoveredSource = searchParams.get('discovered') === 'true';
  const groupIdParam = searchParams.get('group') || null;
  const hasSelectedIds = selectedIds.length > 0;

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTiers, setSelectedTiers] = useState<string[]>([...TIERS]);
  const [includeDiscovered, setIncludeDiscovered] = useState(isDiscoveredSource || !!groupIdParam);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>(
    groupIdParam ? 'group' : isDiscoveredSource && hasSelectedIds ? 'discovered' : 'all',
  );
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(groupIdParam);
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [issueView, setIssueView] = useState<IssueView>('all');
  const [hideDuplicates, setHideDuplicates] = useState(true);

  // Rows the user has explicitly unchecked. Keyed by stable row id so a row keeps
  // its state when filters bring it in and out of view.
  const [excludedIds, setExcludedIds] = useState<Set<string>>(() => new Set());
  // Cell-level overrides layered on top of the parsed data, also keyed by row id,
  // so editing a row never freezes the filters the way a snapshot copy would.
  const [edits, setEdits] = useState<Record<string, Partial<LabelRow>>>({});

  const [isCorrecting, setIsCorrecting] = useState(false);
  const [correctionProgress, setCorrectionProgress] = useState(0);
  const [showCorrectionDialog, setShowCorrectionDialog] = useState(false);
  const [correctionResults, setCorrectionResults] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [showCustomization, setShowCustomization] = useState(false);

  const { settings, update: updateSettings } = useLabelPrintSettings();
  const { templateKey, copies, startOffset, nameFormat, customization } = settings;
  const template = AVERY_TEMPLATES[templateKey] ?? AVERY_TEMPLATES['5160'];
  const labelsPerSheet = template.cols * template.rows;

  const { data: offices = [], isLoading: officesLoading } = useOffices();
  const { groups, getGroupMemberIds: fetchGroupMemberIds } = useDiscoveredGroups();

  useEffect(() => {
    if (sourceFilter === 'group' && selectedGroupId) {
      fetchGroupMemberIds(selectedGroupId).then(ids => setGroupMemberIds(ids));
    }
    // fetchGroupMemberIds is re-created every render by useDiscoveredGroups; including
    // it here would re-fetch in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceFilter, selectedGroupId]);

  const { data: discoveredOffices = [], isLoading: discoveredLoading } = useQuery({
    queryKey: ['discovered-offices-for-labels'],
    queryFn: async () => {
      const { data, error } = await supabase.from('discovered_offices').select('*').order('name');
      if (error) throw error;
      return data || [];
    },
    enabled:
      includeDiscovered ||
      sourceFilter === 'discovered' ||
      sourceFilter === 'group' ||
      isDiscoveredSource,
  });

  const isLoading = officesLoading || (includeDiscovered && discoveredLoading);

  /** Rows matching the source/tier/search filters, with edits and flags applied. */
  const rows = useMemo<DecoratedRow[]>(() => {
    const matchesSearch = (name: string, address: string | null | undefined) => {
      if (!searchTerm) return true;
      const needle = searchTerm.toLowerCase();
      return (
        name.toLowerCase().includes(needle) || (address?.toLowerCase().includes(needle) ?? false)
      );
    };

    const base: LabelRow[] = [];

    if (sourceFilter === 'all' || sourceFilter === 'partner') {
      for (const office of offices) {
        if (hasSelectedIds) {
          if (!selectedIds.includes(office.id)) continue;
        } else {
          if (!selectedTiers.includes(office.tier ?? '')) continue;
          if (!matchesSearch(office.name, office.address)) continue;
        }
        base.push({
          id: `partner:${office.id}`,
          source: 'partner',
          officeName: office.name,
          contactName: extractContactName(office.name),
          ...parseAddress(office.address),
        });
      }
    }

    const shouldIncludeDiscovered =
      (isDiscoveredSource && hasSelectedIds) ||
      sourceFilter === 'group' ||
      (!hasSelectedIds &&
        (sourceFilter === 'all' || sourceFilter === 'discovered') &&
        (includeDiscovered || sourceFilter === 'discovered'));

    if (shouldIncludeDiscovered) {
      for (const office of discoveredOffices) {
        if (sourceFilter === 'group' && selectedGroupId) {
          if (!groupMemberIds.includes(office.id)) continue;
          if (!matchesSearch(office.name, office.address)) continue;
        } else if (isDiscoveredSource && hasSelectedIds) {
          if (!selectedIds.includes(office.id)) continue;
        } else if (!matchesSearch(office.name, office.address)) {
          continue;
        }

        base.push({
          id: `discovered:${office.id}`,
          source: 'discovered',
          officeName: office.name,
          contactName: extractContactName(office.name),
          ...parseAddress(office.address),
        });
      }
    }

    const withEdits = base.map(row => ({ ...row, ...edits[row.id] }));
    const flagged = markDuplicates(withEdits).map(row => ({
      ...row,
      incomplete: isIncomplete(row),
    }));

    const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
    return [...flagged].sort((a, b) => {
      if (sortKey === 'zip') return collator.compare(a.zip, b.zip) || collator.compare(a.officeName, b.officeName);
      if (sortKey === 'city') return collator.compare(a.city, b.city) || collator.compare(a.officeName, b.officeName);
      return collator.compare(a.officeName, b.officeName);
    });
  }, [
    offices,
    discoveredOffices,
    selectedTiers,
    includeDiscovered,
    searchTerm,
    sourceFilter,
    hasSelectedIds,
    selectedIds,
    isDiscoveredSource,
    groupMemberIds,
    selectedGroupId,
    edits,
    sortKey,
  ]);

  const duplicateCount = useMemo(() => rows.filter(r => r.isDuplicate).length, [rows]);
  const incompleteCount = useMemo(() => rows.filter(r => r.incomplete).length, [rows]);

  /**
   * Rows that will actually print. The issue chips below only change what the table
   * shows — narrowing the view must never silently shrink the export.
   */
  const exportRows = useMemo(
    () => rows.filter(r => !excludedIds.has(r.id) && !(hideDuplicates && r.isDuplicate)),
    [rows, excludedIds, hideDuplicates],
  );

  const visibleRows = useMemo(() => {
    if (issueView === 'incomplete') return rows.filter(r => r.incomplete);
    if (issueView === 'duplicates') return rows.filter(r => r.isDuplicate);
    return rows;
  }, [rows, issueView]);

  const excludedCount = rows.length - exportRows.length;
  const incompleteSelected = useMemo(
    () => exportRows.filter(r => r.incomplete).length,
    [exportRows],
  );

  const labelData = useMemo<LabelData[]>(
    () =>
      exportRows.map(row => ({
        contact: nameFormat === 'office' ? row.officeName : row.contactName,
        address1: row.address1,
        address2: row.address2,
        city: row.city,
        state: row.state,
        zip: row.zip,
      })),
    [exportRows, nameFormat],
  );

  const printQueue = useMemo(
    () => buildPrintQueue(labelData, { copies, startOffset }),
    [labelData, copies, startOffset],
  );

  const totalSlots = printQueue.length;
  const sheetsNeeded = totalSlots === 0 ? 0 : Math.ceil(totalSlots / labelsPerSheet);
  const blanksOnLastSheet = sheetsNeeded === 0 ? 0 : sheetsNeeded * labelsPerSheet - totalSlots;

  const hasEdits = Object.keys(edits).length > 0;

  /** Switching to a smaller sheet can leave a stored offset past the last slot. */
  const handleTemplateChange = useCallback(
    (nextKey: string) => {
      const next = AVERY_TEMPLATES[nextKey] ?? AVERY_TEMPLATES['5160'];
      const maxOffset = next.cols * next.rows - 1;
      updateSettings({
        templateKey: nextKey,
        startOffset: Math.min(settings.startOffset, maxOffset),
      });
    },
    [updateSettings, settings.startOffset],
  );

  const handleCellEdit = useCallback((id: string, field: keyof LabelRow, value: string) => {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }, []);

  const toggleRow = useCallback((id: string) => {
    setExcludedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const visibleSelectedCount = visibleRows.filter(r => !excludedIds.has(r.id)).length;
  const allVisibleSelected = visibleRows.length > 0 && visibleSelectedCount === visibleRows.length;

  const toggleAllVisible = () => {
    setExcludedIds(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleRows.forEach(r => next.add(r.id));
      else visibleRows.forEach(r => next.delete(r.id));
      return next;
    });
  };

  const resetEdits = () => {
    setEdits({});
    toast({ title: 'Edits cleared', description: 'All cells restored to their source values.' });
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedTiers([...TIERS]);
    setSourceFilter('all');
    setSelectedGroupId(null);
    setIssueView('all');
  };

  const toggleTier = (tier: string) => {
    setSelectedTiers(prev =>
      prev.includes(tier) ? prev.filter(t => t !== tier) : [...prev, tier],
    );
  };

  const warnIfIncomplete = () => {
    if (incompleteSelected > 0) {
      toast({
        title: `${incompleteSelected} label${incompleteSelected === 1 ? '' : ' has'} missing address parts`,
        description: 'They were included anyway — check the highlighted rows before mailing.',
      });
    }
  };

  const exportRowsAsRecords = (): Record<string, string>[] =>
    exportRows.map(row => ({
      Name: nameFormat === 'office' ? row.officeName : row.contactName,
      'Address 1': row.address1,
      'Address 2': row.address2,
      City: row.city,
      State: row.state,
      ZIP: row.zip,
    }));

  const handleExportToExcel = async () => {
    if (exportRows.length === 0) return;
    const XLSX = await import('xlsx');

    const worksheet = XLSX.utils.json_to_sheet(exportRowsAsRecords());
    worksheet['!cols'] = [
      { wch: 30 }, // Name
      { wch: 30 }, // Address 1
      { wch: 20 }, // Address 2
      { wch: 20 }, // City
      { wch: 8 }, // State
      { wch: 12 }, // ZIP
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Mailing Labels');

    const fileName = `mailing-labels-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    warnIfIncomplete();
    toast({
      title: 'Excel exported',
      description: `${exportRows.length} rows written to ${fileName}.`,
    });
  };

  const handleExportToCsv = () => {
    if (exportRows.length === 0) return;

    const records = exportRowsAsRecords();
    const headers = Object.keys(records[0]);
    const escape = (value: string) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = [
      headers.join(','),
      ...records.map(record => headers.map(h => escape(record[h])).join(',')),
    ].join('\r\n');

    const fileName = `mailing-labels-${new Date().toISOString().split('T')[0]}.csv`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);

    warnIfIncomplete();
    toast({
      title: 'CSV exported',
      description: `${exportRows.length} rows written to ${fileName}.`,
    });
  };

  const handleCopyAddresses = async () => {
    if (exportRows.length === 0) return;
    const text = exportRows
      .map(row =>
        [
          nameFormat === 'office' ? row.officeName : row.contactName,
          row.address1,
          row.address2,
          `${row.city}${row.city && row.state ? ', ' : ''}${row.state} ${row.zip}`.trim(),
        ]
          .filter(Boolean)
          .join('\n'),
      )
      .join('\n\n');

    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copied', description: `${exportRows.length} addresses on the clipboard.` });
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Your browser blocked clipboard access.',
        variant: 'destructive',
      });
    }
  };

  const handleQuickPdf = async () => {
    if (printQueue.length === 0) return;
    try {
      const filename = `mailing-labels-${templateKey}-${new Date().toISOString().split('T')[0]}.pdf`;
      await downloadLabelsPDF(
        printQueue,
        templateKey,
        {
          showLogo: customization.showLogo,
          logoUrl: customization.logoUrl,
          logoSizeMultiplier: customization.logoSizeMultiplier,
          showReturnAddress: customization.showReturnAddress,
          returnAddress: customization.returnAddress,
          showFromLabel: customization.showFromLabel,
          showToLabel: customization.showToLabel,
          showBranding: customization.showBranding,
          brandingText: customization.brandingText,
          fontSizeMultiplier: customization.fontSizeMultiplier,
          fromFontSizeMultiplier: customization.fromFontSizeMultiplier,
          lineSpacing: customization.lineSpacing,
          toAlignment: customization.toAlignment,
          fromPosition: customization.fromPosition,
          layoutMode: customization.layoutMode,
        },
        filename,
      );
      warnIfIncomplete();
      toast({
        title: 'PDF downloaded',
        description: `${labelData.length} labels × ${copies} on ${sheetsNeeded} sheet${sheetsNeeded === 1 ? '' : 's'} (${template.name}).`,
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: 'PDF generation failed',
        description: 'There was an error generating the PDF. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleCorrectAddresses = async () => {
    const partnerIdsInView = exportRows
      .filter(row => row.source === 'partner')
      .map(row => row.id.replace('partner:', ''));

    if (partnerIdsInView.length === 0) {
      toast({
        title: 'Nothing to fix',
        description:
          offices.length === 0
            ? "You don't have any partner offices yet. Add them from the Offices page first."
            : 'No partner offices are selected. Address lookup only covers partner offices.',
        variant: 'destructive',
      });
      return;
    }

    setIsCorrecting(true);
    setCorrectionProgress(15);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data: result, error: fnError } = await supabase.functions.invoke(
        'correct-office-addresses',
        {
          body: { officeIds: partnerIdsInView },
          headers: { Authorization: `Bearer ${session.access_token}` },
        },
      );

      if (fnError) throw new Error(fnError.message || 'Address correction failed');

      const resultsWithNames = (result.results ?? []).map((r: any) => ({
        ...r,
        officeName: offices.find(o => o.id === r.id)?.name || 'Unknown Office',
      }));

      setCorrectionResults(resultsWithNames);
      setCorrectionProgress(100);
      setShowCorrectionDialog(true);

      toast({
        title: 'Lookup complete',
        description: `${result.needsUpdate} address${result.needsUpdate === 1 ? '' : 'es'} can be improved.`,
      });
    } catch (error) {
      console.error('Address correction error:', error);
      toast({
        title: 'Correction failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsCorrecting(false);
    }
  };

  const handleApplyCorrections = async (idsToApply: string[]) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const updates = correctionResults
        .filter(r => idsToApply.includes(r.id))
        .map(r => ({ id: r.id, address: r.corrected }));

      const { data: result, error: fnError } = await supabase.functions.invoke(
        'apply-address-corrections',
        {
          body: { updates },
          headers: { Authorization: `Bearer ${session.access_token}` },
        },
      );

      if (fnError) throw new Error(fnError.message || 'Failed to apply corrections');

      toast({
        title: 'Addresses updated',
        description: `Updated ${result.updated} of ${result.total} addresses.`,
      });

      // Refetch in place — a full page reload would throw away selection and edits.
      await queryClient.invalidateQueries({ queryKey: ['offices'] });
    } catch (error) {
      console.error('Apply corrections error:', error);
      toast({
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const nothingSelected = exportRows.length === 0;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {hasSelectedIds && (
          <Alert className="bg-primary/10 border-primary/20">
            <MapPin className="h-4 w-4" />
            <AlertTitle>Viewing {selectedIds.length} selected offices</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>Creating labels for the offices you picked on the Offices page.</span>
              <Link to="/offices">
                <Button variant="outline" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Offices
                </Button>
              </Link>
            </AlertDescription>
          </Alert>
        )}

        {/* Summary strip — the numbers that decide how much label stock to load. */}
        <Card>
          <CardContent className="p-0">
            <div className="flex flex-wrap items-center divide-x divide-border">
              <Stat value={isLoading ? '—' : exportRows.length} label="Labels selected" />
              {copies > 1 && <Stat value={totalSlots - startOffset} label={`Prints (${copies}× each)`} />}
              <Stat value={sheetsNeeded} label={`Sheet${sheetsNeeded === 1 ? '' : 's'} of ${template.name.split(' (')[0]}`} />
              <Stat value={blanksOnLastSheet} label="Unused on last sheet" />
              {incompleteSelected > 0 && (
                <Stat
                  value={incompleteSelected}
                  label="Incomplete addresses"
                  tone="warning"
                  icon={<AlertTriangle className="h-5 w-5" />}
                />
              )}
              <div className="flex-1 min-w-[240px] flex flex-wrap justify-end gap-2 p-3">
                <Button
                  onClick={() => setShowPreview(true)}
                  disabled={isLoading || nothingSelected}
                  className="gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Preview &amp; print
                </Button>
                <Button
                  onClick={handleQuickPdf}
                  disabled={isLoading || nothingSelected}
                  variant="secondary"
                  className="gap-2"
                >
                  <FileDown className="h-4 w-4" />
                  Download PDF
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" disabled={isLoading || nothingSelected} className="gap-2">
                      <Download className="h-4 w-4" />
                      Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleExportToExcel}>Excel (.xlsx)</DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportToCsv}>CSV (.csv)</DropdownMenuItem>
                    <DropdownMenuItem onClick={handleCopyAddresses}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy to clipboard
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Who gets a label */}
        {!hasSelectedIds && (
          <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/30 rounded-lg border">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search offices…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 h-9"
              />
            </div>

            <Select
              value={sourceFilter}
              onValueChange={(value: SourceFilter) => {
                setSourceFilter(value);
                if (value !== 'group') setSelectedGroupId(null);
              }}
            >
              <SelectTrigger className="w-[170px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All offices</SelectItem>
                <SelectItem value="partner">Partner only</SelectItem>
                <SelectItem value="discovered">Discovered only</SelectItem>
                <SelectItem value="group">
                  <span className="flex items-center gap-1.5">
                    <FolderOpen className="h-3 w-3" /> By group
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>

            {sourceFilter === 'group' && (
              <Select value={selectedGroupId || ''} onValueChange={val => setSelectedGroupId(val || null)}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="Select group…" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map(g => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name} ({g.member_count || 0})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {(sourceFilter === 'all' || sourceFilter === 'partner') && (
              <div className="flex items-center gap-2">
                {TIERS.map(tier => (
                  <div key={tier} className="flex items-center gap-1.5">
                    <Checkbox
                      id={`tier-${tier}`}
                      checked={selectedTiers.includes(tier)}
                      onCheckedChange={() => toggleTier(tier)}
                      className="h-4 w-4"
                    />
                    <label htmlFor={`tier-${tier}`} className="text-xs cursor-pointer">
                      {tier}
                    </label>
                  </div>
                ))}
              </div>
            )}

            {sourceFilter === 'all' && (
              <div className="flex items-center gap-1.5">
                <Checkbox
                  id="include-discovered"
                  checked={includeDiscovered}
                  onCheckedChange={checked => setIncludeDiscovered(checked as boolean)}
                  className="h-4 w-4"
                />
                <label htmlFor="include-discovered" className="text-xs cursor-pointer">
                  Include discovered
                </label>
              </div>
            )}

            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-muted-foreground">
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>

            <Tooltip>
              <TooltipTrigger asChild>
                <span className="ml-auto">
                  <Button
                    onClick={handleCorrectAddresses}
                    disabled={isCorrecting || officesLoading}
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                  >
                    {isCorrecting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Looking up…
                      </>
                    ) : (
                      <>
                        <MapPin className="w-3.5 h-3.5" />
                        Fix addresses
                      </>
                    )}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Re-checks selected partner-office addresses against Google Maps and lets you review each change.
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {isCorrecting && (
          <div className="flex items-center gap-3 px-3">
            <span className="text-sm text-muted-foreground">Checking addresses…</span>
            <Progress value={correctionProgress} className="flex-1 h-2" />
          </div>
        )}

        {/* Print setup */}
        <div className="flex flex-wrap items-end gap-4 p-3 bg-muted/30 rounded-lg border">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Label sheet</Label>
            <Select value={templateKey} onValueChange={handleTemplateChange}>
              <SelectTrigger className="w-[260px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(AVERY_TEMPLATES).map(([key, tmpl]) => (
                  <SelectItem key={key} value={key}>
                    {tmpl.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Name on label</Label>
            <Select
              value={nameFormat}
              onValueChange={(value: LabelNameFormat) => updateSettings({ nameFormat: value })}
            >
              <SelectTrigger className="w-[170px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="office">Office name</SelectItem>
                <SelectItem value="contact">Contact name (Dr.)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="copies" className="text-xs text-muted-foreground">
              Copies each
            </Label>
            <Input
              id="copies"
              type="number"
              min={1}
              max={20}
              value={copies}
              onChange={e =>
                updateSettings({
                  copies: Math.min(20, Math.max(1, Number(e.target.value) || 1)),
                })
              }
              className="w-[90px] h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Label
                  htmlFor="start-offset"
                  className="text-xs text-muted-foreground underline decoration-dotted underline-offset-4 cursor-help"
                >
                  Skip first
                </Label>
              </TooltipTrigger>
              <TooltipContent>
                Leaves the first N slots blank so you can reuse a partly peeled sheet.
              </TooltipContent>
            </Tooltip>
            <Input
              id="start-offset"
              type="number"
              min={0}
              max={labelsPerSheet - 1}
              value={startOffset}
              onChange={e =>
                updateSettings({
                  startOffset: Math.min(
                    labelsPerSheet - 1,
                    Math.max(0, Number(e.target.value) || 0),
                  ),
                })
              }
              className="w-[90px] h-9"
            />
          </div>

          <Button variant="outline" onClick={() => setShowCustomization(true)} className="gap-2 h-9">
            <Settings2 className="h-4 w-4" />
            Logo &amp; return address
          </Button>

          {(customization.showLogo || customization.showReturnAddress || customization.showBranding) && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
              {[
                customization.showLogo && customization.logoUrl && 'logo',
                customization.showReturnAddress && customization.returnAddress && 'return address',
                customization.showBranding && customization.brandingText && 'footer',
              ]
                .filter(Boolean)
                .join(', ') || 'nothing added yet'}
            </div>
          )}
        </div>

        {/* Row table */}
        <Card>
          <CardContent className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-b">
              <div className="flex items-center gap-2 flex-wrap text-sm">
                <span className="font-medium">
                  {exportRows.length} of {rows.length} selected
                </span>
                {excludedCount > 0 && (
                  <span className="text-muted-foreground">({excludedCount} left out)</span>
                )}
                <Separator orientation="vertical" className="h-4" />
                <Button
                  variant={issueView === 'all' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7"
                  onClick={() => setIssueView('all')}
                >
                  All
                </Button>
                {incompleteCount > 0 && (
                  <Button
                    variant={issueView === 'incomplete' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-7 gap-1.5"
                    onClick={() => setIssueView(issueView === 'incomplete' ? 'all' : 'incomplete')}
                  >
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                    Incomplete ({incompleteCount})
                  </Button>
                )}
                {duplicateCount > 0 && (
                  <Button
                    variant={issueView === 'duplicates' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-7 gap-1.5"
                    onClick={() => setIssueView(issueView === 'duplicates' ? 'all' : 'duplicates')}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Duplicates ({duplicateCount})
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {duplicateCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Checkbox
                      id="hide-duplicates"
                      checked={hideDuplicates}
                      onCheckedChange={checked => setHideDuplicates(checked as boolean)}
                      className="h-4 w-4"
                    />
                    <label htmlFor="hide-duplicates" className="text-xs cursor-pointer">
                      Skip duplicates
                    </label>
                  </div>
                )}
                <Select value={sortKey} onValueChange={(value: SortKey) => setSortKey(value)}>
                  <SelectTrigger className="w-[150px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SORT_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        Sort: {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {hasEdits && (
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground" onClick={resetEdits}>
                    <RotateCcw className="h-3.5 w-3.5" />
                    Undo edits
                  </Button>
                )}
              </div>
            </div>

            {issueView !== 'all' && (
              <div className="px-3 py-2 text-xs text-muted-foreground bg-amber-500/10 border-b">
                Filtered view — your export still includes all {exportRows.length} selected labels.
              </div>
            )}

            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading offices…</div>
            ) : visibleRows.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <p className="text-muted-foreground">
                  {rows.length === 0
                    ? 'No offices match your filters.'
                    : 'No rows in this view.'}
                </p>
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Reset filters
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
                <Table>
                  <TableHeader className="bg-muted/50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="w-[44px]">
                        <Checkbox
                          checked={allVisibleSelected}
                          onCheckedChange={toggleAllVisible}
                          aria-label="Select all visible rows"
                        />
                      </TableHead>
                      <TableHead className="w-[36px]" />
                      <TableHead className="min-w-[200px]">
                        Office name
                        {nameFormat === 'office' && (
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            on label
                          </Badge>
                        )}
                      </TableHead>
                      <TableHead className="min-w-[170px]">
                        Contact name
                        {nameFormat === 'contact' && (
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            on label
                          </Badge>
                        )}
                      </TableHead>
                      <TableHead className="min-w-[190px]">Address 1</TableHead>
                      <TableHead className="min-w-[120px]">Address 2</TableHead>
                      <TableHead className="min-w-[130px]">City</TableHead>
                      <TableHead className="min-w-[70px]">State</TableHead>
                      <TableHead className="min-w-[90px]">ZIP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleRows.map(row => {
                      const isExcluded =
                        excludedIds.has(row.id) || (hideDuplicates && row.isDuplicate);
                      const missing = missingFields(row);

                      return (
                        <TableRow
                          key={row.id}
                          className={isExcluded ? 'opacity-45' : undefined}
                        >
                          <TableCell>
                            <Checkbox
                              checked={!isExcluded}
                              disabled={hideDuplicates && row.isDuplicate}
                              onCheckedChange={() => toggleRow(row.id)}
                              aria-label={`Include ${row.officeName}`}
                            />
                          </TableCell>
                          <TableCell className="px-1">
                            <div className="flex items-center gap-1">
                              {row.incomplete && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                                  </TooltipTrigger>
                                  <TooltipContent>Missing {missing.join(', ')}</TooltipContent>
                                </Tooltip>
                              )}
                              {row.isDuplicate && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Copy className="h-4 w-4 text-muted-foreground shrink-0" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Already listed above — {hideDuplicates ? 'skipped' : 'will print twice'}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="p-1">
                            <InlineEditCell
                              value={row.officeName}
                              onChange={val => handleCellEdit(row.id, 'officeName', val)}
                              className="font-medium"
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <InlineEditCell
                              value={row.contactName}
                              onChange={val => handleCellEdit(row.id, 'contactName', val)}
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <InlineEditCell
                              value={row.address1}
                              invalid={!row.address1}
                              onChange={val => handleCellEdit(row.id, 'address1', val)}
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <InlineEditCell
                              value={row.address2}
                              onChange={val => handleCellEdit(row.id, 'address2', val)}
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <InlineEditCell
                              value={row.city}
                              invalid={!row.city}
                              onChange={val => handleCellEdit(row.id, 'city', val)}
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <InlineEditCell
                              value={row.state}
                              invalid={!row.state}
                              onChange={val => handleCellEdit(row.id, 'state', val)}
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <InlineEditCell
                              value={row.zip}
                              invalid={!row.zip}
                              onChange={val => handleCellEdit(row.id, 'zip', val)}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="px-3 py-2 text-xs text-muted-foreground border-t">
              Click any cell to edit it — changes apply to this export only and never touch the
              office record.
            </div>
          </CardContent>
        </Card>

        <AddressCorrectionDialog
          open={showCorrectionDialog}
          onOpenChange={setShowCorrectionDialog}
          corrections={correctionResults}
          onConfirm={handleApplyCorrections}
        />

        <LabelCustomizationDialog
          open={showCustomization}
          onOpenChange={setShowCustomization}
          customization={customization}
          onSave={value => updateSettings({ customization: value })}
          templateDimensions={{ width: template.width, height: template.height }}
        />

        <MailingLabelPreview
          open={showPreview}
          onOpenChange={setShowPreview}
          data={printQueue}
          templateKey={templateKey}
          onTemplateChange={handleTemplateChange}
          customization={customization}
          onCustomizationChange={value => updateSettings({ customization: value })}
        />
      </div>
    </TooltipProvider>
  );
}
