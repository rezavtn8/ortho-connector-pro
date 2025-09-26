// src/pages/Analytics.tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  PatientSource,
  MonthlyPatients,
  SOURCE_TYPE_CONFIG,
  SourceType,
  formatYearMonth
} from '@/lib/database.types';
import { useUserSources, useAnalyticsData } from '@/hooks/useCachedData';
import { nowPostgres } from '@/lib/dateSync';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  Download,
  BarChart3,
  PieChart,
  LineChart,
  Building2,
  ArrowUp,
  ArrowDown,
  Target
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart as RechartsLineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

interface SourceAnalytics {
  source: PatientSource;
  totalPatients: number;
  averageMonthly: number;
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
  monthlyData: MonthlyPatients[];
}

export function Analytics() {
  const [sources, setSources] = useState<PatientSource[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyPatients[]>([]);
  const [analytics, setAnalytics] = useState<SourceAnalytics[]>([]);
  const [selectedType, setSelectedType] = useState<SourceType | 'all' | 'online' | 'offices' | 'insurance' | 'word-of-mouth' | 'other'>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<'3m' | '6m' | '12m' | 'all'>('6m');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Cached data hooks (deduped + persisted)
  const { data: sourcesData, isLoading: sourcesLoading } = useUserSources();
  const { data: analyticsData, isLoading: analyticsLoading } = useAnalyticsData();

  // Chart colors
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  // Use cached data and compute analytics locally
  useEffect(() => {
    if (sourcesLoading || analyticsLoading) {
      setLoading(true);
      return;
    }

    try {
      setLoading(false);

      // Calculate date range based on selected period
      const now = new Date();
      let startDate: Date;
      switch (selectedPeriod) {
        case '3m':
          startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          break;
        case '6m':
          startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
          break;
        case '12m':
          startDate = new Date(now.getFullYear(), now.getMonth() - 12, 1);
          break;
        default:
          startDate = new Date(2020, 0, 1);
      }
      const startYearMonth = `${startDate.getFullYear()}-${(startDate.getMonth() + 1).toString().padStart(2, '0')}`;

      // Filter data from cache
      const activeSources = (sourcesData || []).filter((s: any) => s.is_active);
      const monthlyDataResult = (analyticsData?.monthly_data || [])
        .filter((m: any) => m.year_month >= startYearMonth)
        .sort((a: any, b: any) => a.year_month.localeCompare(b.year_month));

      setSources(activeSources as any);
      setMonthlyData(monthlyDataResult as any);

      // Calculate analytics for each source
      const analyticsComputed: SourceAnalytics[] = (activeSources || []).map((source: any) => {
        const sourceMonthlyData = (monthlyDataResult || []).filter((m: any) => m.source_id === source.id);
        const totalPatients = sourceMonthlyData.reduce((sum: number, m: any) => sum + (m.patient_count || 0), 0);
        const averageMonthly = sourceMonthlyData.length > 0 ? Math.round(totalPatients / sourceMonthlyData.length) : 0;

        let trend: 'up' | 'down' | 'stable' = 'stable';
        let trendPercentage = 0;
        if (sourceMonthlyData.length >= 2) {
          const recent = sourceMonthlyData[sourceMonthlyData.length - 1].patient_count || 0;
          const previous = sourceMonthlyData[sourceMonthlyData.length - 2].patient_count || 0;
          if (recent > previous) {
            trend = 'up';
            trendPercentage = previous > 0 ? Math.round(((recent - previous) / previous) * 100) : 100;
          } else if (recent < previous) {
            trend = 'down';
            trendPercentage = previous > 0 ? Math.round(((previous - recent) / previous) * -100) : -100;
          }
        }

        return {
          source,
          totalPatients,
          averageMonthly,
          trend,
          trendPercentage,
          monthlyData: sourceMonthlyData as any
        };
      });

      setAnalytics(analyticsComputed);
    } catch (error) {
      console.error('Error computing analytics:', error);
      toast({ title: 'Error', description: 'Failed to process analytics data', variant: 'destructive' });
      setSources([]);
      setMonthlyData([]);
      setAnalytics([]);
    }
  }, [sourcesData, analyticsData, selectedPeriod, sourcesLoading, analyticsLoading, toast]);

  // Helper function to determine source category
  const getSourceCategory = (sourceType: SourceType) => {
    switch (sourceType) {
      case 'Yelp':
      case 'Google':
      case 'Website':
      case 'Social Media':
        return 'online';
      case 'Office':
        return 'offices';
      case 'Insurance':
        return 'insurance';
      case 'Word of Mouth':
        return 'word-of-mouth';
      case 'Other':
        return 'other';
      default:
        return 'other';
    }
  };

  // Filter analytics by source type or category
  const filteredAnalytics = selectedType === 'all' 
    ? analytics
    : selectedType === 'online' || selectedType === 'offices' || selectedType === 'insurance' || selectedType === 'word-of-mouth' || selectedType === 'other'
    ? analytics.filter(a => getSourceCategory(a.source.source_type) === selectedType)
    : analytics.filter(a => a.source.source_type === selectedType);

  // Prepare data for charts
  const getMonthlyChartData = () => {
    const monthlyTotals: { [key: string]: number } = {};
    
    monthlyData.forEach(data => {
      const source = sources.find(s => s.id === data.source_id);
      if (!source) return;
      
      const matchesFilter = selectedType === 'all' || 
        (selectedType === 'online' || selectedType === 'offices' || selectedType === 'insurance' || selectedType === 'word-of-mouth' || selectedType === 'other'
          ? getSourceCategory(source.source_type) === selectedType
          : source.source_type === selectedType);
      
      if (matchesFilter) {
        monthlyTotals[data.year_month] = (monthlyTotals[data.year_month] || 0) + data.patient_count;
      }
    });

    return Object.entries(monthlyTotals)
      .sort(([a], [b]) => a.localeCompare(b)) // Sort by year-month string first
      .map(([month, count]) => ({
        month: formatYearMonth(month),
        count
      }));
  };

  const getTypeDistribution = () => {
    const distribution: { [key: string]: number } = {};
    
    analytics.forEach(a => {
      const type = a.source.source_type;
      distribution[type] = (distribution[type] || 0) + a.totalPatients;
    });

    return Object.entries(distribution).map(([type, count]) => ({
      name: SOURCE_TYPE_CONFIG[type as SourceType].label,
      value: count,
      icon: SOURCE_TYPE_CONFIG[type as SourceType].icon
    }));
  };

  const getTopPerformers = () => {
    return [...filteredAnalytics]
      .sort((a, b) => b.totalPatients - a.totalPatients)
      .slice(0, 10);
  };

  const getDecliningSourcesAnalysis = () => {
    return [...filteredAnalytics]
      .filter(a => a.trend === 'down')
      .sort((a, b) => a.trendPercentage - b.trendPercentage) // Sort by worst decline first
      .slice(0, 10);
  };

  const getGrowingSourcesAnalysis = () => {
    return [...filteredAnalytics]
      .filter(a => a.trend === 'up')
      .sort((a, b) => b.trendPercentage - a.trendPercentage) // Sort by best growth first
      .slice(0, 10);
  };

  // Calculate summary statistics
  const totalPatients = filteredAnalytics.reduce((sum, a) => sum + a.totalPatients, 0);
  const totalSources = filteredAnalytics.length;
  const averagePerSource = totalSources > 0 ? Math.round(totalPatients / totalSources) : 0;
  const growingSources = filteredAnalytics.filter(a => a.trend === 'up').length;

  const exportData = () => {
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
  };

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
      <div className="flex justify-between items-center">
        <div className="flex gap-4">
          <Select value={selectedType} onValueChange={(v) => setSelectedType(v as any)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent className="bg-background border z-50">
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="online">
                <span className="flex items-center gap-2">
                  <span>🌐</span>
                  Online Sources
                </span>
              </SelectItem>
              <SelectItem value="offices">
                <span className="flex items-center gap-2">
                  <span>🏢</span>
                  Offices
                </span>
              </SelectItem>
              <SelectItem value="insurance">
                <span className="flex items-center gap-2">
                  <span>📋</span>
                  Insurance
                </span>
              </SelectItem>
              <SelectItem value="word-of-mouth">
                <span className="flex items-center gap-2">
                  <span>💬</span>
                  Word of Mouth
                </span>
              </SelectItem>
              <SelectItem value="other">
                <span className="flex items-center gap-2">
                  <span>📌</span>
                  Other
                </span>
              </SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedPeriod} onValueChange={(v) => setSelectedPeriod(v as '3m' | '6m' | '12m' | 'all')}>
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
        <Button onClick={exportData} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export Data
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5" />
              Total Patients
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{totalPatients}</div>
            <p className="text-sm text-muted-foreground">From {totalSources} sources</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Average/Source
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{averagePerSource}</div>
            <p className="text-sm text-muted-foreground">Patients per source</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Growing Sources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{growingSources}</div>
            <p className="text-sm text-muted-foreground">Trending upward</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingDown className="w-5 h-5" />
              Declining Sources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {filteredAnalytics.filter(a => a.trend === 'down').length}
            </div>
            <div className="flex justify-between text-sm text-muted-foreground mt-2">
              <span>Need attention</span>
              <span>
                Avg decline: {
                  filteredAnalytics.filter(a => a.trend === 'down').length > 0
                    ? Math.abs(Math.round(
                        filteredAnalytics
                          .filter(a => a.trend === 'down')
                          .reduce((sum, a) => sum + a.trendPercentage, 0) /
                        filteredAnalytics.filter(a => a.trend === 'down').length
                      ))
                    : 0
                }%
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Tabs */}
      <Tabs defaultValue="trends" className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 w-full max-w-4xl" variant="pills">
          <TabsTrigger value="trends" variant="pills" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Trends</span>
          </TabsTrigger>
          <TabsTrigger value="distribution" variant="pills" className="flex items-center gap-2">
            <PieChart className="h-4 w-4" />
            <span className="hidden sm:inline">Distribution</span>
          </TabsTrigger>
          <TabsTrigger value="performance" variant="pills" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Top Performers</span>
          </TabsTrigger>
          <TabsTrigger value="growing" variant="pills" className="flex items-center gap-2">
            <ArrowUp className="h-4 w-4" />
            <span className="hidden sm:inline">Growing</span>
          </TabsTrigger>
          <TabsTrigger value="declining" variant="pills" className="flex items-center gap-2">
            <ArrowDown className="h-4 w-4" />
            <span className="hidden sm:inline">Declining</span>
          </TabsTrigger>
          <TabsTrigger value="outreach" variant="pills" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Outreach</span>
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="trends" className="space-y-4">
                  <Card>
            <CardHeader>
              <CardTitle>Monthly Patient Trends</CardTitle>
              <CardDescription>
                Total patients from all sources over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RechartsLineChart data={getMonthlyChartData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#8884d8" 
                    name="Patients"
                    strokeWidth={2}
                  />
                </RechartsLineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribution" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Patient Distribution by Source Type</CardTitle>
              <CardDescription>
                Breakdown of patients by source category
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPieChart>
                  <Pie
                    data={getTypeDistribution()}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {getTypeDistribution().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsPieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Sources</CardTitle>
              <CardDescription>
                Sources with the highest patient counts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart 
                  data={getTopPerformers().map(a => ({
                    name: a.source.name.length > 20 
                      ? a.source.name.substring(0, 20) + '...' 
                      : a.source.name,
                    patients: a.totalPatients
                  }))}
                  margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="patients" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="growing" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Growing Sources Chart</CardTitle>
                <CardDescription>
                  Sources with positive trends - percentage growth
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart 
                    data={getGrowingSourcesAnalysis().map(a => ({
                      name: a.source.name.length > 20 
                        ? a.source.name.substring(0, 20) + '...' 
                        : a.source.name,
                      growth: a.trendPercentage
                    }))}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45}
                      textAnchor="end"
                      height={100}
                    />
                    <YAxis />
                    <Tooltip formatter={(value) => [`${value}%`, 'Growth']} />
                    <Bar dataKey="growth" fill="#22c55e" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Growing Sources Performance</CardTitle>
                <CardDescription>
                  Sources showing positive momentum
                </CardDescription>
              </CardHeader>
              <CardContent>
                {getGrowingSourcesAnalysis().length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <TrendingUp className="w-12 h-12 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-sm">No growing sources found</p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-border/50 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Source Name</th>
                          <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Category</th>
                          <th className="text-right p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Total Count</th>
                          <th className="text-right p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Growth Rate</th>
                          <th className="text-right p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Monthly Avg</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {getGrowingSourcesAnalysis().map((analytics, index) => (
                          <tr key={analytics.source.id} className="hover:bg-muted/20 transition-colors">
                            <td className="p-3">
                              <div className="font-medium text-sm text-foreground">{analytics.source.name}</div>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <span className="text-base">
                                  {SOURCE_TYPE_CONFIG[analytics.source.source_type].icon}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {SOURCE_TYPE_CONFIG[analytics.source.source_type].label}
                                </span>
                              </div>
                            </td>
                            <td className="p-3 text-right">
                              <span className="font-medium text-sm text-foreground">
                                {analytics.totalPatients.toLocaleString()}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <TrendingUp className="w-3 h-3 text-green-500" />
                                <span className="text-green-600 font-semibold text-sm">
                                  +{analytics.trendPercentage}%
                                </span>
                              </div>
                            </td>
                            <td className="p-3 text-right">
                              <span className="text-muted-foreground text-sm">
                                {analytics.averageMonthly}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="declining" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Declining Sources Chart</CardTitle>
                <CardDescription>
                  Sources with negative trends - percentage decline
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart 
                    data={getDecliningSourcesAnalysis().map(a => ({
                      name: a.source.name.length > 20 
                        ? a.source.name.substring(0, 20) + '...' 
                        : a.source.name,
                      decline: Math.abs(a.trendPercentage)
                    }))}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45}
                      textAnchor="end"
                      height={100}
                    />
                    <YAxis />
                    <Tooltip formatter={(value) => [`${value}%`, 'Decline']} />
                    <Bar dataKey="decline" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Declining Sources Details</CardTitle>
                <CardDescription>
                  Sources that need immediate attention
                </CardDescription>
              </CardHeader>
              <CardContent>
                {getDecliningSourcesAnalysis().length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <TrendingDown className="w-12 h-12 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-sm">No declining sources found</p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-border/50 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Source Name</th>
                          <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Category</th>
                          <th className="text-right p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Total Count</th>
                          <th className="text-right p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Decline Rate</th>
                          <th className="text-right p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Monthly Avg</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {getDecliningSourcesAnalysis().map((analytics, index) => (
                          <tr key={analytics.source.id} className="hover:bg-muted/20 transition-colors">
                            <td className="p-3">
                              <div className="font-medium text-sm text-foreground">{analytics.source.name}</div>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <span className="text-base">
                                  {SOURCE_TYPE_CONFIG[analytics.source.source_type].icon}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {SOURCE_TYPE_CONFIG[analytics.source.source_type].label}
                                </span>
                              </div>
                            </td>
                            <td className="p-3 text-right">
                              <span className="font-medium text-sm text-foreground">
                                {analytics.totalPatients.toLocaleString()}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <TrendingDown className="w-3 h-3 text-red-500" />
                                <span className="text-red-600 font-semibold text-sm">
                                  {Math.abs(analytics.trendPercentage)}%
                                </span>
                              </div>
                            </td>
                            <td className="p-3 text-right">
                              <span className="text-muted-foreground text-sm">
                                {analytics.averageMonthly}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Marketing Outreach Tab */}
        <TabsContent value="marketing" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Total Visits
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">
                  {/* This would need to be populated with actual visit data */}
                  -
                </div>
                <p className="text-sm text-muted-foreground">All marketing visits</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Offices Visited
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">
                  -
                </div>
                <p className="text-sm text-muted-foreground">Unique offices</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Conversion Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">
                  -
                </div>
                <p className="text-sm text-muted-foreground">Visits to referrals</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Marketing Outreach Analytics</CardTitle>
              <CardDescription>
                Track the effectiveness of your marketing visits and materials
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Marketing Analytics Coming Soon</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Detailed analytics showing visit trends, referral conversion rates by materials, 
                  and before/after visit comparisons will be available here.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}