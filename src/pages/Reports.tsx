import React, { useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { 
  Download, FileText, TrendingUp, TrendingDown, Users, Building2, 
  Calendar, Target, BarChart3, ArrowUp, ArrowDown, Minus,
  ChevronDown, ChevronUp, Printer
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
  AreaChart
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { format, subMonths, startOfMonth } from 'date-fns';
import { formatYearMonth, SOURCE_TYPE_CONFIG, SourceType } from '@/lib/database.types';
import jsPDF from 'jspdf';

type ReportPeriod = 'monthly' | 'quarterly' | 'yearly' | 'custom';
type ReportMonth = string; // YYYY-MM

const CHART_COLORS = ['hsl(var(--primary))', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

export function Reports({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const reportRef = useRef<HTMLDivElement>(null);
  const [period, setPeriod] = useState<ReportPeriod>('monthly');
  const [selectedMonth, setSelectedMonth] = useState<ReportMonth>(format(new Date(), 'yyyy-MM'));
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    overview: true,
    trends: true,
    topSources: true,
    campaigns: true,
    visits: true,
  });

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Calculate date range based on period
  const dateRange = useMemo(() => {
    const endDate = new Date(selectedMonth + '-01');
    endDate.setMonth(endDate.getMonth() + 1);
    let startDate: Date;
    let label: string;

    switch (period) {
      case 'monthly':
        startDate = new Date(selectedMonth + '-01');
        label = format(startDate, 'MMMM yyyy');
        break;
      case 'quarterly':
        startDate = subMonths(new Date(selectedMonth + '-01'), 2);
        label = `${format(startDate, 'MMM yyyy')} – ${format(new Date(selectedMonth + '-01'), 'MMM yyyy')}`;
        break;
      case 'yearly':
        startDate = subMonths(new Date(selectedMonth + '-01'), 11);
        label = `${format(startDate, 'MMM yyyy')} – ${format(new Date(selectedMonth + '-01'), 'MMM yyyy')}`;
        break;
      default:
        startDate = subMonths(new Date(selectedMonth + '-01'), 2);
        label = 'Custom';
    }

    const startYM = format(startDate, 'yyyy-MM');
    const endYM = selectedMonth;
    return { startDate, startYM, endYM, label };
  }, [period, selectedMonth]);

  // Previous period for comparison
  const prevRange = useMemo(() => {
    const months = period === 'monthly' ? 1 : period === 'quarterly' ? 3 : 12;
    const prevEnd = subMonths(new Date(dateRange.startYM + '-01'), 1);
    const prevStart = subMonths(prevEnd, months - 1);
    return {
      startYM: format(prevStart, 'yyyy-MM'),
      endYM: format(prevEnd, 'yyyy-MM'),
    };
  }, [dateRange, period]);

  // Fetch all report data
  const { data: reportData, isLoading } = useQuery({
    queryKey: ['report-data', dateRange.startYM, dateRange.endYM, prevRange.startYM, prevRange.endYM],
    queryFn: async () => {
      const [sourcesRes, currentRes, prevRes, campaignsRes, visitsRes] = await Promise.all([
        supabase.from('patient_sources').select('*').eq('is_active', true),
        supabase.from('monthly_patients').select('*').gte('year_month', dateRange.startYM).lte('year_month', dateRange.endYM),
        supabase.from('monthly_patients').select('*').gte('year_month', prevRange.startYM).lte('year_month', prevRange.endYM),
        supabase.from('campaigns').select('*, campaign_deliveries(*)').gte('created_at', dateRange.startYM + '-01'),
        supabase.from('marketing_visits').select('*').gte('visit_date', dateRange.startYM + '-01'),
      ]);

      return {
        sources: sourcesRes.data || [],
        currentMonthly: currentRes.data || [],
        prevMonthly: prevRes.data || [],
        campaigns: campaignsRes.data || [],
        visits: visitsRes.data || [],
      };
    },
    enabled: !!user,
  });

  // Computed analytics
  const analytics = useMemo(() => {
    if (!reportData) return null;
    const { sources, currentMonthly, prevMonthly, campaigns, visits } = reportData;

    const totalPatients = currentMonthly.reduce((s, m) => s + m.patient_count, 0);
    const prevTotalPatients = prevMonthly.reduce((s, m) => s + m.patient_count, 0);
    const changePercent = prevTotalPatients > 0 ? Math.round(((totalPatients - prevTotalPatients) / prevTotalPatients) * 100) : 0;

    // By source
    const bySource = sources.map(src => {
      const current = currentMonthly.filter(m => m.source_id === src.id).reduce((s, m) => s + m.patient_count, 0);
      const prev = prevMonthly.filter(m => m.source_id === src.id).reduce((s, m) => s + m.patient_count, 0);
      const change = prev > 0 ? Math.round(((current - prev) / prev) * 100) : current > 0 ? 100 : 0;
      return { ...src, current, prev, change };
    }).filter(s => s.current > 0 || s.prev > 0).sort((a, b) => b.current - a.current);

    // By type
    const byType: Record<string, { current: number; prev: number }> = {};
    sources.forEach(src => {
      const type = src.source_type;
      if (!byType[type]) byType[type] = { current: 0, prev: 0 };
      byType[type].current += currentMonthly.filter(m => m.source_id === src.id).reduce((s, m) => s + m.patient_count, 0);
      byType[type].prev += prevMonthly.filter(m => m.source_id === src.id).reduce((s, m) => s + m.patient_count, 0);
    });

    // Monthly trend data
    const monthlyTrend: Record<string, number> = {};
    currentMonthly.forEach(m => {
      monthlyTrend[m.year_month] = (monthlyTrend[m.year_month] || 0) + m.patient_count;
    });
    const trendData = Object.entries(monthlyTrend)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month: formatYearMonth(month), count }));

    // Type distribution for pie chart
    const typeDistribution = Object.entries(byType)
      .filter(([_, v]) => v.current > 0)
      .map(([type, v]) => ({
        name: SOURCE_TYPE_CONFIG[type as SourceType]?.label || type,
        value: v.current,
      }));

    // Campaign stats
    const totalCampaigns = campaigns.length;
    const activeCampaigns = campaigns.filter(c => c.status === 'Active').length;
    const completedCampaigns = campaigns.filter(c => c.status === 'Completed').length;

    // Visit stats
    const totalVisits = visits.length;
    const completedVisits = visits.filter(v => v.visited).length;

    return {
      totalPatients,
      prevTotalPatients,
      changePercent,
      activeSources: bySource.filter(s => s.current > 0).length,
      bySource,
      byType,
      trendData,
      typeDistribution,
      totalCampaigns,
      activeCampaigns,
      completedCampaigns,
      totalVisits,
      completedVisits,
      growingSources: bySource.filter(s => s.change > 0).length,
      decliningSources: bySource.filter(s => s.change < 0).length,
    };
  }, [reportData]);

  // Generate months for selector
  const monthOptions = useMemo(() => {
    const months = [];
    for (let i = 0; i < 24; i++) {
      const d = subMonths(new Date(), i);
      months.push({ value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy') });
    }
    return months;
  }, []);

  const handleExportPDF = async () => {
    if (!analytics) return;
    
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 15;
      let y = 20;

      // Title
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Referral Performance Report', margin, y);
      y += 10;
      
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100);
      pdf.text(dateRange.label, margin, y);
      y += 5;
      pdf.text(`Generated: ${format(new Date(), 'MMMM d, yyyy')}`, margin, y);
      pdf.setTextColor(0);
      y += 12;

      // Divider
      pdf.setDrawColor(200);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 8;

      // Overview
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Overview', margin, y);
      y += 8;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      const overviewData = [
        ['Total Patients', analytics.totalPatients.toString()],
        ['Change vs Previous Period', `${analytics.changePercent >= 0 ? '+' : ''}${analytics.changePercent}%`],
        ['Active Sources', analytics.activeSources.toString()],
        ['Growing Sources', analytics.growingSources.toString()],
        ['Declining Sources', analytics.decliningSources.toString()],
      ];

      overviewData.forEach(([label, value]) => {
        pdf.text(label, margin + 2, y);
        pdf.setFont('helvetica', 'bold');
        pdf.text(value, margin + 80, y);
        pdf.setFont('helvetica', 'normal');
        y += 6;
      });
      y += 6;

      // Top Sources
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Top Referral Sources', margin, y);
      y += 8;

      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Source', margin + 2, y);
      pdf.text('Patients', margin + 100, y);
      pdf.text('Change', margin + 130, y);
      pdf.setFont('helvetica', 'normal');
      y += 6;

      analytics.bySource.slice(0, 15).forEach(src => {
        if (y > 270) {
          pdf.addPage();
          y = 20;
        }
        pdf.text(String(src.name).substring(0, 45), margin + 2, y);
        pdf.text(src.current.toString(), margin + 100, y);
        const changeStr = `${src.change >= 0 ? '+' : ''}${src.change}%`;
        pdf.text(changeStr, margin + 130, y);
        y += 5;
      });
      y += 6;

      // Campaigns
      if (analytics.totalCampaigns > 0) {
        if (y > 250) { pdf.addPage(); y = 20; }
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Campaign Performance', margin, y);
        y += 8;
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Total Campaigns: ${analytics.totalCampaigns}`, margin + 2, y); y += 6;
        pdf.text(`Active: ${analytics.activeCampaigns}`, margin + 2, y); y += 6;
        pdf.text(`Completed: ${analytics.completedCampaigns}`, margin + 2, y); y += 8;
      }

      // Visits
      if (analytics.totalVisits > 0) {
        if (y > 250) { pdf.addPage(); y = 20; }
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Marketing Visits', margin, y);
        y += 8;
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Total Visits: ${analytics.totalVisits}`, margin + 2, y); y += 6;
        pdf.text(`Completed: ${analytics.completedVisits}`, margin + 2, y); y += 6;
        pdf.text(`Completion Rate: ${analytics.totalVisits > 0 ? Math.round((analytics.completedVisits / analytics.totalVisits) * 100) : 0}%`, margin + 2, y);
      }

      const filename = `referral-report-${dateRange.startYM}-to-${dateRange.endYM}.pdf`;
      pdf.save(filename);

      toast({ title: 'Report Downloaded', description: `Saved as ${filename}` });
    } catch (err) {
      console.error('PDF export error:', err);
      toast({ title: 'Export Failed', description: 'Could not generate PDF.', variant: 'destructive' });
    }
  };

  const handleExportCSV = () => {
    if (!analytics) return;
    const rows = analytics.bySource.map(s => ({
      Source: s.name,
      Type: s.source_type,
      'Current Period': s.current,
      'Previous Period': s.prev,
      'Change %': s.change,
    }));
    const csv = [Object.keys(rows[0]).join(','), ...rows.map(r => Object.values(r).map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `referral-report-${dateRange.startYM}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Generating report...</p>
        </div>
      </div>
    );
  }

  const SectionHeader = ({ title, icon: Icon, sectionKey }: { title: string; icon: React.ElementType; sectionKey: string }) => (
    <button
      onClick={() => toggleSection(sectionKey)}
      className="flex items-center justify-between w-full text-left"
    >
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {expandedSections[sectionKey] ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
    </button>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {!embedded && (
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Reports
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Generate and export referral performance reports
            </p>
          </div>
        )}

        <div className={`flex items-center gap-2 flex-wrap ${embedded ? 'w-full justify-between' : ''}`}>
          <Select value={period} onValueChange={(v) => setPeriod(v as ReportPeriod)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!analytics}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button variant="default" size="sm" onClick={handleExportPDF} disabled={!analytics}>
            <FileText className="h-4 w-4 mr-1" /> PDF
          </Button>
        </div>
      </div>

      {/* Report Title Bar */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">{period === 'monthly' ? 'Monthly' : period === 'quarterly' ? 'Quarterly' : 'Annual'} Referral Report</h2>
              <p className="text-sm text-muted-foreground">{dateRange.label} • Generated {format(new Date(), 'MMM d, yyyy')}</p>
            </div>
            <Badge variant="outline" className="text-xs">
              {analytics?.activeSources || 0} active sources
            </Badge>
          </div>
        </CardContent>
      </Card>

      {analytics && (
        <div ref={reportRef} className="space-y-6">
          {/* Overview Section */}
          <Card>
            <CardHeader className="pb-2">
              <SectionHeader title="Performance Overview" icon={BarChart3} sectionKey="overview" />
            </CardHeader>
            {expandedSections.overview && (
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center p-4 rounded-lg bg-muted/30">
                    <div className="text-3xl font-bold text-primary">{analytics.totalPatients}</div>
                    <div className="text-xs text-muted-foreground mt-1">Total Patients</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/30">
                    <div className={`text-3xl font-bold ${analytics.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {analytics.changePercent >= 0 ? '+' : ''}{analytics.changePercent}%
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">vs Previous</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/30">
                    <div className="text-3xl font-bold">{analytics.activeSources}</div>
                    <div className="text-xs text-muted-foreground mt-1">Active Sources</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/30">
                    <div className="text-3xl font-bold text-green-600">{analytics.growingSources}</div>
                    <div className="text-xs text-muted-foreground mt-1">Growing</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/30">
                    <div className="text-3xl font-bold text-red-600">{analytics.decliningSources}</div>
                    <div className="text-xs text-muted-foreground mt-1">Declining</div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Trend Chart */}
          <Card>
            <CardHeader className="pb-2">
              <SectionHeader title="Referral Trends" icon={TrendingUp} sectionKey="trends" />
            </CardHeader>
            {expandedSections.trends && (
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">Patients Over Time</h3>
                    {analytics.trendData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={analytics.trendData}>
                          <defs>
                            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="month" className="text-xs" />
                          <YAxis className="text-xs" />
                          <Tooltip />
                          <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorCount)" name="Patients" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-64 text-muted-foreground">No trend data available</div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">Source Distribution</h3>
                    {analytics.typeDistribution.length > 0 ? (
                      <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                          <Pie data={analytics.typeDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                            {analytics.typeDistribution.map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-64 text-muted-foreground">No data</div>
                    )}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Top Sources */}
          <Card>
            <CardHeader className="pb-2">
              <SectionHeader title="Top Referral Sources" icon={Building2} sectionKey="topSources" />
            </CardHeader>
            {expandedSections.topSources && (
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-2 px-2 font-medium">#</th>
                        <th className="text-left py-2 px-2 font-medium">Source</th>
                        <th className="text-left py-2 px-2 font-medium">Type</th>
                        <th className="text-right py-2 px-2 font-medium">Patients</th>
                        <th className="text-right py-2 px-2 font-medium">Previous</th>
                        <th className="text-right py-2 px-2 font-medium">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.bySource.slice(0, 20).map((src, i) => (
                        <tr key={src.id} className="border-b border-muted/50 hover:bg-muted/20">
                          <td className="py-2 px-2 text-muted-foreground">{i + 1}</td>
                          <td className="py-2 px-2 font-medium">{src.name}</td>
                          <td className="py-2 px-2">
                            <Badge variant="outline" className="text-xs">
                              {SOURCE_TYPE_CONFIG[src.source_type as SourceType]?.label || src.source_type}
                            </Badge>
                          </td>
                          <td className="py-2 px-2 text-right font-semibold">{src.current}</td>
                          <td className="py-2 px-2 text-right text-muted-foreground">{src.prev}</td>
                          <td className="py-2 px-2 text-right">
                            <span className={`inline-flex items-center gap-0.5 font-medium ${src.change > 0 ? 'text-green-600' : src.change < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                              {src.change > 0 ? <ArrowUp className="h-3 w-3" /> : src.change < 0 ? <ArrowDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                              {Math.abs(src.change)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {analytics.bySource.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">No referral data for this period</div>
                  )}
                </div>
              </CardContent>
            )}
          </Card>

          {/* Campaign Performance */}
          <Card>
            <CardHeader className="pb-2">
              <SectionHeader title="Campaign Performance" icon={Target} sectionKey="campaigns" />
            </CardHeader>
            {expandedSections.campaigns && (
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="text-center p-4 rounded-lg bg-muted/30">
                    <div className="text-3xl font-bold">{analytics.totalCampaigns}</div>
                    <div className="text-xs text-muted-foreground mt-1">Total Campaigns</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/30">
                    <div className="text-3xl font-bold text-blue-600">{analytics.activeCampaigns}</div>
                    <div className="text-xs text-muted-foreground mt-1">Active</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/30">
                    <div className="text-3xl font-bold text-green-600">{analytics.completedCampaigns}</div>
                    <div className="text-xs text-muted-foreground mt-1">Completed</div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Marketing Visits */}
          <Card>
            <CardHeader className="pb-2">
              <SectionHeader title="Marketing Visits" icon={Users} sectionKey="visits" />
            </CardHeader>
            {expandedSections.visits && (
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="text-center p-4 rounded-lg bg-muted/30">
                    <div className="text-3xl font-bold">{analytics.totalVisits}</div>
                    <div className="text-xs text-muted-foreground mt-1">Total Visits</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/30">
                    <div className="text-3xl font-bold text-green-600">{analytics.completedVisits}</div>
                    <div className="text-xs text-muted-foreground mt-1">Completed</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/30">
                    <div className="text-3xl font-bold text-primary">
                      {analytics.totalVisits > 0 ? Math.round((analytics.completedVisits / analytics.totalVisits) * 100) : 0}%
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Completion Rate</div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

export default Reports;
