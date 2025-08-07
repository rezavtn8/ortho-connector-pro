import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter } from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, Award, Download, Calendar, Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

interface PatientLoadTrend {
  date: string;
  office_name: string;
  patient_count: number;
  office_id: string;
}

interface OfficePerformance {
  office_id: string;
  office_name: string;
  current_load: number;
  score: string;
  total_referrals: number;
  change_30d: number;
  trend_direction: 'up' | 'down' | 'stable';
}

interface InsightCard {
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'stable';
  icon: React.ComponentType<any>;
}

export const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(30);
  const [selectedOffice, setSelectedOffice] = useState('all');
  const [trendData, setTrendData] = useState<PatientLoadTrend[]>([]);
  const [officePerformance, setOfficePerformance] = useState<OfficePerformance[]>([]);
  const [insights, setInsights] = useState<InsightCard[]>([]);
  const [offices, setOffices] = useState<{ id: string; name: string }[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchAnalyticsData();
  }, [dateRange, selectedOffice]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      
      // Fetch offices list
      const { data: officesData } = await supabase
        .from('referring_offices')
        .select('id, name')
        .order('name');
      
      setOffices(officesData || []);

      // Fetch patient load trends
      const startDate = subDays(new Date(), dateRange);
      const { data: trendsData } = await supabase
        .from('patient_load_history')
        .select(`
          timestamp,
          patient_count,
          office_id,
          referring_offices!inner(name)
        `)
        .gte('timestamp', startDate.toISOString())
        .order('timestamp', { ascending: true });

      // Transform trends data
      const transformedTrends = (trendsData || []).map(item => ({
        date: format(new Date(item.timestamp), 'MMM dd'),
        office_name: (item.referring_offices as any).name,
        patient_count: item.patient_count,
        office_id: item.office_id
      }));

      setTrendData(transformedTrends);

      // Fetch office performance data
      const { data: officesPerformance } = await supabase
        .from('referring_offices')
        .select(`
          id,
          name,
          patient_load,
          referral_data(referral_count)
        `);

      // Calculate performance metrics
      const performanceData = await Promise.all(
        (officesPerformance || []).map(async (office) => {
          // Get score
          const { data: scoreData } = await supabase.rpc('calculate_office_score', {
            office_id_param: office.id
          });

          // Get 30-day trend
          const { data: trendData } = await supabase.rpc('get_patient_load_trend', {
            office_id_param: office.id,
            days_back: 30
          });

          const totalReferrals = (office.referral_data as any[])?.reduce((sum, r) => sum + r.referral_count, 0) || 0;
          const trend = trendData?.[0];
          const change30d = trend ? trend.current_count - trend.previous_count : 0;

          return {
            office_id: office.id,
            office_name: office.name,
            current_load: office.patient_load || 0,
            score: scoreData || 'Cold',
            total_referrals: totalReferrals,
            change_30d: change30d,
            trend_direction: change30d > 0 ? 'up' : change30d < 0 ? 'down' : 'stable'
          } as OfficePerformance;
        })
      );

      setOfficePerformance(performanceData);

      // Generate insights
      const totalLoad = performanceData.reduce((sum, p) => sum + p.current_load, 0);
      const growingOffices = performanceData.filter(p => p.trend_direction === 'up').length;
      const decliningOffices = performanceData.filter(p => p.trend_direction === 'down').length;
      const busiestOffice = performanceData.reduce((max, p) => p.current_load > max.current_load ? p : max, performanceData[0]);

      setInsights([
        {
          title: 'Total Patient Load',
          value: totalLoad.toString(),
          change: '+12% this month',
          trend: 'up',
          icon: Activity
        },
        {
          title: 'Growing Partners',
          value: growingOffices.toString(),
          change: `${growingOffices} offices trending up`,
          trend: 'up',
          icon: TrendingUp
        },
        {
          title: 'Needs Attention',
          value: decliningOffices.toString(),
          change: `${decliningOffices} offices declining`,
          trend: 'down',
          icon: AlertTriangle
        },
        {
          title: 'Top Performer',
          value: busiestOffice?.office_name || 'N/A',
          change: `${busiestOffice?.current_load || 0} current load`,
          trend: 'up',
          icon: Award
        }
      ]);

    } catch (error) {
      console.error('Error fetching analytics data:', error);
      toast({
        title: "Error",
        description: "Failed to load analytics data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredTrendData = selectedOffice === 'all' 
    ? trendData 
    : trendData.filter(d => d.office_id === selectedOffice);

  const filteredPerformanceData = selectedOffice === 'all'
    ? officePerformance
    : officePerformance.filter(p => p.office_id === selectedOffice);

  // Aggregate data for charts
  const dailyTotals = filteredTrendData.reduce((acc, item) => {
    const existing = acc.find(d => d.date === item.date);
    if (existing) {
      existing.total += item.patient_count;
    } else {
      acc.push({ date: item.date, total: item.patient_count });
    }
    return acc;
  }, [] as { date: string; total: number }[]);

  const scatterData = filteredPerformanceData.map(office => ({
    x: office.current_load,
    y: office.total_referrals,
    name: office.office_name,
    score: office.score
  }));

  const exportData = () => {
    const csvData = filteredPerformanceData.map(office => ({
      'Office Name': office.office_name,
      'Current Load': office.current_load,
      'Score': office.score,
      'Total Referrals': office.total_referrals,
      '30-Day Change': office.change_30d,
      'Trend': office.trend_direction
    }));

    const csvString = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).map(value => `"${value}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-text bg-clip-text text-transparent">
            Analytics Dashboard
          </h1>
          <p className="text-muted-foreground">
            Patient load and referral insights for referring offices
          </p>
        </div>
        
        <div className="flex gap-3">
          <Select value={dateRange.toString()} onValueChange={(value) => setDateRange(parseInt(value))}>
            <SelectTrigger className="w-40">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Last 30 Days</SelectItem>
              <SelectItem value="60">Last 60 Days</SelectItem>
              <SelectItem value="90">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedOffice} onValueChange={setSelectedOffice}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Offices" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Offices</SelectItem>
              {offices.map(office => (
                <SelectItem key={office.id} value={office.id}>
                  {office.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={exportData}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Insight Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {insights.map((insight, index) => {
          const Icon = insight.icon;
          return (
            <Card key={index}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {insight.title}
                    </p>
                    <p className="text-2xl font-bold">
                      {insight.value}
                    </p>
                  </div>
                  <Icon className={`w-8 h-8 ${
                    insight.trend === 'up' ? 'text-green-600' : 
                    insight.trend === 'down' ? 'text-red-600' : 
                    'text-muted-foreground'
                  }`} />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {insight.change}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Patient Load Trends */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Patient Load Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyTotals}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="total" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Patient Load vs Office Score */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5" />
              Load vs Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart data={scatterData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="x" name="Patient Load" />
                <YAxis dataKey="y" name="Total Referrals" />
                <Tooltip 
                  formatter={(value, name) => [value, name === 'x' ? 'Patient Load' : 'Total Referrals']}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.name || ''}
                />
                <Scatter dataKey="y" fill="hsl(var(--primary))" />
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Office Performance Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Office Name</TableHead>
                <TableHead>Current Load</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Total Referrals</TableHead>
                <TableHead>30-Day Change</TableHead>
                <TableHead>Trend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPerformanceData
                .sort((a, b) => b.current_load - a.current_load)
                .map((office) => (
                <TableRow key={office.office_id}>
                  <TableCell className="font-medium">
                    {office.office_name}
                  </TableCell>
                  <TableCell>{office.current_load}</TableCell>
                  <TableCell>
                    <Badge variant={
                      office.score === 'Strong' ? 'success' :
                      office.score === 'Moderate' ? 'default' :
                      office.score === 'Sporadic' ? 'warning' : 'destructive'
                    }>
                      {office.score}
                    </Badge>
                  </TableCell>
                  <TableCell>{office.total_referrals}</TableCell>
                  <TableCell className={
                    office.change_30d > 0 ? 'text-green-600' :
                    office.change_30d < 0 ? 'text-red-600' : 'text-muted-foreground'
                  }>
                    {office.change_30d > 0 ? '+' : ''}{office.change_30d}
                  </TableCell>
                  <TableCell>
                    {office.trend_direction === 'up' && 
                      <TrendingUp className="w-4 h-4 text-green-600" />}
                    {office.trend_direction === 'down' && 
                      <TrendingDown className="w-4 h-4 text-red-600" />}
                    {office.trend_direction === 'stable' && 
                      <div className="w-4 h-4 bg-muted-foreground rounded-full" />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};