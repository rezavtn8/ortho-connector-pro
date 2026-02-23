import React, { useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  SOURCE_TYPE_CONFIG,
  SourceType,
  formatYearMonth
} from '@/lib/database.types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  Download,
  BarChart3,
  PieChart as PieChartIcon,
  Building2,
  ArrowUp,
  ArrowDown,
  Minus,
  Target,
  FileText,
  Megaphone,
  ArrowUpDown,
  CheckCircle2,
  Clock,
  MapPin
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Area,
  AreaChart,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { format, subMonths } from 'date-fns';
import jsPDF from 'jspdf';

const CHART_COLORS = [
  'hsl(var(--primary))', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'
];

type SortField = 'name' | 'current' | 'prev' | 'change';
type SortDir = 'asc' | 'desc';
type SourceFilter = 'all' | 'growing' | 'declining' | 'stable';

export function Analytics() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState<'3m' | '6m' | '12m'>('6m');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [sortField, setSortField] = useState<SortField>('current');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Export controls
  const [exportPeriod, setExportPeriod] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [exportMonth, setExportMonth] = useState(format(new Date(), 'yyyy-MM'));

  const dateRange = useMemo(() => {
    const now = new Date();
    const months = selectedPeriod === '3m' ? 3 : selectedPeriod === '6m' ? 6 : 12;
    const start = new Date(now.getFullYear(), now.getMonth() - months, 1);
    const startYM = `${start.getFullYear()}-${(start.getMonth() + 1).toString().padStart(2, '0')}`;
    const endYM = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    const prevStart = new Date(start.getFullYear(), start.getMonth() - months, 1);
    const prevStartYM = `${prevStart.getFullYear()}-${(prevStart.getMonth() + 1).toString().padStart(2, '0')}`;
    const prevEndYM = `${start.getFullYear()}-${(start.getMonth()).toString().padStart(2, '0')}`;
    const startDate = `${startYM}-01`;
    return { startYM, endYM, prevStartYM, prevEndYM, startDate };
  }, [selectedPeriod]);

  const { data, isLoading } = useQuery({
    queryKey: ['analytics-unified', dateRange.startYM, dateRange.endYM, dateRange.prevStartYM],
    queryFn: async () => {
      const [sourcesRes, currentRes, prevRes, visitsRes, campaignsRes] = await Promise.all([
        supabase.from('patient_sources').select('*').eq('is_active', true),
        supabase.from('monthly_patients').select('*').gte('year_month', dateRange.startYM).lte('year_month', dateRange.endYM),
        supabase.from('monthly_patients').select('*').gte('year_month', dateRange.prevStartYM).lte('year_month', dateRange.prevEndYM),
        supabase.from('marketing_visits').select('*, patient_sources!marketing_visits_office_id_fkey(name)').gte('visit_date', dateRange.startDate).order('visit_date', { ascending: false }),
        supabase.from('campaigns').select('*').order('created_at', { ascending: false }),
      ]);
      return {
        sources: sourcesRes.data || [],
        currentMonthly: currentRes.data || [],
        prevMonthly: prevRes.data || [],
        visits: visitsRes.data || [],
        campaigns: campaignsRes.data || [],
      };
    },
    enabled: !!user,
  });

  const analytics = useMemo(() => {
    if (!data) return null;
    const { sources, currentMonthly, prevMonthly, visits, campaigns } = data;

    const totalPatients = currentMonthly.reduce((s, m) => s + m.patient_count, 0);
    const prevTotal = prevMonthly.reduce((s, m) => s + m.patient_count, 0);
    const changePercent = prevTotal > 0 ? Math.round(((totalPatients - prevTotal) / prevTotal) * 100) : 0;

    // Per-source breakdown
    const bySource = sources.map(src => {
      const current = currentMonthly.filter(m => m.source_id === src.id).reduce((s, m) => s + m.patient_count, 0);
      const prev = prevMonthly.filter(m => m.source_id === src.id).reduce((s, m) => s + m.patient_count, 0);
      const change = prev > 0 ? Math.round(((current - prev) / prev) * 100) : current > 0 ? 100 : 0;
      const trend: 'up' | 'down' | 'stable' = change > 0 ? 'up' : change < 0 ? 'down' : 'stable';
      return { ...src, current, prev, change, trend };
    }).filter(s => s.current > 0 || s.prev > 0);

    // Monthly trend
    const monthlyTotals: Record<string, number> = {};
    currentMonthly.forEach(m => {
      monthlyTotals[m.year_month] = (monthlyTotals[m.year_month] || 0) + m.patient_count;
    });
    const trendData = Object.entries(monthlyTotals)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month: formatYearMonth(month), count }));

    // Type distribution
    const byType: Record<string, number> = {};
    sources.forEach(src => {
      const count = currentMonthly.filter(m => m.source_id === src.id).reduce((s, m) => s + m.patient_count, 0);
      if (count > 0) byType[src.source_type] = (byType[src.source_type] || 0) + count;
    });
    const typeDistribution = Object.entries(byType).map(([type, value]) => ({
      name: SOURCE_TYPE_CONFIG[type as SourceType]?.label || type,
      value,
    }));

    // Outreach
    const totalVisits = visits.length;
    const completedVisits = visits.filter(v => v.visited).length;
    const uniqueOfficesVisited = new Set(visits.map(v => v.office_id)).size;
    const visitsByMonth: Record<string, number> = {};
    visits.forEach(v => {
      const ym = v.visit_date.substring(0, 7);
      visitsByMonth[ym] = (visitsByMonth[ym] || 0) + 1;
    });
    const visitTrendData = Object.entries(visitsByMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month: formatYearMonth(month), count }));

    const totalCampaigns = campaigns.length;
    const activeCampaigns = campaigns.filter(c => c.status === 'Active').length;
    const completedCampaigns = campaigns.filter(c => c.status === 'Completed').length;
    const draftCampaigns = campaigns.filter(c => c.status === 'Draft').length;

    const growingCount = bySource.filter(s => s.trend === 'up').length;
    const decliningCount = bySource.filter(s => s.trend === 'down').length;

    return {
      totalPatients, prevTotal, changePercent,
      bySource, trendData, typeDistribution,
      totalVisits, completedVisits, uniqueOfficesVisited, visitTrendData, visits,
      totalCampaigns, activeCampaigns, completedCampaigns, draftCampaigns, campaigns,
      growingCount, decliningCount,
      activeSources: bySource.filter(s => s.current > 0).length,
    };
  }, [data]);

  // Sorted & filtered sources
  const sortedSources = useMemo(() => {
    if (!analytics) return [];
    let filtered = analytics.bySource;
    if (sourceFilter === 'growing') filtered = filtered.filter(s => s.trend === 'up');
    else if (sourceFilter === 'declining') filtered = filtered.filter(s => s.trend === 'down');
    else if (sourceFilter === 'stable') filtered = filtered.filter(s => s.trend === 'stable');

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortField === 'current') cmp = a.current - b.current;
      else if (sortField === 'prev') cmp = a.prev - b.prev;
      else if (sortField === 'change') cmp = a.change - b.change;
      return sortDir === 'desc' ? -cmp : cmp;
    });
  }, [analytics, sourceFilter, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  // Export month options
  const monthOptions = useMemo(() => {
    const months = [];
    for (let i = 0; i < 24; i++) {
      const d = subMonths(new Date(), i);
      months.push({ value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy') });
    }
    return months;
  }, []);

  const handleExportCSV = () => {
    if (!analytics || analytics.bySource.length === 0) return;
    const rows = analytics.bySource.map(s => ({
      Source: s.name, Type: s.source_type,
      'Current Period': s.current, 'Previous Period': s.prev, 'Change %': s.change,
    }));
    const csv = [Object.keys(rows[0]).join(','), ...rows.map(r => Object.values(r).map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `analytics-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast({ title: 'CSV Downloaded' });
  };

  const handleExportPDF = () => {
    if (!analytics) return;
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const margin = 15;
      let y = 20;

      pdf.setFontSize(18); pdf.setFont('helvetica', 'bold');
      pdf.text('Referral Performance Report', margin, y); y += 8;
      pdf.setFontSize(10); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(100);
      pdf.text(`Period: ${selectedPeriod === '3m' ? 'Last 3 Months' : selectedPeriod === '6m' ? 'Last 6 Months' : 'Last 12 Months'}`, margin, y); y += 5;
      pdf.text(`Generated: ${format(new Date(), 'MMMM d, yyyy')}`, margin, y); y += 10;
      pdf.setTextColor(0);

      pdf.setDrawColor(200); pdf.line(margin, y, 195, y); y += 8;

      pdf.setFontSize(13); pdf.setFont('helvetica', 'bold');
      pdf.text('Overview', margin, y); y += 7;
      pdf.setFontSize(10); pdf.setFont('helvetica', 'normal');
      const overview = [
        ['Total Patients', analytics.totalPatients.toString()],
        ['vs Previous Period', `${analytics.changePercent >= 0 ? '+' : ''}${analytics.changePercent}%`],
        ['Active Sources', analytics.activeSources.toString()],
        ['Growing', analytics.growingCount.toString()],
        ['Declining', analytics.decliningCount.toString()],
        ['Marketing Visits', analytics.totalVisits.toString()],
        ['Campaigns', analytics.totalCampaigns.toString()],
      ];
      overview.forEach(([l, v]) => {
        pdf.text(l, margin + 2, y); pdf.setFont('helvetica', 'bold');
        pdf.text(v, margin + 80, y); pdf.setFont('helvetica', 'normal'); y += 6;
      }); y += 4;

      pdf.setFontSize(13); pdf.setFont('helvetica', 'bold');
      pdf.text('Top Sources', margin, y); y += 7;
      pdf.setFontSize(9); pdf.setFont('helvetica', 'bold');
      pdf.text('Source', margin + 2, y); pdf.text('Current', 120, y); pdf.text('Change', 150, y);
      pdf.setFont('helvetica', 'normal'); y += 5;
      analytics.bySource.slice(0, 20).forEach(src => {
        if (y > 275) { pdf.addPage(); y = 20; }
        pdf.text(String(src.name).substring(0, 50), margin + 2, y);
        pdf.text(src.current.toString(), 120, y);
        pdf.text(`${src.change >= 0 ? '+' : ''}${src.change}%`, 150, y); y += 5;
      });

      pdf.save(`referral-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast({ title: 'PDF Downloaded' });
    } catch (err) {
      toast({ title: 'Export Failed', variant: 'destructive' });
    }
  };

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button onClick={() => toggleSort(field)} className="flex items-center gap-1 font-medium text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
      {children}
      <ArrowUpDown className={`h-3 w-3 ${sortField === field ? 'text-primary' : 'text-muted-foreground/50'}`} />
    </button>
  );

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (!analytics) {
    return <div className="text-center text-muted-foreground py-16">No analytics data available.</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <Select value={selectedPeriod} onValueChange={(v) => setSelectedPeriod(v as any)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-background border z-50">
            <SelectItem value="3m">Last 3 Months</SelectItem>
            <SelectItem value="6m">Last 6 Months</SelectItem>
            <SelectItem value="12m">Last 12 Months</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/50">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-primary/10"><Users className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold">{analytics.totalPatients.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Patients</p>
              </div>
            </div>
            <div className={`mt-2 text-xs font-medium flex items-center gap-1 ${analytics.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {analytics.changePercent >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
              {Math.abs(analytics.changePercent)}% vs previous
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-green-500/10"><TrendingUp className="h-5 w-5 text-green-600" /></div>
              <div>
                <p className="text-2xl font-bold">{analytics.growingCount}</p>
                <p className="text-xs text-muted-foreground">Growing Sources</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-red-500/10"><TrendingDown className="h-5 w-5 text-red-600" /></div>
              <div>
                <p className="text-2xl font-bold">{analytics.decliningCount}</p>
                <p className="text-xs text-muted-foreground">Declining Sources</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-500/10"><MapPin className="h-5 w-5 text-blue-600" /></div>
              <div>
                <p className="text-2xl font-bold">{analytics.totalVisits}</p>
                <p className="text-xs text-muted-foreground">Marketing Visits</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="overview" className="flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="sources" className="flex items-center gap-1.5">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Sources</span>
          </TabsTrigger>
          <TabsTrigger value="outreach" className="flex items-center gap-1.5">
            <Megaphone className="h-4 w-4" />
            <span className="hidden sm:inline">Outreach</span>
          </TabsTrigger>
          <TabsTrigger value="export" className="flex items-center gap-1.5">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </TabsTrigger>
        </TabsList>

        {/* ===== OVERVIEW TAB ===== */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Area chart */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Patient Trends</CardTitle>
                <CardDescription>Monthly patient volume over time</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics.trendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={analytics.trendData}>
                      <defs>
                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" className="text-xs" tick={{ fontSize: 11 }} />
                      <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
                      <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#areaGrad)" name="Patients" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">No trend data available</div>
                )}
              </CardContent>
            </Card>

            {/* Pie chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <PieChartIcon className="h-4 w-4" />
                  Distribution
                </CardTitle>
                <CardDescription>By source type</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics.typeDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsPieChart>
                      <Pie data={analytics.typeDistribution} cx="50%" cy="50%" innerRadius={45} outerRadius={85} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {analytics.typeDistribution.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">No data</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top 10 bar chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top 10 Sources</CardTitle>
              <CardDescription>Highest patient volume this period</CardDescription>
            </CardHeader>
            <CardContent>
              {analytics.bySource.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart
                    data={analytics.bySource.slice(0, 10).map(s => ({
                      name: s.name.length > 18 ? s.name.substring(0, 18) + '…' : s.name,
                      patients: s.current,
                    }))}
                    margin={{ top: 10, right: 20, left: 10, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" angle={-40} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
                    <Bar dataKey="patients" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12 text-muted-foreground text-sm">No source data</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== SOURCES TAB ===== */}
        <TabsContent value="sources" className="space-y-4">
          {/* Filter chips */}
          <div className="flex items-center gap-2 flex-wrap">
            {(['all', 'growing', 'declining', 'stable'] as SourceFilter[]).map(f => (
              <Button
                key={f}
                size="sm"
                variant={sourceFilter === f ? 'default' : 'outline'}
                onClick={() => setSourceFilter(f)}
                className="capitalize"
              >
                {f === 'growing' && <ArrowUp className="h-3 w-3 mr-1" />}
                {f === 'declining' && <ArrowDown className="h-3 w-3 mr-1" />}
                {f === 'stable' && <Minus className="h-3 w-3 mr-1" />}
                {f} ({f === 'all' ? analytics.bySource.length
                  : f === 'growing' ? analytics.growingCount
                  : f === 'declining' ? analytics.decliningCount
                  : analytics.bySource.filter(s => s.trend === 'stable').length})
              </Button>
            ))}
          </div>

          {/* Sortable table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-3"><SortHeader field="name">Source</SortHeader></th>
                      <th className="text-left p-3 font-medium text-xs uppercase tracking-wider text-muted-foreground">Type</th>
                      <th className="text-right p-3"><SortHeader field="current">Current</SortHeader></th>
                      <th className="text-right p-3"><SortHeader field="prev">Previous</SortHeader></th>
                      <th className="text-right p-3"><SortHeader field="change">Change</SortHeader></th>
                      <th className="text-center p-3 font-medium text-xs uppercase tracking-wider text-muted-foreground">Trend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {sortedSources.map(src => (
                      <tr key={src.id} className={`hover:bg-muted/20 transition-colors ${src.trend === 'up' ? 'bg-green-500/[0.03]' : src.trend === 'down' ? 'bg-red-500/[0.03]' : ''}`}>
                        <td className="p-3 font-medium">{src.name}</td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-xs gap-1">
                            <span>{SOURCE_TYPE_CONFIG[src.source_type as SourceType]?.icon}</span>
                            {SOURCE_TYPE_CONFIG[src.source_type as SourceType]?.label}
                          </Badge>
                        </td>
                        <td className="p-3 text-right font-semibold tabular-nums">{src.current}</td>
                        <td className="p-3 text-right text-muted-foreground tabular-nums">{src.prev}</td>
                        <td className="p-3 text-right">
                          <span className={`inline-flex items-center gap-0.5 font-semibold tabular-nums ${src.change > 0 ? 'text-green-600' : src.change < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                            {src.change > 0 ? '+' : ''}{src.change}%
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          {src.trend === 'up' && <ArrowUp className="h-4 w-4 text-green-600 mx-auto" />}
                          {src.trend === 'down' && <ArrowDown className="h-4 w-4 text-red-600 mx-auto" />}
                          {src.trend === 'stable' && <Minus className="h-4 w-4 text-muted-foreground mx-auto" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {sortedSources.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground text-sm">No sources match this filter</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== OUTREACH TAB ===== */}
        <TabsContent value="outreach" className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="border-border/50">
              <CardContent className="pt-4 pb-3 text-center">
                <Calendar className="h-5 w-5 mx-auto text-primary mb-1" />
                <p className="text-2xl font-bold">{analytics.totalVisits}</p>
                <p className="text-xs text-muted-foreground">Total Visits</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="pt-4 pb-3 text-center">
                <CheckCircle2 className="h-5 w-5 mx-auto text-green-600 mb-1" />
                <p className="text-2xl font-bold text-green-600">{analytics.completedVisits}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="pt-4 pb-3 text-center">
                <Building2 className="h-5 w-5 mx-auto text-blue-600 mb-1" />
                <p className="text-2xl font-bold">{analytics.uniqueOfficesVisited}</p>
                <p className="text-xs text-muted-foreground">Offices Visited</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="pt-4 pb-3 text-center">
                <Target className="h-5 w-5 mx-auto text-purple-600 mb-1" />
                <p className="text-2xl font-bold">{analytics.totalCampaigns}</p>
                <p className="text-xs text-muted-foreground">Campaigns</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="pt-4 pb-3 text-center">
                <Clock className="h-5 w-5 mx-auto text-amber-600 mb-1" />
                <p className="text-2xl font-bold">
                  {analytics.totalVisits > 0 ? Math.round((analytics.completedVisits / analytics.totalVisits) * 100) : 0}%
                </p>
                <p className="text-xs text-muted-foreground">Completion Rate</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Visit trend chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Visit Trend</CardTitle>
                <CardDescription>Marketing visits per month</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics.visitTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={analytics.visitTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
                      <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Visits" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No visit data yet</div>
                )}
              </CardContent>
            </Card>

            {/* Campaign breakdown */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Campaign Status</CardTitle>
                <CardDescription>Breakdown of all campaigns</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-3 rounded-lg bg-muted/30">
                    <p className="text-xl font-bold text-green-600">{analytics.completedCampaigns}</p>
                    <p className="text-xs text-muted-foreground">Completed</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/30">
                    <p className="text-xl font-bold text-blue-600">{analytics.activeCampaigns}</p>
                    <p className="text-xs text-muted-foreground">Active</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/30">
                    <p className="text-xl font-bold text-muted-foreground">{analytics.draftCampaigns}</p>
                    <p className="text-xs text-muted-foreground">Draft</p>
                  </div>
                </div>

                {analytics.campaigns.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {analytics.campaigns.slice(0, 8).map(c => (
                      <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/20 text-sm">
                        <span className="font-medium truncate max-w-[60%]">{c.name}</span>
                        <Badge variant={c.status === 'Active' ? 'default' : c.status === 'Completed' ? 'secondary' : 'outline'} className="text-xs">
                          {c.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground text-sm py-4">No campaigns yet</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent visits table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Recent Marketing Visits</CardTitle>
              <CardDescription>Latest visit activity</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-3 font-medium text-xs uppercase tracking-wider text-muted-foreground">Office</th>
                      <th className="text-left p-3 font-medium text-xs uppercase tracking-wider text-muted-foreground">Date</th>
                      <th className="text-left p-3 font-medium text-xs uppercase tracking-wider text-muted-foreground">Rep</th>
                      <th className="text-left p-3 font-medium text-xs uppercase tracking-wider text-muted-foreground">Type</th>
                      <th className="text-center p-3 font-medium text-xs uppercase tracking-wider text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {analytics.visits.slice(0, 15).map(v => (
                      <tr key={v.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-3 font-medium">{(v as any).patient_sources?.name || '—'}</td>
                        <td className="p-3 text-muted-foreground">{format(new Date(v.visit_date), 'MMM d, yyyy')}</td>
                        <td className="p-3">{v.rep_name}</td>
                        <td className="p-3"><Badge variant="outline" className="text-xs">{v.visit_type}</Badge></td>
                        <td className="p-3 text-center">
                          {v.visited
                            ? <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">Done</Badge>
                            : <Badge variant="outline" className="text-xs">Pending</Badge>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {analytics.visits.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground text-sm">No visits recorded yet</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== EXPORT TAB ===== */}
        <TabsContent value="export" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Export Report
              </CardTitle>
              <CardDescription>Download analytics data as PDF or CSV</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Period</label>
                  <Select value={exportPeriod} onValueChange={(v) => setExportPeriod(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-background border">
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">End Month</label>
                  <Select value={exportMonth} onValueChange={setExportMonth}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-background border">
                      {monthOptions.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Summary preview */}
              <div className="rounded-lg border p-4 bg-muted/20">
                <h3 className="text-sm font-semibold mb-3">Export Preview</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Total Patients:</span> <span className="font-semibold ml-1">{analytics.totalPatients}</span></div>
                  <div><span className="text-muted-foreground">Sources:</span> <span className="font-semibold ml-1">{analytics.activeSources}</span></div>
                  <div><span className="text-muted-foreground">Visits:</span> <span className="font-semibold ml-1">{analytics.totalVisits}</span></div>
                  <div><span className="text-muted-foreground">Campaigns:</span> <span className="font-semibold ml-1">{analytics.totalCampaigns}</span></div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={handleExportCSV} variant="outline" className="gap-2">
                  <Download className="h-4 w-4" /> Download CSV
                </Button>
                <Button onClick={handleExportPDF} className="gap-2">
                  <FileText className="h-4 w-4" /> Download PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default Analytics;
