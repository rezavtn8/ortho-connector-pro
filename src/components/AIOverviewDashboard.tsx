import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, TrendingUp, MapPin, Shield, CheckSquare, AlertTriangle, BarChart3 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface InsightCard {
  id: string;
  title: string;
  summary: string;
  data: string;
  insight: string;
  action: string;
  priority: 'high' | 'medium' | 'low';
  icon: any;
  trend?: 'up' | 'down' | 'stable';
}

export function AIOverviewDashboard() {
  const [insights, setInsights] = useState<InsightCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasData, setHasData] = useState(false);
  const { user } = useAuth();

  const refreshInsights = async () => {
    if (!user) return;
    
    setLoading(true);
    
    try {
      // Check if user has data
      const [sourcesResult, monthlyResult] = await Promise.all([
        supabase.from('patient_sources').select('count').eq('created_by', user.id),
        supabase.from('monthly_patients').select('count').eq('user_id', user.id)
      ]);

      const hasSourcesData = (sourcesResult.count || 0) > 0;
      const hasMonthlyData = (monthlyResult.count || 0) > 0;
      
      if (!hasSourcesData || !hasMonthlyData) {
        setHasData(false);
        setInsights([]);
        return;
      }

      setHasData(true);

      // Fetch comprehensive data for insights
      const [sources, monthlyData, visits, businessProfile] = await Promise.all([
        supabase.from('patient_sources').select('*').eq('created_by', user.id),
        supabase.from('monthly_patients').select('*').eq('user_id', user.id),
        supabase.from('marketing_visits').select('*').eq('user_id', user.id),
        supabase.functions.invoke('ai-business-context', {
          body: { action: 'get' },
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
        })
      ]);

      const sourcesData = sources.data || [];
      const monthlyDataResults = monthlyData.data || [];
      const visitsData = visits.data || [];

      // Calculate key metrics
      const totalSources = sourcesData.length;
      const activeSources = sourcesData.filter(s => s.is_active).length;
      const totalReferrals = monthlyDataResults.reduce((sum, m) => sum + (m.patient_count || 0), 0);
      
      // Current month referrals
      const currentMonth = new Date().toISOString().slice(0, 7);
      const currentMonthReferrals = monthlyDataResults
        .filter(m => m.year_month === currentMonth)
        .reduce((sum, m) => sum + (m.patient_count || 0), 0);

      // Last 6 months trend
      const last6Months = monthlyDataResults.filter(m => {
        const monthDate = new Date(m.year_month + '-01');
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        return monthDate >= sixMonthsAgo;
      });

      // Source type distribution
      const sourceTypes = sourcesData.reduce((acc, s) => {
        acc[s.source_type] = (acc[s.source_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Top performing source
      const sourcePerformance = sourcesData.map(source => {
        const sourceReferrals = monthlyDataResults
          .filter(m => m.source_id === source.id)
          .reduce((sum, m) => sum + (m.patient_count || 0), 0);
        return { source, referrals: sourceReferrals };
      }).sort((a, b) => b.referrals - a.referrals);

      // Generate insights based on real data
      const generatedInsights: InsightCard[] = [];

      // Insight 1: Source Concentration Risk
      const topSourcePercentage = sourcePerformance[0] ? 
        Math.round((sourcePerformance[0].referrals / totalReferrals) * 100) : 0;
      
      generatedInsights.push({
        id: '1',
        title: 'Source Concentration Analysis',
        summary: `${topSourcePercentage}% of referrals come from your top source, ${sourcePerformance[0]?.source?.name || 'unknown source'}`,
        data: `${sourcePerformance[0]?.referrals || 0} referrals from ${sourcePerformance[0]?.source?.name || 'top source'} (${topSourcePercentage}% of total ${totalReferrals})`,
        insight: topSourcePercentage > 40 ? 'High concentration risk - over-reliance on single source' : 'Healthy distribution across referral sources',
        action: topSourcePercentage > 40 ? 'Diversify referral base by strengthening relationships with 2-3 additional sources' : 'Continue nurturing relationships with top performers',
        priority: topSourcePercentage > 40 ? 'high' : 'low',
        icon: Shield,
        trend: 'stable'
      });

      // Insight 2: Monthly Performance Trend
      const recentReferrals = last6Months.reduce((sum, m) => sum + (m.patient_count || 0), 0);
      const avgMonthlyReferrals = Math.round(recentReferrals / 6);
      
      generatedInsights.push({
        id: '2',
        title: 'Monthly Performance Trends',
        summary: `Currently averaging ${avgMonthlyReferrals} referrals per month over the last 6 months`,
        data: `${recentReferrals} total referrals in last 6 months, ${currentMonthReferrals} this month`,
        insight: currentMonthReferrals > avgMonthlyReferrals ? 'Above average performance this month' : 'Below average performance this month',
        action: currentMonthReferrals > avgMonthlyReferrals ? 'Identify success factors and replicate' : 'Review recent outreach activities and re-engage dormant sources',
        priority: currentMonthReferrals > avgMonthlyReferrals ? 'low' : 'medium',
        icon: TrendingUp,
        trend: currentMonthReferrals > avgMonthlyReferrals ? 'up' : 'down'
      });

      // Insight 3: Source Type Distribution
      const mostCommonType = Object.entries(sourceTypes).sort((a, b) => b[1] - a[1])[0];
      const typePercentage = mostCommonType ? Math.round((mostCommonType[1] / totalSources) * 100) : 0;

      generatedInsights.push({
        id: '3',
        title: 'Source Portfolio Analysis',
        summary: `${typePercentage}% of your ${totalSources} sources are ${mostCommonType?.[0] || 'unknown type'}`,
        data: `${mostCommonType?.[1] || 0} ${mostCommonType?.[0] || 'sources'} out of ${totalSources} total sources (${typePercentage}%)`,
        insight: typePercentage > 60 ? 'Limited diversity in source types may restrict growth potential' : 'Good variety in source types',
        action: typePercentage > 60 ? `Expand into other referral categories beyond ${mostCommonType?.[0]}` : 'Continue balanced approach across source types',
        priority: typePercentage > 60 ? 'medium' : 'low',
        icon: BarChart3,
        trend: 'stable'
      });

      // Insight 4: Geographic Distribution (if location data available)
      const sourcesWithLocation = sourcesData.filter(s => s.address).length;
      if (sourcesWithLocation > 0) {
        generatedInsights.push({
          id: '4',
          title: 'Geographic Coverage',
          summary: `${sourcesWithLocation} of ${totalSources} sources have location data for geographic analysis`,
          data: `${sourcesWithLocation} sources with addresses, ${totalSources - sourcesWithLocation} missing location data`,
          insight: sourcesWithLocation < totalSources ? 'Incomplete location data limits geographic insights' : 'Complete location data enables strategic expansion planning',
          action: sourcesWithLocation < totalSources ? 'Update missing address information for comprehensive analysis' : 'Analyze geographic gaps for expansion opportunities',
          priority: sourcesWithLocation < totalSources * 0.8 ? 'medium' : 'low',
          icon: MapPin,
          trend: 'stable'
        });
      }

      // Insight 5: Marketing Visit Performance (if visit data available)
      if (visitsData.length > 0) {
        const recentVisits = visitsData.filter(v => {
          const visitDate = new Date(v.visit_date);
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          return visitDate >= thirtyDaysAgo;
        }).length;

        generatedInsights.push({
          id: '5',
          title: 'Marketing Activity Status',
          summary: `${recentVisits} marketing visits completed in the last 30 days`,
          data: `${recentVisits} recent visits out of ${visitsData.length} total visits logged`,
          insight: recentVisits > 0 ? 'Active marketing engagement maintained' : 'No recent marketing visits - may impact future referrals',
          action: recentVisits > 0 ? 'Continue consistent outreach schedule' : 'Schedule visits to top sources within next 2 weeks',
          priority: recentVisits > 0 ? 'low' : 'high',
          icon: CheckSquare,
          trend: recentVisits > 0 ? 'up' : 'down'
        });
      }

      setInsights(generatedInsights.slice(0, 6)); // Limit to top 6 insights
      
    } catch (error) {
      console.error('Error generating insights:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate insights. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshInsights();
  }, [user]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300';
      case 'medium': return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300';
      case 'low': return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300';
      default: return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-950/50 dark:text-slate-300';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high': return 'High Risk';
      case 'medium': return 'Monitor';
      case 'low': return 'Good';
      default: return 'Info';
    }
  };

  if (!hasData && !loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">AI Insights Dashboard</h2>
            <p className="text-muted-foreground">Data-driven insights for your practice</p>
          </div>
          <Button onClick={refreshInsights} disabled={loading} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <Card className="border-dashed border-2 border-muted-foreground/20">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Data Available</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              To generate insights, you need referral sources and patient data. Start by adding your referral sources and monthly patient counts.
            </p>
            <Button onClick={refreshInsights} className="bg-primary">
              <RefreshCw className="h-4 w-4 mr-2" />
              Check for Data
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">AI Insights Dashboard</h2>
          <p className="text-muted-foreground">Real-time analysis of your practice performance</p>
        </div>
        <Button onClick={refreshInsights} disabled={loading} variant="outline" className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Analysis
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="h-6 bg-muted rounded w-32"></div>
                  <div className="h-6 w-16 bg-muted rounded-full"></div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="h-4 bg-muted rounded"></div>
                <div className="h-4 bg-muted rounded w-5/6"></div>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded"></div>
                  <div className="h-3 bg-muted rounded w-4/6"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {insights.map((insight) => {
            const IconComponent = insight.icon;
            return (
              <Card 
                key={insight.id} 
                className="hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 bg-gradient-to-br from-background to-background/80"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <IconComponent className="h-5 w-5 text-primary" />
                      </div>
                      <CardTitle className="text-base font-bold leading-tight">
                        {insight.title}
                      </CardTitle>
                    </div>
                    <Badge className={`${getPriorityColor(insight.priority)} text-xs px-2 py-1 rounded-full border`}>
                      {getPriorityLabel(insight.priority)}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4 pt-0">
                  {/* Executive Summary */}
                  <div className="bg-primary/5 p-3 rounded-lg border-l-3 border-primary">
                    <p className="text-sm font-semibold text-foreground leading-relaxed">
                      {insight.summary}
                    </p>
                  </div>

                  {/* Supporting Data */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <BarChart3 className="h-3 w-3" />
                      Data
                    </h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {insight.data}
                    </p>
                  </div>

                  <div className="h-px bg-border"></div>

                  {/* Insight */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      Insight
                    </h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {insight.insight}
                    </p>
                  </div>

                  <div className="h-px bg-border"></div>

                  {/* Action */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <CheckSquare className="h-3 w-3" />
                      Action
                    </h4>
                    <p className="text-sm text-foreground font-medium leading-relaxed">
                      {insight.action}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}