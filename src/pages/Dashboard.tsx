import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PatientSource, MonthlyPatients, SOURCE_TYPE_CONFIG, getCurrentYearMonth } from '@/lib/database.types';
import { supabase } from '@/integrations/supabase/client';
import { Search, Plus, TrendingUp, Building2, Star, Users, Globe, MessageSquare, FileText, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { MapView } from '@/components/MapView';

interface SourceGroupData {
  name: string;
  icon: React.ElementType;
  count: number;
  totalPatients: number;
  thisMonth: number;
  color: string;
  types: string[];
}

export function Dashboard() {
  const [sources, setSources] = useState<PatientSource[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyPatients[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();
  const currentMonth = getCurrentYearMonth();

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
      
      // Load patient sources
      const { data: sourcesData, error: sourcesError } = await supabase
        .from('patient_sources')
        .select('*')
        .order('name');

      if (sourcesError) throw sourcesError;

      // Load monthly data for current month
      const { data: monthlyDataResult, error: monthlyError } = await supabase
        .from('monthly_patients')
        .select('*')
        .eq('year_month', currentMonth);

      if (monthlyError) throw monthlyError;

      // Load all-time monthly data for totals
      const { data: allMonthlyData, error: allMonthlyError } = await supabase
        .from('monthly_patients')
        .select('*');

      if (allMonthlyError) throw allMonthlyError;

      setSources(sourcesData || []);
      setMonthlyData(allMonthlyData || []);
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
    const groups = [
      {
        name: 'Google Referrals',
        icon: Search,
        color: 'text-green-600',
        types: ['Google']
      },
      {
        name: 'Yelp Reviews',
        icon: Star,
        color: 'text-red-600',
        types: ['Yelp']
      },
      {
        name: 'Online Sources',
        icon: Globe,
        color: 'text-blue-600',
        types: ['Website', 'Social Media']
      },
      {
        name: 'Dental Offices',
        icon: Building2,
        color: 'text-purple-600',
        types: ['Office']
      },
      {
        name: 'Other Sources',
        icon: MessageSquare,
        color: 'text-orange-600',
        types: ['Word of Mouth', 'Insurance', 'Other']
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
  };

  const totalSources = sources.length;
  const activeSources = sources.filter(source => source.is_active).length;
  const totalPatients = monthlyData.reduce((sum, m) => sum + m.patient_count, 0);
  const thisMonthPatients = monthlyData
    .filter(m => m.year_month === currentMonth)
    .reduce((sum, m) => sum + m.patient_count, 0);

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
        <Button 
          onClick={() => navigate('/sources')}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Manage Sources
        </Button>
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

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Sources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{activeSources}</div>
              <FileText className="w-8 h-8 text-purple-500 opacity-20" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently active
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
              onClick={() => navigate('/sources')}
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

      {/* Geographic Overview */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Office Locations
          </h2>
          <Button variant="outline" onClick={() => navigate('/marketing-visits')}>
            View Marketing Activities
          </Button>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Geographic Distribution</CardTitle>
            <CardDescription>
              Overview of your office network and referral sources
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MapView 
              showVisitData={true}
              height="350px"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}