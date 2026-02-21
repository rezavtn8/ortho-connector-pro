import React, { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Activity,
  Search,
  FileText,
  TrendingUp,
  TrendingDown,
  Edit3,
  Plus,
  Trash2,
  Tag,
  Upload,
  MapPin,
  CheckCircle,
  Mail,
  Gift,
  Send,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Phone,
  Star
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type LogCategory = 'all' | 'sources' | 'patients' | 'marketing' | 'campaigns' | 'discovery' | 'interactions';

interface UnifiedLog {
  id: string;
  timestamp: string;
  category: LogCategory;
  icon: React.ReactNode;
  description: string;
  resourceName?: string;
}

const PAGE_SIZE = 50;

export function Logs() {
  const [allLogs, setAllLogs] = useState<UnifiedLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<LogCategory>('all');
  const [page, setPage] = useState(0);
  const { toast } = useToast();

  useEffect(() => { loadLogs(); }, []);

  const loadLogs = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const [activityRes, patientRes, visitsRes, campaignsRes, deliveriesRes, discoveryRes, interactionsRes] = await Promise.all([
        supabase.from('activity_log').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(500),
        supabase.from('patient_changes_log').select('*, patient_sources(name)').eq('user_id', user.id).order('changed_at', { ascending: false }).limit(500),
        supabase.from('marketing_visits').select('*, patient_sources!marketing_visits_office_id_fkey(name)').eq('user_id', user.id).order('visit_date', { ascending: false }).limit(500),
        supabase.from('campaigns').select('*').eq('created_by', user.id).order('created_at', { ascending: false }).limit(200),
        supabase.from('campaign_deliveries').select('*, campaigns(name), patient_sources!campaign_deliveries_office_id_fkey(name)').eq('created_by', user.id).order('created_at', { ascending: false }).limit(500),
        supabase.from('discovery_sessions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(200),
        supabase.from('office_interactions').select('*, patient_sources!office_interactions_office_id_fkey(name)').eq('user_id', user.id).order('occurred_at', { ascending: false }).limit(500),
      ]);

      const logs: UnifiedLog[] = [];

      // Activity logs
      (activityRes.data || []).forEach(log => {
        logs.push({
          id: `act-${log.id}`,
          timestamp: log.created_at,
          category: 'sources',
          icon: getActivityIcon(log.action_type),
          description: formatActivityDescription(log),
          resourceName: log.resource_name || undefined,
        });
      });

      // Patient changes
      (patientRes.data || []).forEach(log => {
        const sourceName = (log as any).patient_sources?.name || '[Deleted Source]';
        const diff = (log.new_count || 0) - (log.old_count || 0);
        const monthYear = safeFormatMonth(log.year_month);
        let desc: string;
        if (diff > 0) desc = `Increased patient count for "${sourceName}" (${monthYear}) from ${log.old_count} to ${log.new_count}`;
        else if (diff < 0) desc = `Decreased patient count for "${sourceName}" (${monthYear}) from ${log.old_count} to ${log.new_count}`;
        else desc = `Updated patient count for "${sourceName}" (${monthYear}) to ${log.new_count}`;

        logs.push({
          id: `pat-${log.id}`,
          timestamp: log.changed_at || log.id,
          category: 'patients',
          icon: diff > 0 ? <TrendingUp className="w-4 h-4 text-green-600" /> : diff < 0 ? <TrendingDown className="w-4 h-4 text-red-600" /> : <Edit3 className="w-4 h-4 text-blue-600" />,
          description: desc,
          resourceName: sourceName,
        });
      });

      // Marketing visits
      (visitsRes.data || []).forEach(log => {
        const officeName = (log as any).patient_sources?.name || '[Unknown Office]';
        const visitDate = format(new Date(log.visit_date), 'MMM d, yyyy');
        const desc = log.visited
          ? `Visited "${officeName}" on ${visitDate} — ${log.visit_type}${log.star_rating ? ` (${log.star_rating}★)` : ''}`
          : `Scheduled ${log.visit_type} visit to "${officeName}" for ${visitDate}`;

        logs.push({
          id: `vis-${log.id}`,
          timestamp: log.created_at,
          category: 'marketing',
          icon: log.visited ? <CheckCircle className="w-4 h-4 text-green-600" /> : <MapPin className="w-4 h-4 text-blue-600" />,
          description: desc,
          resourceName: officeName,
        });
      });

      // Campaigns
      (campaignsRes.data || []).forEach(log => {
        logs.push({
          id: `cam-${log.id}`,
          timestamp: log.created_at,
          category: 'campaigns',
          icon: <Send className="w-4 h-4 text-primary" />,
          description: `Created campaign "${log.name}" (${log.campaign_type}, ${log.delivery_method})`,
          resourceName: log.name,
        });
      });

      // Campaign deliveries
      (deliveriesRes.data || []).forEach(log => {
        const campaignName = (log as any).campaigns?.name || '[Unknown Campaign]';
        const officeName = (log as any).patient_sources?.name || '[Unknown Office]';
        const mode = log.action_mode || 'delivery';
        const icon = mode === 'email' ? <Mail className="w-4 h-4 text-blue-600" /> : mode === 'gift' ? <Gift className="w-4 h-4 text-pink-600" /> : <Send className="w-4 h-4 text-green-600" />;
        logs.push({
          id: `del-${log.id}`,
          timestamp: log.created_at,
          category: 'campaigns',
          icon,
          description: `${log.delivery_status} delivery to "${officeName}" for campaign "${campaignName}"`,
          resourceName: officeName,
        });
      });

      // Discovery sessions
      (discoveryRes.data || []).forEach(log => {
        logs.push({
          id: `dis-${log.id}`,
          timestamp: log.created_at,
          category: 'discovery',
          icon: <Search className="w-4 h-4 text-indigo-600" />,
          description: `Searched for offices within ${log.search_distance} miles — found ${log.results_count || 0} results${log.cache_hit ? ' (cached)' : ''}`,
        });
      });

      // Office interactions
      (interactionsRes.data || []).forEach(log => {
        const officeName = (log as any).patient_sources?.name || '[Unknown Office]';
        const icon = log.interaction_type === 'call' ? <Phone className="w-4 h-4 text-green-600" />
          : log.interaction_type === 'note' ? <MessageSquare className="w-4 h-4 text-blue-600" />
          : <Star className="w-4 h-4 text-yellow-600" />;
        logs.push({
          id: `int-${log.id}`,
          timestamp: log.occurred_at || log.created_at || '',
          category: 'interactions',
          icon,
          description: `${log.interaction_type}: "${log.title}" for "${officeName}"`,
          resourceName: officeName,
        });
      });

      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setAllLogs(logs);
      setPage(0);
    } catch (error) {
      console.error('Error loading logs:', error);
      toast({ title: "Error", description: "Failed to load activity logs", variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filteredLogs = useMemo(() => {
    let filtered = allLogs;

    if (activeTab !== 'all') {
      filtered = filtered.filter(l => l.category === activeTab);
    }

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      filtered = filtered.filter(l =>
        l.description.toLowerCase().includes(s) ||
        l.resourceName?.toLowerCase().includes(s)
      );
    }

    if (dateFilter !== 'all') {
      const now = new Date();
      let cutoff = new Date();
      if (dateFilter === 'today') cutoff.setHours(0, 0, 0, 0);
      else if (dateFilter === 'week') cutoff.setDate(now.getDate() - 7);
      else if (dateFilter === 'month') cutoff.setMonth(now.getMonth() - 1);
      filtered = filtered.filter(l => new Date(l.timestamp) >= cutoff);
    }

    return filtered;
  }, [allLogs, activeTab, searchTerm, dateFilter]);

  const totalPages = Math.ceil(filteredLogs.length / PAGE_SIZE);
  const paginatedLogs = filteredLogs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allLogs.length, sources: 0, patients: 0, marketing: 0, campaigns: 0, discovery: 0, interactions: 0 };
    allLogs.forEach(l => { counts[l.category] = (counts[l.category] || 0) + 1; });
    return counts;
  }, [allLogs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3 text-muted-foreground">Loading activity logs...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Activity Log</h2>
          <p className="text-xs text-muted-foreground">{allLogs.length} total activities across all categories</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => loadLogs(true)} disabled={refreshing} className="h-8 gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-1.5">
        {[
          { key: 'sources', label: 'Sources', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
          { key: 'patients', label: 'Patient Data', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
          { key: 'marketing', label: 'Visits', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
          { key: 'campaigns', label: 'Campaigns', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
          { key: 'discovery', label: 'Discovery', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' },
          { key: 'interactions', label: 'Interactions', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
        ].map(c => (
          <span key={c.key} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.color}`}>
            {c.label}: {categoryCounts[c.key] || 0}
          </span>
        ))}
      </div>

      {/* Category Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as LogCategory); setPage(0); }}>
        <TabsList className="h-8">
          <TabsTrigger value="all" className="text-xs px-3 h-7">All</TabsTrigger>
          <TabsTrigger value="sources" className="text-xs px-3 h-7">Sources</TabsTrigger>
          <TabsTrigger value="patients" className="text-xs px-3 h-7">Patient Data</TabsTrigger>
          <TabsTrigger value="marketing" className="text-xs px-3 h-7">Marketing</TabsTrigger>
          <TabsTrigger value="campaigns" className="text-xs px-3 h-7">Campaigns</TabsTrigger>
          <TabsTrigger value="discovery" className="text-xs px-3 h-7">Discovery</TabsTrigger>
          <TabsTrigger value="interactions" className="text-xs px-3 h-7">Interactions</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <Select value={dateFilter} onValueChange={(v) => { setDateFilter(v); setPage(0); }}>
          <SelectTrigger className="h-8 w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">7 Days</SelectItem>
            <SelectItem value="month">30 Days</SelectItem>
          </SelectContent>
        </Select>
        {(searchTerm || dateFilter !== 'all') && (
          <Button variant="ghost" size="sm" onClick={() => { setSearchTerm(''); setDateFilter('all'); setPage(0); }} className="h-8 text-xs">
            Clear
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {filteredLogs.length} result{filteredLogs.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="border rounded-lg bg-card overflow-hidden">
        {paginatedLogs.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground">
              {allLogs.length === 0 ? "No activity logs found" : "No activities match your filters"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-2.5 py-2 text-left font-medium text-muted-foreground w-24">Date</th>
                  <th className="px-2.5 py-2 text-left font-medium text-muted-foreground w-16">Time</th>
                  <th className="px-2.5 py-2 text-center font-medium text-muted-foreground w-10"></th>
                  <th className="px-2.5 py-2 text-left font-medium text-muted-foreground w-24">Category</th>
                  <th className="px-2.5 py-2 text-left font-medium text-muted-foreground">Description</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLogs.map((log, index) => (
                  <tr
                    key={log.id}
                    className={`border-b hover:bg-muted/30 transition-colors ${index % 2 === 0 ? 'bg-background' : 'bg-muted/10'}`}
                  >
                    <td className="px-2.5 py-1.5 font-mono text-xs">
                      {safeFormat(log.timestamp, 'MM/dd/yy')}
                    </td>
                    <td className="px-2.5 py-1.5 font-mono text-xs text-muted-foreground">
                      {safeFormat(log.timestamp, 'HH:mm')}
                    </td>
                    <td className="px-2.5 py-1.5 text-center">
                      <div className="flex items-center justify-center">{log.icon}</div>
                    </td>
                    <td className="px-2.5 py-1.5">
                      <CategoryBadge category={log.category} />
                    </td>
                    <td className="px-2.5 py-1.5 text-muted-foreground max-w-md truncate">
                      {log.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredLogs.length)} of {filteredLogs.length}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="h-7 px-2">
              <ChevronLeft className="w-3.5 h-3.5" /> Prev
            </Button>
            <span className="px-2">Page {page + 1} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="h-7 px-2">
              Next <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Helpers ---

function safeFormat(timestamp: string, fmt: string): string {
  try {
    return format(new Date(timestamp), fmt);
  } catch {
    return '—';
  }
}

function safeFormatMonth(yearMonth: string): string {
  try {
    return format(new Date(yearMonth + '-01'), 'MMM yyyy');
  } catch {
    return yearMonth;
  }
}

function CategoryBadge({ category }: { category: LogCategory }) {
  const map: Record<string, { label: string; className: string }> = {
    sources: { label: 'Source', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
    patients: { label: 'Patient', className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
    marketing: { label: 'Visit', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
    campaigns: { label: 'Campaign', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
    discovery: { label: 'Discovery', className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' },
    interactions: { label: 'Interaction', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
  };
  const m = map[category] || { label: category, className: 'bg-muted text-muted-foreground' };
  return <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${m.className}`}>{m.label}</span>;
}

function getActivityIcon(actionType: string): React.ReactNode {
  switch (actionType) {
    case 'source_created': return <Plus className="w-4 h-4 text-green-600" />;
    case 'source_deleted': return <Trash2 className="w-4 h-4 text-red-600" />;
    case 'source_updated': case 'patient_count_updated': case 'patient_count_increased': case 'patient_count_decreased':
      return <Edit3 className="w-4 h-4 text-blue-600" />;
    case 'tag_added': return <Tag className="w-4 h-4 text-purple-600" />;
    case 'tag_removed': return <Trash2 className="w-4 h-4 text-red-600" />;
    case 'import_completed': return <Upload className="w-4 h-4 text-purple-600" />;
    default: return <Activity className="w-4 h-4 text-muted-foreground" />;
  }
}

function formatActivityDescription(log: any): string {
  const details = log.details || {};
  switch (log.action_type) {
    case 'source_created':
      if (details.method === 'import_discovered') return `Added "${log.resource_name}" from discovered offices`;
      if (details.method?.includes('import_csv')) return `Imported "${log.resource_name}" from CSV`;
      return `Created source "${log.resource_name}"`;
    case 'source_deleted':
      return `Deleted source "${log.resource_name}"${details.total_deleted > 1 ? ` (${details.total_deleted} total)` : ''}`;
    case 'source_updated': {
      const fields = Object.entries(details.updated_fields || {}).filter(([_, v]) => v).map(([k]) => k);
      return `Updated ${fields.length ? fields.join(', ') : 'details'} for "${log.resource_name}"`;
    }
    case 'tag_added': return `Added tag "${log.resource_name}" to ${details.source_name || 'office'}`;
    case 'tag_removed': return `Removed tag from ${details.source_name || 'office'}`;
    case 'patient_count_increased': return `Increased patients for "${log.resource_name}" by ${details.change} (${details.year_month})`;
    case 'patient_count_decreased': return `Decreased patients for "${log.resource_name}" by ${Math.abs(details.change)} (${details.year_month})`;
    case 'patient_count_updated': return `Set patients for "${log.resource_name}" to ${details.new_count} (${details.year_month})`;
    case 'import_completed': return `Imported ${details.count || ''} records${log.resource_name ? ` including "${log.resource_name}"` : ''}`;
    default: return `${log.action_type.replace(/_/g, ' ')} ${log.resource_name || log.resource_type || ''}`;
  }
}
