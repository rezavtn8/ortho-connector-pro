/**
 * Optimized Analytics component with React.memo and performance optimizations
 */
import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOptimizedAnalytics } from '@/hooks/useOptimizedAnalytics';
import { ComponentPerformance } from '@/components/performance/PerformanceMonitor';
import { SOURCE_TYPE_CONFIG, SourceType } from '@/lib/database.types';
import { nowPostgres } from '@/lib/dateSync';
import { Download, BarChart3, Users, Activity, TrendingUp, TrendingDown } from 'lucide-react';

// Memoized summary card to prevent unnecessary re-renders
const SummaryCard = React.memo<{
  title: string;
  value: number | string;
  subtitle: string;
  icon: React.ReactNode;
  className?: string;
}>(({ title, value, subtitle, icon, className }) => (
  <Card>
    <CardHeader className="pb-3">
      <CardTitle className="text-lg flex items-center gap-2">
        {icon}
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className={`text-3xl font-bold ${className || 'text-primary'}`}>{value}</div>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </CardContent>
  </Card>
));
SummaryCard.displayName = 'SummaryCard';

// Memoized controls to prevent re-renders
const AnalyticsControls = React.memo<{
  selectedType: string;
  selectedPeriod: string;
  onTypeChange: (value: string) => void;
  onPeriodChange: (value: string) => void;
  onExport: () => void;
}>(({ selectedType, selectedPeriod, onTypeChange, onPeriodChange, onExport }) => (
  <div className="flex justify-between items-center">
    <div className="flex gap-4">
      <Select value={selectedType} onValueChange={onTypeChange}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="All Categories" />
        </SelectTrigger>
        <SelectContent className="bg-background border z-50">
          <SelectItem value="all">All Categories</SelectItem>
          <SelectItem value="online">🌐 Online Sources</SelectItem>
          <SelectItem value="offices">🏢 Offices</SelectItem>
          <SelectItem value="insurance">📋 Insurance</SelectItem>
          <SelectItem value="word-of-mouth">💬 Word of Mouth</SelectItem>
          <SelectItem value="other">📌 Other</SelectItem>
        </SelectContent>
      </Select>

      <Select value={selectedPeriod} onValueChange={onPeriodChange}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Time Period" />
        </SelectTrigger>
        <SelectContent className="bg-background border z-50">
          <SelectItem value="3m">Last 3 Months</SelectItem>
          <SelectItem value="6m">Last 6 Months</SelectItem>
          <SelectItem value="12m">Last 12 Months</SelectItem>
          <SelectItem value="all">All Time</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <Button onClick={onExport} variant="outline">
      <Download className="w-4 h-4 mr-2" />
      Export Data
    </Button>
  </div>
));
AnalyticsControls.displayName = 'AnalyticsControls';

export const OptimizedAnalytics = React.memo(() => {
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<'3m' | '6m' | '12m' | 'all'>('6m');
  
  const { analytics, loading, getFilteredAnalytics } = useOptimizedAnalytics(selectedPeriod);

  // Memoized filtered data
  const filteredAnalytics = useMemo(() => 
    getFilteredAnalytics(selectedType), 
    [getFilteredAnalytics, selectedType]
  );

  // Memoized summary calculations
  const summaryStats = useMemo(() => {
    const totalPatients = filteredAnalytics.reduce((sum, a) => sum + a.totalPatients, 0);
    const totalSources = filteredAnalytics.length;
    const averagePerSource = totalSources > 0 ? Math.round(totalPatients / totalSources) : 0;
    const growingSources = filteredAnalytics.filter(a => a.trend === 'up').length;
    const decliningCount = filteredAnalytics.filter(a => a.trend === 'down').length;
    const avgDecline = decliningCount > 0 
      ? Math.abs(Math.round(
          filteredAnalytics
            .filter(a => a.trend === 'down')
            .reduce((sum, a) => sum + a.trendPercentage, 0) / decliningCount
        ))
      : 0;

    return {
      totalPatients,
      totalSources,
      averagePerSource,
      growingSources,
      decliningCount,
      avgDecline
    };
  }, [filteredAnalytics]);

  // Memoized export function
  const exportData = useCallback(() => {
    const csvData = filteredAnalytics.map(a => ({
      'Source Name': a.source.name,
      'Type': SOURCE_TYPE_CONFIG[a.source.source_type].label,
      'Total Patients': a.totalPatients,
      'Average Monthly': a.averageMonthly,
      'Trend': a.trend,
      'Trend %': a.trendPercentage,
      'Status': a.source.is_active ? 'Active' : 'Inactive'
    }));

    const csvString = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).map(value => `"${value}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${nowPostgres()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }, [filteredAnalytics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <ComponentPerformance name="OptimizedAnalytics" threshold={100}>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col space-y-3 mb-8">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-8 w-8 title-icon" />
            <h1 className="text-4xl font-bold page-title">Analytics</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Performance insights and data visualization for your practice
          </p>
        </div>

        {/* Controls */}
        <AnalyticsControls
          selectedType={selectedType}
          selectedPeriod={selectedPeriod}
          onTypeChange={setSelectedType}
          onPeriodChange={(value) => setSelectedPeriod(value as '3m' | '6m' | '12m' | 'all')}
          onExport={exportData}
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <SummaryCard
            title="Total Patients"
            value={summaryStats.totalPatients}
            subtitle={`From ${summaryStats.totalSources} sources`}
            icon={<Users className="w-5 h-5" />}
          />
          <SummaryCard
            title="Average/Source"
            value={summaryStats.averagePerSource}
            subtitle="Patients per source"
            icon={<Activity className="w-5 h-5" />}
          />
          <SummaryCard
            title="Growing Sources"
            value={summaryStats.growingSources}
            subtitle="Trending upward"
            icon={<TrendingUp className="w-5 h-5" />}
            className="text-green-600"
          />
          <SummaryCard
            title="Declining Sources"
            value={summaryStats.decliningCount}
            subtitle={`Avg decline: ${summaryStats.avgDecline}%`}
            icon={<TrendingDown className="w-5 h-5" />}
            className="text-red-600"
          />
        </div>

        {/* Placeholder for charts - implement with lazy loading */}
        <Card>
          <CardHeader>
            <CardTitle>Analytics Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              Charts and detailed analytics will load here
              <br />
              <small>Implementing with virtual scrolling for optimal performance</small>
            </div>
          </CardContent>
        </Card>
      </div>
    </ComponentPerformance>
  );
});

OptimizedAnalytics.displayName = 'OptimizedAnalytics';