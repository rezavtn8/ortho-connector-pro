import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart, LineChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Users, MapPin, Star, Calendar, Zap, Target } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface AnalysisData {
  totalSources: number;
  activeSourcesThisMonth: number;
  totalPatients: number;
  avgReferralsPerSource: number;
  topPerformingSources: Array<{
    name: string;
    patients: number;
    trend: 'up' | 'down' | 'stable';
  }>;
  sourceDistribution: Array<{
    type: string;
    count: number;
    color: string;
  }>;
  monthlyTrends: Array<{
    month: string;
    patients: number;
    sources: number;
  }>;
  geographicInsights: {
    avgDistance: number;
    primaryArea: string;
    coverage: number;
  };
}

export function AIDataAnalysis() {
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    loadAnalysisData();
  }, [user]);

  const loadAnalysisData = async () => {
    if (!user) return;

    try {
      // Fetch patient sources and monthly data
      const { data: sources, error: sourcesError } = await supabase
        .from('patient_sources')
        .select('*')
        .eq('created_by', user.id);

      const { data: monthlyData, error: monthlyError } = await supabase
        .from('monthly_patients')
        .select('*')
        .eq('user_id', user.id);

      if (sourcesError || monthlyError) {
        console.error('Error loading data:', sourcesError || monthlyError);
        return;
      }

      // Process data for analysis
      const currentMonth = new Date().toISOString().slice(0, 7);
      const activeThisMonth = monthlyData?.filter(m => 
        m.year_month === currentMonth && m.patient_count > 0
      ).length || 0;

      const totalPatients = monthlyData?.reduce((sum, m) => sum + (m.patient_count || 0), 0) || 0;

      // Calculate top performing sources
      const sourcePerformance = sources?.map(source => {
        const sourceData = monthlyData?.filter(m => m.source_id === source.id) || [];
        const totalForSource = sourceData.reduce((sum, m) => sum + (m.patient_count || 0), 0);
        const recentMonths = sourceData.slice(-3);
        const trend = recentMonths.length > 1 && 
          recentMonths[recentMonths.length - 1]?.patient_count > recentMonths[0]?.patient_count 
          ? 'up' : 'down';
        
        return {
          name: source.name,
          patients: totalForSource,
          trend: trend as 'up' | 'down' | 'stable'
        };
      }).sort((a, b) => b.patients - a.patients).slice(0, 5) || [];

      // Source type distribution
      const sourceTypes = sources?.reduce((acc, source) => {
        const type = source.source_type || 'Unknown';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'];
      const sourceDistribution = Object.entries(sourceTypes).map(([type, count], index) => ({
        type,
        count,
        color: colors[index % colors.length]
      }));

      // Monthly trends (last 12 months)
      const monthlyTrends = [];
      for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = date.toISOString().slice(0, 7);
        const monthName = date.toLocaleDateString('en-US', { month: 'short' });
        
        const monthPatients = monthlyData?.filter(m => m.year_month === monthKey)
          .reduce((sum, m) => sum + (m.patient_count || 0), 0) || 0;
        
        const activeSources = monthlyData?.filter(m => m.year_month === monthKey && m.patient_count > 0).length || 0;
        
        monthlyTrends.push({
          month: monthName,
          patients: monthPatients,
          sources: activeSources
        });
      }

      // Geographic insights (mock data for now - could be enhanced with real location analysis)
      const sourcesWithDistance = sources?.filter(s => s.distance_miles) || [];
      const avgDistance = sourcesWithDistance.length > 0 
        ? sourcesWithDistance.reduce((sum, s) => sum + (s.distance_miles || 0), 0) / sourcesWithDistance.length 
        : 0;

      setAnalysisData({
        totalSources: sources?.length || 0,
        activeSourcesThisMonth: activeThisMonth,
        totalPatients,
        avgReferralsPerSource: sources?.length ? Math.round(totalPatients / sources.length) : 0,
        topPerformingSources: sourcePerformance,
        sourceDistribution,
        monthlyTrends,
        geographicInsights: {
          avgDistance: Math.round(avgDistance * 10) / 10,
          primaryArea: 'Local Network',
          coverage: Math.min(100, Math.round((sourcesWithDistance.length / (sources?.length || 1)) * 100))
        }
      });
    } catch (error) {
      console.error('Error processing analysis data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !analysisData) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="space-y-0 pb-2">
              <div className="h-4 bg-muted rounded w-3/4"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-muted rounded w-full"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sources</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysisData.totalSources}</div>
            <p className="text-xs text-muted-foreground">
              {analysisData.activeSourcesThisMonth} active this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysisData.totalPatients}</div>
            <p className="text-xs text-muted-foreground">
              All-time patient referrals
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Per Source</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysisData.avgReferralsPerSource}</div>
            <p className="text-xs text-muted-foreground">
              Referrals per source
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Network Coverage</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysisData.geographicInsights.coverage}%</div>
            <p className="text-xs text-muted-foreground">
              Avg distance: {analysisData.geographicInsights.avgDistance} miles
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trends */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Monthly Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analysisData.monthlyTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="patients" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  name="Patients"
                />
                <Line 
                  type="monotone" 
                  dataKey="sources" 
                  stroke="hsl(var(--secondary))" 
                  strokeWidth={2}
                  name="Active Sources"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Source Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              Source Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analysisData.sourceDistribution}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                  label={({ type, count }) => `${type}: ${count}`}
                >
                  {analysisData.sourceDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Performing Sources */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Top Performing Sources
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analysisData.topPerformingSources.map((source, index) => (
              <div key={source.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="text-sm font-medium text-muted-foreground">#{index + 1}</div>
                  <div>
                    <p className="font-medium">{source.name}</p>
                    <p className="text-sm text-muted-foreground">{source.patients} referrals</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {source.trend === 'up' && <TrendingUp className="h-4 w-4 text-green-500" />}
                  {source.trend === 'down' && <TrendingDown className="h-4 w-4 text-red-500" />}
                  <Badge variant={source.trend === 'up' ? 'default' : 'secondary'}>
                    {source.trend === 'up' ? 'Growing' : 'Declining'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}