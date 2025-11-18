import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatYearMonth } from '@/lib/database.types';
import { getCurrentYearMonth } from '@/lib/dateSync';
import { 
  Home,
  TrendingUp,
  Users, 
  Building2,
  Globe,
  MessageSquare,
  BarChart3
} from 'lucide-react';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip 
} from 'recharts';
import { useDashboardData, useDashboardStats } from '@/hooks/useDashboardData';
import { ResilientErrorBoundary } from '@/components/ResilientErrorBoundary';
import { useNavigate } from 'react-router-dom';

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
  monthlyData: Array<{
    year_month: string;
    patient_count: number;
  }>;
}

function PatientTrendChart({ monthlyData }: PatientTrendChartProps) {
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

function DashboardContent() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useDashboardData();
  const stats = useDashboardStats();
  const currentMonth = getCurrentYearMonth();

  // Memoized calculations for better performance
  const getSourceGroupData = useMemo((): SourceGroupData[] => {
    // Phase 1: Comprehensive null safety checks
    if (!data || !data.sources || !data.monthlyData) return [];
    
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
      // Phase 2: Safe array operations with fallbacks
      const groupSources = (data.sources || []).filter(source => 
        group.types.includes(source.source_type)
      );
      const sourceIds = groupSources.map(s => s.id);
      
      const groupMonthlyData = (data.monthlyData || []).filter(m => 
        sourceIds.includes(m.source_id)
      );
      const thisMonthData = groupMonthlyData.filter(m => 
        m.year_month === currentMonth
      );
      
      return {
        ...group,
        count: groupSources.length,
        totalPatients: groupMonthlyData.reduce((sum, m) => sum + m.patient_count, 0),
        thisMonth: thisMonthData.reduce((sum, m) => sum + m.patient_count, 0)
      };
    });
  }, [data, currentMonth]);

  if (isLoading || !stats) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col space-y-3 mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Home className="h-8 w-8 title-icon" />
            <h1 className="text-4xl font-bold page-title">Dashboard</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Loading your patient referral data...
          </p>
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
      <div className="flex flex-col space-y-3 mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Home className="h-8 w-8 title-icon" />
          <h1 className="text-4xl font-bold page-title">Dashboard</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Your practice overview and key performance indicators
        </p>
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
            <PatientTrendChart monthlyData={data?.monthlyData || []} />
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
              Recent Activity
            </CardTitle>
            <CardDescription>
              Latest patient count updates from your sources
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data?.recentActivity.length === 0 ? (
                <div className="text-center py-8">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No recent activity to display</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Start adding patient counts to see updates here
                  </p>
                </div>
              ) : (
                data?.recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between p-3 bg-card rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        {activity.source_type === 'Office' ? (
                          <Building2 className="h-4 w-4 text-primary" />
                        ) : activity.source_type === 'Google' || activity.source_type === 'Yelp' ? (
                          <Globe className="h-4 w-4 text-primary" />
                        ) : (
                          <MessageSquare className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{activity.source_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatYearMonth(activity.year_month)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{activity.patient_count} patients</p>
                      <p className="text-xs text-muted-foreground">
                        Updated {new Date(activity.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function Dashboard() {
  return (
    <ResilientErrorBoundary showNetworkStatus>
      <DashboardContent />
    </ResilientErrorBoundary>
  );
}