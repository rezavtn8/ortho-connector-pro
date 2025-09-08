import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PatientSource, MonthlyPatients, getCurrentYearMonth, formatYearMonth } from '@/lib/database.types';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, Building2, Users, Globe, MessageSquare, BarChart3 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { usePagination } from '@/hooks/usePagination';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import { Skeleton } from '@/components/ui/skeleton';
import { useOptimizedArray } from '@/hooks/useOptimizedState';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { useCleanup } from '@/hooks/useCleanup';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip 
} from 'recharts';

interface SourceGroupData {
  name: string;
  icon: React.ElementType;
  count: number;
  totalPatients: number;
  thisMonth: number;
  color: string;
  types: string[];
}

interface PatientTrendChartProps {
  monthlyData: MonthlyPatients[];
  sources: PatientSource[];
}

function PatientTrendChart({ monthlyData, sources }: PatientTrendChartProps) {
  // Get last 6 months of data
  const now = new Date();
  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
  });

  const chartData = last6Months.map(yearMonth => {
    const monthTotal = monthlyData
      .filter(data => data.year_month === yearMonth)
      .reduce((sum, data) => sum + data.patient_count, 0);

    return {
      month: formatYearMonth(yearMonth),
      patients: monthTotal
    };
  });

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis 
            dataKey="month" 
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px'
            }}
          />
          <Line 
            type="monotone" 
            dataKey="patients" 
            stroke="hsl(var(--primary))" 
            strokeWidth={2}
            dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: 'hsl(var(--primary))', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Dashboard() {
  const { 
    array: sources, 
    replaceArray: setSources 
  } = useOptimizedArray<PatientSource>();
  
  const { 
    array: monthlyData, 
    replaceArray: setMonthlyData 
  } = useOptimizedArray<MonthlyPatients>();
  
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { safeSetTimeout } = useCleanup();
  const currentMonth = getCurrentYearMonth();

  // Paginated recent activity
  const recentActivity = usePagination({
    tableName: 'monthly_patients',
    pageSize: 10,
    selectFields: `
      *,
      patient_sources!inner(
        name,
        source_type
      )
    `,
    orderBy: { column: 'updated_at', ascending: false },
    filters: {}
  });

  // Optimized data loading with cleanup and realtime subscriptions
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Use Promise.allSettled for better error handling
      const [sourcesResult, monthlyResult, allMonthlyResult] = await Promise.allSettled([
        supabase.from('patient_sources').select('*').order('name'),
        supabase.from('monthly_patients').select('*').eq('year_month', currentMonth),
        supabase.from('monthly_patients').select('*')
      ]);

      // Handle sources data
      if (sourcesResult.status === 'fulfilled' && !sourcesResult.value.error) {
        setSources(sourcesResult.value.data || []);
      } else if (sourcesResult.status === 'rejected' || sourcesResult.value.error) {
        console.error('Sources error:', sourcesResult);
        setSources([]);
      }

      // Handle monthly data
      if (allMonthlyResult.status === 'fulfilled' && !allMonthlyResult.value.error) {
        setMonthlyData(allMonthlyResult.value.data || []);
      } else if (allMonthlyResult.status === 'rejected' || allMonthlyResult.value.error) {
        console.error('Monthly data error:', allMonthlyResult);
        setMonthlyData([]);
      }

    } catch (error: any) {
      console.error('Dashboard error:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      });
      setSources([]);
      setMonthlyData([]);
    } finally {
      setLoading(false);
    }
  }, [currentMonth, setSources, setMonthlyData, toast]);

  // Handle realtime updates
  const handleRealtimeUpdate = useCallback(() => {
    console.log('Dashboard: Realtime update received');
    safeSetTimeout(() => {
      loadData();
      recentActivity.refresh();
    }, 100); // Debounce updates
  }, [loadData, recentActivity, safeSetTimeout]);

  // Set up realtime subscriptions
  useRealtimeSubscription({
    subscriptions: [
      { table: 'patient_sources' },
      { table: 'monthly_patients' }
    ],
    onUpdate: handleRealtimeUpdate,
    channelName: 'dashboard-updates'
  });

  // Initial data load
  useEffect(() => {
    loadData();
    recentActivity.loadPage(0, true);
  }, [loadData]);


  // Memoized calculations for better performance
  const getSourceGroupData = useMemo((): SourceGroupData[] => {
    const groups = [
      {
        name: 'Dental Offices',
        icon: Building2,
        color: 'text-purple-600',
        types: ['Office']
      },
      {
        name: 'Online Sources',
        icon: Globe,
        color: 'text-blue-600',
        types: ['Google', 'Yelp']
      },
      {
        name: 'Other Sources',
        icon: MessageSquare,
        color: 'text-orange-600',
        types: ['Website', 'Social Media', 'Word of Mouth', 'Insurance', 'Other']
      }
    ];

    return groups.map(group => {
      const groupSources = sources.filter(source => group.types.includes(source.source_type));
      const sourceIds = groupSources.map(s => s.id);
      
      const groupMonthlyData = monthlyData.filter(m => sourceIds.includes(m.source_id));
      const thisMonthData = groupMonthlyData.filter(m => m.year_month === currentMonth);
      
      return {
        ...group,
        count: groupSources.length,
        totalPatients: groupMonthlyData.reduce((sum, m) => sum + m.patient_count, 0),
        thisMonth: thisMonthData.reduce((sum, m) => sum + m.patient_count, 0)
      };
    });
  }, [sources, monthlyData, currentMonth]);

  // Memoized stats calculations
  const stats = useMemo(() => ({
    totalSources: sources.length,
    activeSources: sources.filter(source => source.is_active).length,
    totalPatients: monthlyData.reduce((sum, m) => sum + m.patient_count, 0),
    thisMonthPatients: monthlyData
      .filter(m => m.year_month === currentMonth)
      .reduce((sum, m) => sum + m.patient_count, 0)
  }), [sources, monthlyData, currentMonth]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Dashboard
            </h1>
            <p className="text-muted-foreground">Loading your patient referral data...</p>
          </div>
        </div>
        
        {/* Overview Stats Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} variant="metric" />
          ))}
        </div>

        {/* Source Categories Skeleton */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} variant="dashboard" />
            ))}
          </div>
        </div>

        {/* Analytics Skeleton */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-10 w-48" />
          </div>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5" />
                <Skeleton className="h-6 w-64" />
              </div>
              <Skeleton className="h-4 w-96" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity Skeleton */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5" />
                <Skeleton className="h-6 w-48" />
              </div>
              <Skeleton className="h-4 w-72" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonCard key={i} variant="activity" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Dashboard
          </h1>
          <p className="text-muted-foreground">
            Overview of your patient referral sources
          </p>
        </div>
      </div>

      {/* Mobile-optimized Overview Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              Total Sources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-xl sm:text-2xl font-bold">{stats.totalSources}</div>
              <Building2 className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500 opacity-20" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.activeSources} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              Total Patients
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-xl sm:text-2xl font-bold">{stats.totalPatients}</div>
              <Users className="w-6 h-6 sm:w-8 sm:h-8 text-green-500 opacity-20" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              All-time referrals
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-xl sm:text-2xl font-bold">{stats.thisMonthPatients}</div>
              <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-orange-500 opacity-20" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Current month
            </p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-lg transition-all duration-200"
          onClick={() => navigate('/analytics')}
        >
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-xl sm:text-2xl font-bold">View</div>
              <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 text-purple-500 opacity-20" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Analytics & insights
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Source Categories */}
      <div className="space-y-4">
        <h2 className="text-lg sm:text-xl font-semibold">Source Categories</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {getSourceGroupData.map((group) => (
            <Card 
              key={group.name}
              className="cursor-pointer hover:shadow-lg transition-all duration-200 border-l-4 border-l-transparent hover:border-l-current"
              onClick={() => {
                if (group.name === 'Dental Offices') {
                  navigate('/offices');
                } else {
                  navigate('/sources');
                }
              }}
            >
              <CardHeader className="pb-3">
                <CardTitle className={`text-lg flex items-center gap-2 ${group.color}`}>
                  <group.icon className="w-5 h-5" />
                  {group.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Sources:</span>
                    <span className="font-semibold">{group.count}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Patients:</span>
                    <span className="font-semibold">{group.totalPatients}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">This Month:</span>
                    <span className="font-semibold text-primary">{group.thisMonth}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Analytics Overview */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg sm:text-xl font-semibold">Analytics Overview</h2>
          <Button 
            variant="outline"
            onClick={() => navigate('/analytics')}
            className="gap-2"
          >
            <BarChart3 className="w-4 h-4" />
            View Full Reports
          </Button>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Patient Trends (Last 6 Months)
            </CardTitle>
            <CardDescription>
              Monthly patient referral trends across all sources
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PatientTrendChart monthlyData={monthlyData} sources={sources} />
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="space-y-4">
        <h2 className="text-lg sm:text-xl font-semibold">Recent Activity</h2>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Recent Patient Updates
            </CardTitle>
            <CardDescription>
              Latest changes to patient counts across all sources
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivity.data.length === 0 && !recentActivity.loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  No recent activity to display
                </div>
              ) : (
                recentActivity.data.map((activity: any) => (
                  <div key={activity.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">
                        {activity.patient_sources?.name || 'Unknown Source'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {activity.patient_sources?.source_type} • {formatYearMonth(activity.year_month)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-primary">
                        {activity.patient_count} patients
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(activity.updated_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
              
              {recentActivity.hasMore && (
                <div className="flex justify-center pt-4">
                  <Button 
                    onClick={recentActivity.loadMore} 
                    disabled={recentActivity.loading}
                    variant="outline"
                    className="gap-2"
                  >
                    {recentActivity.loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>Load More Activity</>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}