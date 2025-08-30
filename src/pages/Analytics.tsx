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
import { supabase } from '@/integrations/supabase/client';
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
  Building2
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
  const [selectedType, setSelectedType] = useState<SourceType | 'all'>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<'3m' | '6m' | '12m' | 'all'>('6m');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Chart colors
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  useEffect(() => {
    loadAnalytics();
  }, [selectedPeriod]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);

      // Load sources
      const { data: sourcesData, error: sourcesError } = await supabase
        .from('patient_sources')
        .select('*')
        .eq('is_active', true);

      if (sourcesError) throw sourcesError;

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
          startDate = new Date(2020, 0, 1); // All time
      }

      const startYearMonth = `${startDate.getFullYear()}-${(startDate.getMonth() + 1).toString().padStart(2, '0')}`;

      // Load monthly data
      const { data: monthlyDataResult, error: monthlyError } = await supabase
        .from('monthly_patients')
        .select('*')
        .gte('year_month', startYearMonth)
        .order('year_month', { ascending: true });

      if (monthlyError) throw monthlyError;

      setSources(sourcesData || []);
      setMonthlyData(monthlyDataResult || []);

      // Calculate analytics for each source
      const analyticsData: SourceAnalytics[] = (sourcesData || []).map(source => {
        const sourceMonthlyData = (monthlyDataResult || []).filter(m => m.source_id === source.id);
        const totalPatients = sourceMonthlyData.reduce((sum, m) => sum + m.patient_count, 0);
        const averageMonthly = sourceMonthlyData.length > 0 
          ? Math.round(totalPatients / sourceMonthlyData.length)
          : 0;

        // Calculate trend
        let trend: 'up' | 'down' | 'stable' = 'stable';
        let trendPercentage = 0;

        if (sourceMonthlyData.length >= 2) {
          const recent = sourceMonthlyData[sourceMonthlyData.length - 1].patient_count;
          const previous = sourceMonthlyData[sourceMonthlyData.length - 2].patient_count;
          
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
          monthlyData: sourceMonthlyData
        };
      });

      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Error loading analytics:', error);
      toast({
        title: "Error",
        description: "Failed to load analytics data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter analytics by source type
  const filteredAnalytics = selectedType === 'all' 
    ? analytics
    : analytics.filter(a => a.source.source_type === selectedType);

  // Prepare data for charts
  const getMonthlyChartData = () => {
    const monthlyTotals: { [key: string]: number } = {};
    
    monthlyData.forEach(data => {
      if (selectedType === 'all' || sources.find(s => s.id === data.source_id)?.source_type === selectedType) {
        monthlyTotals[data.year_month] = (monthlyTotals[data.year_month] || 0) + data.patient_count;
      }
    });

    return Object.entries(monthlyTotals)
      .map(([month, count]) => ({
        month: formatYearMonth(month),
        count
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
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
    a.download = `analytics-${new Date().toISOString().split('T')[0]}.csv`;
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground">
            Track patient source performance and trends
          </p>
        </div>
        <Button onClick={exportData} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export Data
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex gap-4">
            <Select value={selectedType} onValueChange={(v) => setSelectedType(v as SourceType | 'all')}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(SOURCE_TYPE_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    <span className="flex items-center gap-2">
                      <span>{config.icon}</span>
                      {config.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedPeriod} onValueChange={(v) => setSelectedPeriod(v as '3m' | '6m' | '12m' | 'all')}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Time Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3m">Last 3 Months</SelectItem>
                <SelectItem value="6m">Last 6 Months</SelectItem>
                <SelectItem value="12m">Last 12 Months</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

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

      {/* Charts */}
      <Tabs defaultValue="trends" className="w-full">
        <TabsList>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="distribution">Distribution</TabsTrigger>
          <TabsTrigger value="performance">Top Performers</TabsTrigger>
          <TabsTrigger value="declining">Declining Analysis</TabsTrigger>
        </TabsList>

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
                    No declining sources found
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left p-3 font-medium">Source</th>
                          <th className="text-left p-3 font-medium">Type</th>
                          <th className="text-right p-3 font-medium">Total Patients</th>
                          <th className="text-right p-3 font-medium">Decline %</th>
                          <th className="text-right p-3 font-medium">Avg Monthly</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getDecliningSourcesAnalysis().map((analytics, index) => (
                          <tr key={analytics.source.id} className={index % 2 === 0 ? "bg-background" : "bg-muted/25"}>
                            <td className="p-3">
                              <div className="font-medium">{analytics.source.name}</div>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">
                                  {SOURCE_TYPE_CONFIG[analytics.source.source_type].icon}
                                </span>
                                <span className="text-sm">
                                  {SOURCE_TYPE_CONFIG[analytics.source.source_type].label}
                                </span>
                              </div>
                            </td>
                            <td className="p-3 text-right font-medium">
                              {analytics.totalPatients}
                            </td>
                            <td className="p-3 text-right">
                              <span className="text-red-600 font-bold">
                                -{Math.abs(analytics.trendPercentage)}%
                              </span>
                            </td>
                            <td className="p-3 text-right text-muted-foreground">
                              {analytics.averageMonthly}
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
      </Tabs>
    </div>
  );
}