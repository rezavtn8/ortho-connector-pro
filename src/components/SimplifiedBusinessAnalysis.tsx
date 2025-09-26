import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Play, 
  RefreshCw, 
  Clock, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2,
  BarChart3,
  Loader2,
  Users,
  Building2,
  Calendar,
  Target,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format, subMonths } from 'date-fns';

interface BusinessInsight {
  title: string;
  priority: 'high' | 'medium' | 'low';
  summary: string;
  recommendation: string;
  detailedAnalysis: string;
  keyMetrics: string[];
  actionItems: string[];
  icon: React.ComponentType<any>;
}

interface AnalysisCache {
  id: string;
  generated_text: string;
  created_at: string;
  metadata?: any;
}

export function SimplifiedBusinessAnalysis() {
  const { user } = useAuth();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [insights, setInsights] = useState<BusinessInsight[]>([]);
  const [cachedAnalysis, setCachedAnalysis] = useState<AnalysisCache | null>(null);
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCachedAnalysis();
  }, [user]);

  const loadCachedAnalysis = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('ai_generated_content')
        .select('*')
        .eq('user_id', user.id)
        .eq('content_type', 'business_analysis')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error loading cached analysis:', error);
        return;
      }

      if (data) {
        setCachedAnalysis(data);
        setLastRun(new Date(data.created_at));
        
        try {
          const parsed = JSON.parse(data.generated_text);
          if (parsed.insights && Array.isArray(parsed.insights)) {
            setInsights(parsed.insights.map((insight: any) => ({
              ...insight,
              keyMetrics: insight.keyMetrics || [],
              actionItems: insight.actionItems || [],
              icon: getInsightIcon(insight.title)
            })));
          }
        } catch {
          // If parsing fails, create a simple insight from the text
          setInsights([{
            title: "Business Analysis",
            priority: "medium" as const,
            summary: data.generated_text.substring(0, 150) + "...",
            recommendation: "Review the full analysis details.",
            detailedAnalysis: data.generated_text,
            keyMetrics: ["Analysis Available", "Generated from Cache", "Full Report Ready"],
            actionItems: ["Review the complete analysis", "Take action on recommendations", "Schedule follow-up analysis"],
            icon: BarChart3
          }]);
        }
      }
    } catch (error) {
      console.error('Failed to load cached analysis:', error);
    }
  };

  const runDirectAnalysis = async () => {
    if (!user) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      console.log('Starting direct business analysis...');

      // Get practice data directly from database
      const [sourcesResult, patientsResult, visitsResult] = await Promise.all([
        supabase
          .from('patient_sources')
          .select('*')
          .eq('created_by', user.id),
        supabase
          .from('monthly_patients')
          .select('*')
          .eq('user_id', user.id),
        supabase
          .from('marketing_visits')
          .select('*')
          .eq('user_id', user.id)
      ]);

      // Handle database errors gracefully
      if (sourcesResult.error || patientsResult.error || visitsResult.error) {
        console.error('Database query errors:', {
          sources: sourcesResult.error,
          patients: patientsResult.error,
          visits: visitsResult.error
        });
        
        // Generate offline analysis if data queries fail
        return generateOfflineAnalysis();
      }

      const sources = sourcesResult.data || [];
      const patients = patientsResult.data || [];
      const visits = visitsResult.data || [];

      console.log('Data loaded successfully:', { 
        sources: sources.length, 
        patients: patients.length, 
        visits: visits.length 
      });

      // Generate insights directly without AI (as fallback)
      const generatedInsights = generateDirectInsights(sources, patients, visits);
      
      // Try to enhance with AI if possible
      let aiEnhancedInsights = generatedInsights;
      
      try {
        const aiResponse = await callOptimizedAI(sources, patients, visits);
        if (aiResponse?.insights && Array.isArray(aiResponse.insights)) {
          aiEnhancedInsights = aiResponse.insights.map((insight: any) => ({
            ...insight,
            icon: getInsightIcon(insight.title)
          }));
        }
      } catch (aiError) {
        console.warn('AI enhancement failed, using direct analysis:', aiError);
        // Continue with direct insights
      }

      // Cache the results
      const analysisText = JSON.stringify({ 
        insights: aiEnhancedInsights,
        generated_at: new Date().toISOString(),
        method: 'enhanced'
      });

      await supabase
        .from('ai_generated_content')
        .insert({
          user_id: user.id,
          content_type: 'business_analysis',
          generated_text: analysisText,
          status: 'generated',
          metadata: { 
            method: 'enhanced',
            data_points: {
              sources: sources.length,
              patients: patients.length,
              visits: visits.length
            }
          },
        });

      setInsights(aiEnhancedInsights);
      setLastRun(new Date());

      toast({
        title: "Analysis Complete",
        description: `Generated ${aiEnhancedInsights.length} business insights successfully.`,
      });

    } catch (error: any) {
      console.error('Analysis failed:', error);
      setError(error.message);
      
      // Generate basic offline analysis as ultimate fallback
      const fallbackInsights = generateOfflineAnalysis();
      setInsights(fallbackInsights);
      
      toast({
        title: "Analysis Completed (Offline Mode)",
        description: "Generated basic analysis using available data.",
        variant: "default",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateDirectInsights = (sources: any[], patients: any[], visits: any[]) => {
    const insights: BusinessInsight[] = [];

    // Source Distribution Analysis
    const totalSources = sources.length;
    const activeSources = sources.filter(s => s.is_active).length;
    const inactiveSources = totalSources - activeSources;
    const sourceTypes = sources.reduce((acc, s) => {
      acc[s.source_type] = (acc[s.source_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const activeRate = Math.round((activeSources/(totalSources || 1))*100);
    
    insights.push({
      title: "Referral Network Analysis",
      priority: totalSources < 5 ? 'high' : totalSources < 15 ? 'medium' : 'low',
      summary: `${totalSources} referral sources with ${activeRate}% active engagement rate`,
      recommendation: totalSources < 10 ? 
        "Expand your referral network to reduce dependency risks" : 
        "Maintain regular communication with your strong network",
      detailedAnalysis: `Your practice currently manages ${totalSources} referral sources, of which ${activeSources} are actively contributing referrals (${activeRate}% engagement rate). ${inactiveSources > 0 ? `${inactiveSources} sources appear inactive and may benefit from re-engagement efforts.` : 'All sources are currently active, indicating strong relationship management.'} The distribution across source types shows: ${Object.entries(sourceTypes).map(([type, count]) => `${type}: ${count} sources`).join(', ')}. ${totalSources < 10 ? 'A network of fewer than 10 sources creates vulnerability to referral fluctuations.' : 'Your network size provides good stability against individual source variations.'}`,
      keyMetrics: [
        `${totalSources} Total Sources`,
        `${activeRate}% Active Rate`,
        `${Object.keys(sourceTypes).length} Source Types`,
        `${inactiveSources} Inactive Sources`
      ],
      actionItems: [
        totalSources < 10 ? "Identify and cultivate 3-5 new referral sources" : "Maintain quarterly check-ins with all sources",
        inactiveSources > 0 ? `Re-engage ${inactiveSources} inactive sources with targeted outreach` : "Continue current engagement strategies",
        "Track monthly referral patterns to identify trending sources",
        "Develop source-specific communication strategies based on preferences"
      ],
      icon: Building2
    });

    // Performance Trends
    const totalPatients = patients.reduce((sum, p) => sum + (p.patient_count || 0), 0);
    const recentPatients = patients
      .filter(p => {
        const monthDate = new Date(p.year_month + '-01');
        const threeMonthsAgo = subMonths(new Date(), 3);
        return monthDate >= threeMonthsAgo;
      })
      .reduce((sum, p) => sum + (p.patient_count || 0), 0);

    const recentActivity = Math.round((recentPatients/(totalPatients || 1))*100);
    const monthlyAverage = totalPatients > 0 ? Math.round(totalPatients / Math.max(patients.length, 1)) : 0;

    insights.push({
      title: "Patient Volume Trends",
      priority: recentPatients > totalPatients * 0.4 ? 'low' : 'medium',
      summary: `${totalPatients} patients tracked with ${recentActivity}% activity in recent months`,
      recommendation: recentPatients < totalPatients * 0.3 ? 
        "Recent referral activity is below average - reach out to key sources" :
        "Maintain current referral relationship strategies",
      detailedAnalysis: `Your practice has tracked ${totalPatients} total patient referrals across ${patients.length} reporting periods, with ${recentPatients} patients (${recentActivity}%) referred in the last 3 months. The monthly average is approximately ${monthlyAverage} patients. ${recentActivity < 30 ? 'Recent activity is significantly below historical averages, suggesting potential issues with referral flow that require immediate attention.' : recentActivity < 50 ? 'Recent activity is moderately below average, indicating some fluctuation in referral patterns that should be monitored.' : 'Recent activity aligns well with historical patterns, showing consistent referral flow.'} This trend analysis helps identify seasonal patterns and source performance variations.`,
      keyMetrics: [
        `${totalPatients} Total Patients`,
        `${recentPatients} Recent (3mo)`,
        `${monthlyAverage}/mo Average`,
        `${recentActivity}% Recent Activity`
      ],
      actionItems: [
        recentActivity < 40 ? "Schedule immediate check-ins with top 3 referral sources" : "Continue monitoring monthly trends",
        "Implement patient tracking system for source attribution accuracy",
        "Analyze seasonal patterns to predict and prepare for volume changes",
        "Create monthly referral performance dashboard for proactive management"
      ],
      icon: TrendingUp
    });

    // Marketing Activity
    const totalVisits = visits.length;
    const completedVisits = visits.filter(v => v.visited).length;
    const completionRate = totalVisits > 0 ? Math.round((completedVisits/(totalVisits || 1))*100) : 0;
    const pendingVisits = totalVisits - completedVisits;

    insights.push({
      title: "Marketing Outreach Performance",
      priority: completionRate < 70 ? 'high' : completionRate < 85 ? 'medium' : 'low',
      summary: `${completionRate}% visit completion rate with ${pendingVisits} visits pending`,
      recommendation: completionRate < 80 ? 
        "Improve visit scheduling and follow-up processes" :
        "Excellent completion rate - maintain current approach",
      detailedAnalysis: `Your marketing outreach shows ${completedVisits} completed visits out of ${totalVisits} planned (${completionRate}% completion rate), with ${pendingVisits} visits still pending. ${completionRate >= 85 ? 'This excellent completion rate demonstrates strong organizational skills and commitment to relationship building.' : completionRate >= 70 ? 'Your completion rate is above average but has room for improvement through better scheduling and follow-up systems.' : 'The low completion rate suggests systemic issues with visit planning or execution that need immediate attention.'} Consistent marketing visits are crucial for maintaining referral relationships and discovering new opportunities. ${totalVisits === 0 ? 'Consider implementing a systematic marketing visit program to strengthen referral relationships.' : ''}`,
      keyMetrics: [
        `${completedVisits}/${totalVisits} Visits`,
        `${completionRate}% Completion Rate`,
        `${pendingVisits} Pending Visits`,
        `${Math.round(totalVisits/Math.max(1, new Date().getMonth() + 1))} Visits/Month`
      ],
      actionItems: [
        completionRate < 80 ? "Implement systematic visit scheduling and reminder system" : "Continue current visit management approach",
        pendingVisits > 0 ? `Schedule and complete ${pendingVisits} pending visits within 30 days` : "Plan next quarter's visit schedule",
        "Track visit outcomes and follow-up requirements in CRM",
        "Set monthly visit targets based on source priority and relationship status"
      ],
      icon: Users
    });

    // Source Quality Assessment
    const topSourceTypes = Object.entries(sourceTypes)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 3);

    const diversificationScore = Object.keys(sourceTypes).length;

    insights.push({
      title: "Portfolio Diversification Strategy", 
      priority: diversificationScore < 3 ? 'medium' : 'low',
      summary: `${diversificationScore} source types with balanced distribution across specialties`,
      recommendation: diversificationScore < 3 ? 
        "Diversify across more practice types for stability" :
        "Well-diversified portfolio - monitor for balance shifts",
      detailedAnalysis: `Your referral portfolio spans ${diversificationScore} different source types, with the top contributors being: ${topSourceTypes.map(([type, count]) => `${type} (${count} sources, ${Math.round((Number(count)/totalSources)*100)}%)`).join(', ')}. ${diversificationScore < 3 ? 'Limited diversification creates vulnerability to specialty-specific market changes or relationship disruptions. Consider expanding into complementary practice types.' : diversificationScore < 5 ? 'Good diversification provides stability, though monitoring the balance between types ensures no single specialty dominates your referral flow.' : 'Excellent diversification across multiple specialties provides strong protection against market fluctuations.'} Source type diversity should align with your practice capabilities and patient demographics for optimal results.`,
      keyMetrics: [
        `${diversificationScore} Source Types`,
        `${Number(topSourceTypes[0]?.[1]) || 0} Largest Category`,
        `${Math.round((Number(topSourceTypes[0]?.[1] || 0) / Math.max(totalSources, 1)) * 100)}% Concentration`,
        `${totalSources - Number(topSourceTypes[0]?.[1] || 0)} Other Sources`
      ],
      actionItems: [
        diversificationScore < 3 ? "Research and target 2-3 new specialty types for referral development" : "Monitor current source type balance quarterly",
        "Analyze patient outcomes by source type to identify highest-value partnerships", 
        "Develop specialty-specific marketing materials and visit strategies",
        "Track source type performance trends to guide future networking priorities"
      ],
      icon: Target
    });

    return insights;
  };

  const generateOfflineAnalysis = (): BusinessInsight[] => {
    return [
      {
        title: "System Status Check",
        priority: "medium" as const,
        summary: "Analysis running in offline mode with limited data access",
        recommendation: "Ensure stable internet connection and try again for comprehensive insights",
        detailedAnalysis: "The system is currently operating in offline mode, which limits our ability to access your latest practice data and generate comprehensive AI-powered insights. This may be due to network connectivity issues, server maintenance, or data synchronization delays. While offline, basic functionality remains available, but real-time analysis and AI enhancements are temporarily unavailable.",
        keyMetrics: [
          "Offline Mode Active",
          "Limited Data Access",
          "Basic Functions Available",
          "AI Analysis Unavailable"
        ],
        actionItems: [
          "Check your internet connection stability",
          "Try refreshing the page or reloading the application",
          "Contact support if the issue persists for more than 15 minutes",
          "Review cached data for previously generated insights"
        ],
        icon: AlertCircle
      }
    ];
  };

  const callOptimizedAI = async (sources: any[], patients: any[], visits: any[]) => {
    const context = {
      sources: sources.slice(0, 20), // Limit data size
      patients: patients.slice(0, 50),
      visits: visits.slice(0, 30),
      analysis_timestamp: new Date().toISOString()
    };

    const { data, error } = await supabase.functions.invoke('optimized-ai-analysis', {
      body: { context },
      headers: {
        Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
      },
    });

    if (error) throw error;
    return data?.content ? JSON.parse(data.content) : null;
  };

  const getInsightIcon = (title: string) => {
    if (title.toLowerCase().includes('source')) return Building2;
    if (title.toLowerCase().includes('trend') || title.toLowerCase().includes('performance')) return TrendingUp;
    if (title.toLowerCase().includes('marketing') || title.toLowerCase().includes('engagement')) return Users;
    if (title.toLowerCase().includes('diversif') || title.toLowerCase().includes('quality')) return Target;
    return BarChart3;
  };

  const formatAnalysisAge = (date: Date) => {
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just generated';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    if (diffInHours < 48) return 'Yesterday';
    return format(date, 'MMM d, yyyy');
  };

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  return (
    <div className="space-y-6">
      {/* Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Business Intelligence Analysis
            </div>
            <div className="flex items-center gap-2">
              {lastRun && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatAnalysisAge(lastRun)}
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Generate actionable insights about your practice performance, referral patterns, and growth opportunities.
          </p>
          
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error}
              </AlertDescription>
            </Alert>
          )}

          {!cachedAnalysis && !error && (
            <Alert>
              <BarChart3 className="h-4 w-4" />
              <AlertDescription>
                Ready to analyze your practice data. Click "Run Analysis" to get started.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3">
            <Button 
              onClick={runDirectAnalysis}
              disabled={isAnalyzing}
              className="flex-1"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  {insights.length > 0 ? 'Run New Analysis' : 'Run Analysis'}
                </>
              )}
            </Button>
            
            {cachedAnalysis && (
              <Button 
                variant="outline" 
                onClick={loadCachedAnalysis}
                disabled={isAnalyzing}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Cache
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {insights.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Business Insights</h3>
            {lastRun && (
              <Badge variant="secondary">
                Updated {formatAnalysisAge(lastRun)}
              </Badge>
            )}
          </div>
          
          <div className="grid gap-4">
            {insights.map((insight, index) => (
              <Card key={index} className="border-l-4 border-l-primary hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <insight.icon className="h-4 w-4 text-primary" />
                    {insight.title}
                    <Badge variant={getPriorityVariant(insight.priority)}>
                      {insight.priority}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm font-medium text-foreground">
                    {insight.summary}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">Quick Fix:</span> {insight.recommendation}
                  </p>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-full justify-between group">
                        <span className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          See Detailed Analysis
                        </span>
                        <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <insight.icon className="h-5 w-5 text-primary" />
                          {insight.title}
                          <Badge variant={getPriorityVariant(insight.priority)}>
                            {insight.priority} priority
                          </Badge>
                        </DialogTitle>
                      </DialogHeader>
                      
                      <div className="space-y-6">
                        {/* AI Analysis Section */}
                        <div>
                          <h4 className="font-semibold mb-3 flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary" />
                            AI Analysis
                          </h4>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {insight.detailedAnalysis}
                          </p>
                        </div>

                        {/* Key Metrics */}
                        <div>
                          <h4 className="font-semibold mb-3 flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-primary" />
                            Key Metrics
                          </h4>
                          <div className="grid grid-cols-2 gap-3">
                            {insight.keyMetrics?.map((metric, i) => (
                              <div key={i} className="bg-muted/50 rounded-lg p-3">
                                <p className="text-sm font-medium">{metric}</p>
                              </div>
                            )) || <p className="text-sm text-muted-foreground">No metrics available</p>}
                          </div>
                        </div>

                        {/* Action Items */}
                        <div>
                          <h4 className="font-semibold mb-3 flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                            Recommended Actions
                          </h4>
                          <div className="space-y-2">
                            {insight.actionItems?.map((action, i) => (
                              <div key={i} className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg">
                                <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                                <p className="text-sm">{action}</p>
                              </div>
                            )) || <p className="text-sm text-muted-foreground">No actions available</p>}
                          </div>
                        </div>

                        <div className="flex justify-end pt-4 border-t">
                          <Badge variant="outline" className="text-xs">
                            Generated by AI • {format(lastRun || new Date(), 'MMM d, h:mm a')}
                          </Badge>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Loading State */}
      {isAnalyzing && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center space-y-4 flex-col">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-medium">Analyzing Your Practice Data</p>
                <p className="text-sm text-muted-foreground">
                  Processing sources, patient data, and marketing activities...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}