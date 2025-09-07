import React, { useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatYearMonth } from '@/lib/database.types';
import { TrendingUp, Building2, Users, Globe, MessageSquare, BarChart3, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip 
} from 'recharts';
import { useDashboardData } from '@/hooks/useQueryData';
import { SkeletonCard, SkeletonChart } from '@/components/ui/skeleton-card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccessibility, addSkipToMain } from '@/hooks/useAccessibility';
import { AccessibleButton } from '@/components/ui/accessible-button';

interface SourceGroupData {
  name: string;
  icon: React.ElementType;
  count: number;
  totalPatients: number;
  thisMonth: number;
  color: string;
  types: string[];
}

interface DashboardSummary {
  user_id: string;
  source_groups: Array<{
    source_type: string;
    source_count: number;
    active_count: number;
    total_patients: number;
    current_month_patients: number;
  }>;
  monthly_trends: Array<{
    year_month: string;
    month_total: number;
  }>;
}

interface PatientTrendChartProps {
  monthlyTrends: Array<{ year_month: string; month_total: number }>;
}

function PatientTrendChart({ monthlyTrends }: PatientTrendChartProps) {
  const chartData = (monthlyTrends || [])
    .filter(trend => trend && trend.year_month && trend.month_total !== undefined) // Filter out invalid data
    .map(trend => ({
      month: formatYearMonth(trend.year_month),
      patients: trend.month_total || 0
    }));

  // Show empty state if no data
  if (chartData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No trend data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-64" role="img" aria-label="Patient trend chart showing monthly referral data">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis 
            dataKey="month" 
            fontSize={12}
            tickLine={false}
            axisLine={false}
            aria-label="Months"
          />
          <YAxis 
            fontSize={12}
            tickLine={false}
            axisLine={false}
            aria-label="Number of patients"
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px'
            }}
            formatter={(value: number) => [value, 'Patients']}
            labelFormatter={(label: string) => `Month: ${label}`}
          />
          <Line 
            type="monotone" 
            dataKey="patients" 
            stroke="hsl(var(--primary))" 
            strokeWidth={2}
            dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: 'hsl(var(--primary))', strokeWidth: 2 }}
            aria-label="Patient referral trend line"
          />
        </LineChart>
      </ResponsiveContainer>
      {/* Screen reader table alternative */}
      <table className="sr-only">
        <caption>Monthly patient referral data</caption>
        <thead>
          <tr>
            <th>Month</th>
            <th>Patients</th>
          </tr>
        </thead>
        <tbody>
          {chartData.map((data, index) => (
            <tr key={index}>
              <td>{data.month}</td>
              <td>{data.patients}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Dashboard() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { announce } = useAccessibility();
  
  // Add skip to main content
  addSkipToMain();
  
  // Use React Query for dashboard data with background refetch
  const { 
    data: dashboardData, 
    isLoading: loading, 
    error, 
    refetch,
    isFetching 
  } = useDashboardData();

  // Handle errors
  useEffect(() => {
    if (error) {
      announce('Failed to load dashboard data', 'assertive');
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive"
      });
    }
  }, [error, toast, announce]);

  // Announce data loaded
  useEffect(() => {
    if (dashboardData && !loading) {
      announce('Dashboard data loaded successfully');
    }
  }, [dashboardData, loading, announce]);

  const getSourceGroupData = (): SourceGroupData[] => {
    if (!dashboardData?.source_groups) return [];

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
      const groupData = dashboardData.source_groups.filter(sg => group.types.includes(sg.source_type));
      
      return {
        ...group,
        count: groupData.reduce((sum, sg) => sum + sg.source_count, 0),
        totalPatients: groupData.reduce((sum, sg) => sum + sg.total_patients, 0),
        thisMonth: groupData.reduce((sum, sg) => sum + sg.current_month_patients, 0)
      };
    });
  // Ensure we have valid data structure
  const safeSourceGroups = dashboardData?.source_groups || [];
  const safeMonthlyTrends = dashboardData?.monthly_trends || [];
  
  const totalSources = safeSourceGroups.reduce((sum, sg) => sum + (sg.source_count || 0), 0);
  const activeSources = safeSourceGroups.reduce((sum, sg) => sum + (sg.active_count || 0), 0);
  const totalPatients = safeSourceGroups.reduce((sum, sg) => sum + (sg.total_patients || 0), 0);
  const thisMonthPatients = safeSourceGroups.reduce((sum, sg) => sum + (sg.current_month_patients || 0), 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Dashboard
            </h1>
            <p className="text-muted-foreground">Loading your data...</p>
          </div>
          <Skeleton className="h-9 w-24" />
        </div>
        
        {/* Overview Stats Skeletons */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4" role="grid" aria-label="Loading dashboard statistics">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} role="gridcell">
              <CardHeader className="pb-3">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Skeleton className="h-8 w-12" />
                  <Skeleton className="h-8 w-8 rounded" />
                </div>
                <Skeleton className="h-3 w-24 mt-1" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Source Categories Skeletons */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-40" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" role="list" aria-label="Loading source categories">
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} rows={3} />
            ))}
          </div>
        </div>

        {/* Analytics Overview Skeleton */}
        <SkeletonChart />
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Dashboard
            </h1>
            <p className="text-muted-foreground">Error loading dashboard data</p>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Unable to load dashboard</h3>
              <p className="text-muted-foreground mb-4">
                There was an issue loading your dashboard data. Please try refreshing or contact support if the problem persists.
              </p>
              <Button onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Ensure we have valid data structure
  const safeSourceGroups = dashboardData?.source_groups || [];
  const safeMonthlyTrends = dashboardData?.monthly_trends || [];
  
  const totalSources = safeSourceGroups.reduce((sum, sg) => sum + (sg.source_count || 0), 0);
  const activeSources = safeSourceGroups.reduce((sum, sg) => sum + (sg.active_count || 0), 0);
  const totalPatients = safeSourceGroups.reduce((sum, sg) => sum + (sg.total_patients || 0), 0);
  const thisMonthPatients = safeSourceGroups.reduce((sum, sg) => sum + (sg.current_month_patients || 0), 0);

  return (
    <div className="space-y-6">
      {/* Main content landmark */}
      <main id="main-content" role="main">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Dashboard
            </h1>
            <p className="text-muted-foreground" id="dashboard-description">
              Overview of your patient referral sources
            </p>
          </div>
          <div className="flex items-center gap-2" role="toolbar" aria-label="Dashboard actions">
            {isFetching && (
              <div 
                className="flex items-center gap-2 text-sm text-muted-foreground"
                role="status"
                aria-live="polite"
              >
                <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span>Refreshing...</span>
              </div>
            )}
            <AccessibleButton 
              variant="outline" 
              size="sm" 
              onClick={() => {
                refetch();
                announce('Refreshing dashboard data');
              }}
              disabled={isFetching}
              loading={isFetching}
              loadingText="Refreshing data..."
              aria-label="Refresh dashboard data"
              shortcut="R"
            >
              <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
              Refresh
            </AccessibleButton>
          </div>
        </div>

        {/* Overview Stats */}
        <section aria-labelledby="overview-heading">
          <h2 id="overview-heading" className="sr-only">Overview Statistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4" role="grid">
            <Card role="gridcell" tabIndex={0}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Sources
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div 
                    className="text-2xl font-bold" 
                    aria-label={`${totalSources} total sources`}
                  >
                    {totalSources}
                  </div>
                  <Building2 className="w-8 h-8 text-blue-500 opacity-20" aria-hidden="true" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {activeSources} active
                </p>
              </CardContent>
            </Card>

            <Card role="gridcell" tabIndex={0}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Patients
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div 
                    className="text-2xl font-bold"
                    aria-label={`${totalPatients} total patients`}
                  >
                    {totalPatients}
                  </div>
                  <Users className="w-8 h-8 text-green-500 opacity-20" aria-hidden="true" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  All-time referrals
                </p>
              </CardContent>
            </Card>

            <Card role="gridcell" tabIndex={0}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  This Month
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div 
                    className="text-2xl font-bold"
                    aria-label={`${thisMonthPatients} patients this month`}
                  >
                    {thisMonthPatients}
                  </div>
                  <TrendingUp className="w-8 h-8 text-orange-500 opacity-20" aria-hidden="true" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Current month
                </p>
              </CardContent>
            </Card>

            <Card 
              role="gridcell"
              tabIndex={0}
              className="cursor-pointer hover:shadow-lg transition-all duration-200 focus:ring-2 focus:ring-ring focus:ring-offset-2"
              onClick={() => navigate('/analytics')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate('/analytics');
                }
              }}
              aria-label="View detailed analytics and reports"
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Reports
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold">View</div>
                  <BarChart3 className="w-8 h-8 text-purple-500 opacity-20" aria-hidden="true" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Analytics & insights
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Source Categories */}
        <section aria-labelledby="source-categories-heading">
          <h2 id="source-categories-heading" className="text-xl font-semibold mb-4">
            Source Categories
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" role="list">
            {getSourceGroupData().map((group) => (
              <Card 
                key={group.name}
                role="listitem"
                tabIndex={0}
                className="cursor-pointer hover:shadow-lg transition-all duration-200 border-l-4 border-l-transparent hover:border-l-current focus:ring-2 focus:ring-ring focus:ring-offset-2"
                onClick={() => {
                  if (group.name === 'Dental Offices') {
                    navigate('/offices');
                  } else {
                    navigate('/sources');
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (group.name === 'Dental Offices') {
                      navigate('/offices');
                    } else {
                      navigate('/sources');
                    }
                  }
                }}
                aria-label={`${group.name}: ${group.count} sources, ${group.totalPatients} total patients, ${group.thisMonth} this month`}
              >
                <CardHeader className="pb-3">
                  <CardTitle className={`text-lg flex items-center gap-2 ${group.color}`}>
                    <group.icon className="w-5 h-5" aria-hidden="true" />
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
        </section>

        {/* Analytics Overview */}
        <section aria-labelledby="analytics-heading">
          <div className="flex justify-between items-center mb-4">
            <h2 id="analytics-heading" className="text-xl font-semibold">
              Analytics Overview
            </h2>
            <AccessibleButton 
              variant="outline"
              onClick={() => navigate('/analytics')}
              className="gap-2"
              aria-label="View full analytics reports"
            >
              <BarChart3 className="w-4 h-4" aria-hidden="true" />
              View Full Reports
            </AccessibleButton>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" aria-hidden="true" />
                Patient Trends (Last 6 Months)
              </CardTitle>
              <CardDescription>
                Monthly patient referral trends across all sources
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PatientTrendChart monthlyTrends={dashboardData?.monthly_trends || []} />
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

export default Dashboard;