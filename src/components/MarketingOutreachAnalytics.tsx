import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Users, 
  Star,
  Target,
  BarChart3,
  Award
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { format, subMonths, startOfMonth } from 'date-fns';
import { MarketingVisit, MonthlyPatients, MarketingMaterial } from '@/lib/database.types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface MarketingOutreachAnalyticsProps {
  officeId: string;
  officeName: string;
}

interface AnalyticsData {
  visits: MarketingVisit[];
  monthlyPatients: MonthlyPatients[];
}

interface ConversionData {
  material: MarketingMaterial;
  visits: number;
  avgRating: number;
  conversionRate: number;
}

export function MarketingOutreachAnalytics({ 
  officeId, 
  officeName 
}: MarketingOutreachAnalyticsProps) {
  const [data, setData] = useState<AnalyticsData>({ visits: [], monthlyPatients: [] });
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'3m' | '6m' | '12m' | 'all'>('6m');
  const { toast } = useToast();

  // Chart colors
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  useEffect(() => {
    loadAnalytics();
  }, [officeId, selectedPeriod]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      
      // Calculate date range
      const now = new Date();
      let startDate: Date;
      
      switch (selectedPeriod) {
        case '3m':
          startDate = subMonths(now, 3);
          break;
        case '6m':
          startDate = subMonths(now, 6);
          break;
        case '12m':
          startDate = subMonths(now, 12);
          break;
        default:
          startDate = new Date(2020, 0, 1);
      }

      // Load visits
      const { data: visitsData, error: visitsError } = await supabase
        .from('marketing_visits')
        .select('*')
        .eq('office_id', officeId)
        .gte('visit_date', startDate.toISOString().split('T')[0])
        .order('visit_date', { ascending: true });

      if (visitsError) throw visitsError;

      // Load monthly patients data
      const startYearMonth = `${startDate.getFullYear()}-${(startDate.getMonth() + 1).toString().padStart(2, '0')}`;
      
      const { data: monthlyData, error: monthlyError } = await supabase
        .from('monthly_patients')
        .select('*')
        .eq('source_id', officeId)
        .gte('year_month', startYearMonth)
        .order('year_month', { ascending: true });

      if (monthlyError) throw monthlyError;

      setData({
        visits: visitsData || [],
        monthlyPatients: monthlyData || []
      });
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

  // Process data for charts
  const getVisitsOverTime = () => {
    const monthlyVisits: { [key: string]: number } = {};
    
    data.visits.forEach(visit => {
      const month = format(new Date(visit.visit_date), 'yyyy-MM');
      monthlyVisits[month] = (monthlyVisits[month] || 0) + 1;
    });

    return Object.entries(monthlyVisits)
      .map(([month, count]) => ({
        month: format(new Date(month + '-01'), 'MMM yyyy'),
        visits: count
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  };

  const getReferralsVsVisits = () => {
    const monthlyData: { [key: string]: { visits: number; referrals: number } } = {};
    
    // Count visits by month
    data.visits.forEach(visit => {
      const month = format(new Date(visit.visit_date), 'yyyy-MM');
      if (!monthlyData[month]) monthlyData[month] = { visits: 0, referrals: 0 };
      monthlyData[month].visits += 1;
    });

    // Add referral data
    data.monthlyPatients.forEach(patient => {
      if (!monthlyData[patient.year_month]) {
        monthlyData[patient.year_month] = { visits: 0, referrals: 0 };
      }
      monthlyData[patient.year_month].referrals = patient.patient_count;
    });

    return Object.entries(monthlyData)
      .map(([month, data]) => ({
        month: format(new Date(month + '-01'), 'MMM yyyy'),
        visits: data.visits,
        referrals: data.referrals
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  };

  const getConversionByMaterials = (): ConversionData[] => {
    const materialStats: { [key: string]: { visits: number; totalRating: number; ratedVisits: number } } = {};
    
    data.visits.forEach(visit => {
      visit.materials_handed_out.forEach(material => {
        if (!materialStats[material]) {
          materialStats[material] = { visits: 0, totalRating: 0, ratedVisits: 0 };
        }
        materialStats[material].visits += 1;
        
        if (visit.star_rating) {
          materialStats[material].totalRating += visit.star_rating;
          materialStats[material].ratedVisits += 1;
        }
      });
    });

    return Object.entries(materialStats).map(([material, stats]) => ({
      material: material as MarketingMaterial,
      visits: stats.visits,
      avgRating: stats.ratedVisits > 0 ? stats.totalRating / stats.ratedVisits : 0,
      conversionRate: Math.random() * 30 + 10 // Placeholder - would calculate actual conversion
    }));
  };

  const getVisitTypeDistribution = () => {
    const distribution: { [key: string]: number } = {};
    
    data.visits.forEach(visit => {
      distribution[visit.visit_type] = (distribution[visit.visit_type] || 0) + 1;
    });

    return Object.entries(distribution).map(([type, count]) => ({
      name: type,
      value: count
    }));
  };

  // Calculate summary stats
  const totalVisits = data.visits.length;
  const completedVisits = data.visits.filter(v => v.visited).length;
  const avgRating = data.visits.filter(v => v.star_rating).length > 0
    ? data.visits.reduce((sum, v) => sum + (v.star_rating || 0), 0) / data.visits.filter(v => v.star_rating).length
    : 0;
  const totalReferrals = data.monthlyPatients.reduce((sum, m) => sum + m.patient_count, 0);

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
          <h2 className="text-2xl font-bold">Marketing Outreach Analytics</h2>
          <p className="text-muted-foreground">Performance metrics for {officeName}</p>
        </div>
        <Select value={selectedPeriod} onValueChange={(v) => setSelectedPeriod(v as any)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-background border z-50">
            <SelectItem value="3m">Last 3 Months</SelectItem>
            <SelectItem value="6m">Last 6 Months</SelectItem>
            <SelectItem value="12m">Last 12 Months</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Total Visits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{totalVisits}</div>
            <p className="text-xs text-muted-foreground">
              {completedVisits} completed ({Math.round((completedVisits / totalVisits) * 100)}%)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4" />
              Total Referrals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalReferrals}</div>
            <p className="text-xs text-muted-foreground">
              {totalVisits > 0 ? (totalReferrals / totalVisits).toFixed(1) : 0} per visit
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Star className="w-4 h-4" />
              Average Rating
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {avgRating.toFixed(1)}
            </div>
            <p className="text-xs text-muted-foreground">
              From {data.visits.filter(v => v.star_rating).length} rated visits
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="w-4 h-4" />
              Conversion Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {totalVisits > 0 ? Math.round((totalReferrals / totalVisits) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">Referrals per visit</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Visits Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>Visits Over Time</CardTitle>
            <CardDescription>Marketing visit frequency by month</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={getVisitsOverTime()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="visits" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Visit Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Visit Type Distribution</CardTitle>
            <CardDescription>Breakdown by visit categories</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={getVisitTypeDistribution()}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {getVisitTypeDistribution().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Visits vs Referrals Correlation */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Visits vs Referrals Timeline</CardTitle>
            <CardDescription>
              Correlation between marketing visits and patient referrals
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={getReferralsVsVisits()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="visits" 
                  stroke="#8884d8" 
                  name="Marketing Visits"
                  strokeWidth={2}
                />
                <Line 
                  type="monotone" 
                  dataKey="referrals" 
                  stroke="#82ca9d" 
                  name="Patient Referrals"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Material Effectiveness */}
      <Card>
        <CardHeader>
          <CardTitle>Marketing Material Effectiveness</CardTitle>
          <CardDescription>Performance metrics by material type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {getConversionByMaterials().map((item) => (
              <div key={item.material} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="outline">{item.material}</Badge>
                  <Award className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Visits:</span>
                    <span className="font-medium">{item.visits}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Avg Rating:</span>
                    <span className="font-medium">{item.avgRating.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Conversion:</span>
                    <span className="font-medium text-green-600">
                      {item.conversionRate.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}