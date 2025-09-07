import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatYearMonth } from '@/lib/database.types';
import { supabase } from '@/integrations/supabase/client';
import { Search, TrendingUp, Building2, Star, Users, Globe, MessageSquare, FileText, BarChart3 } from 'lucide-react';
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
  const chartData = (monthlyTrends || []).map(trend => ({
    month: formatYearMonth(trend.year_month),
    patients: trend.month_total
  }));

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
  const [dashboardData, setDashboardData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
    
    // Set up real-time subscriptions
    const sourcesChannel = supabase
      .channel('sources-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'patient_sources'
        },
        (payload) => {
          console.log('Sources change:', payload);
          loadData(); // Reload all data when sources change
        }
      )
      .subscribe();

    const monthlyChannel = supabase
      .channel('monthly-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'monthly_patients'
        },
        (payload) => {
          console.log('Monthly data change:', payload);
          loadData(); // Reload all data when monthly data changes
        }
      )
      .subscribe();

    // Cleanup subscriptions on unmount
    return () => {
      supabase.removeChannel(sourcesChannel);
      supabase.removeChannel(monthlyChannel);
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Use the optimized function to get all dashboard data in one query
      const { data, error } = await supabase.rpc('get_dashboard_data');

      if (error) throw error;
      
      if (data && data.length > 0 && data[0].summary) {
        const summary = data[0].summary;
        if (typeof summary === 'object' && summary !== null && !Array.isArray(summary)) {
          setDashboardData((summary as unknown) as DashboardSummary);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

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
  };

  const totalSources = dashboardData?.source_groups?.reduce((sum, sg) => sum + sg.source_count, 0) || 0;
  const activeSources = dashboardData?.source_groups?.reduce((sum, sg) => sum + sg.active_count, 0) || 0;
  const totalPatients = dashboardData?.source_groups?.reduce((sum, sg) => sum + sg.total_patients, 0) || 0;
  const thisMonthPatients = dashboardData?.source_groups?.reduce((sum, sg) => sum + sg.current_month_patients, 0) || 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <CardTitle className="text-lg">
                  <div className="h-4 bg-muted rounded animate-pulse w-24"></div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded animate-pulse w-16 mb-2"></div>
                <div className="h-3 bg-muted rounded animate-pulse w-32"></div>
              </CardContent>
            </Card>
          ))}
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

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Sources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{totalSources}</div>
              <Building2 className="w-8 h-8 text-blue-500 opacity-20" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {activeSources} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Patients
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{totalPatients}</div>
              <Users className="w-8 h-8 text-green-500 opacity-20" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              All-time referrals
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{thisMonthPatients}</div>
              <TrendingUp className="w-8 h-8 text-orange-500 opacity-20" />
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
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">View</div>
              <BarChart3 className="w-8 h-8 text-purple-500 opacity-20" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Analytics & insights
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Source Categories */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Source Categories</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {getSourceGroupData().map((group) => (
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
          <h2 className="text-xl font-semibold">Analytics Overview</h2>
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
            <PatientTrendChart monthlyTrends={dashboardData?.monthly_trends || []} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}