import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  RefreshCw, 
  Sparkles, 
  TrendingUp, 
  Users,
  Building2,
  Target,
  BarChart3,
  Activity,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useUnifiedAIData } from '@/hooks/useUnifiedAIData';

interface AnalysisData {
  content: string;
  keyInsights: string[];
  recommendations: string[];
  timestamp: Date;
}

interface QuickStat {
  label: string;
  value: string;
  trend?: 'up' | 'down' | 'stable';
  icon: React.ComponentType<any>;
}

// Component to format AI text with proper styling
const FormattedAIText = ({ text }: { text: string }) => {
  const formatText = (text: string) => {
    // Replace **bold** with <strong>
    let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-teal-700">$1</strong>');
    
    // Replace *italic* with <em>
    formatted = formatted.replace(/\*(.*?)\*/g, '<em class="italic text-slate-600">$1</em>');
    
    // Replace bullet points
    formatted = formatted.replace(/^[\s]*[-•]\s+/gm, '<span class="text-teal-500">•</span> ');
    
    // Replace numbered lists
    formatted = formatted.replace(/^[\s]*(\d+)\.\s+/gm, '<span class="font-medium text-teal-600">$1.</span> ');
    
    // Remove unwanted characters like {., etc.
    formatted = formatted.replace(/[{}]/g, '');
    
    return formatted;
  };

  return (
    <div 
      className="text-slate-700 leading-relaxed space-y-3"
      dangerouslySetInnerHTML={{ __html: formatText(text) }}
    />
  );
};

export function AIUnifiedAnalysis() {
  const { user } = useAuth();
  const { fetchAllData } = useUnifiedAIData();
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [quickStats, setQuickStats] = useState<QuickStat[]>([]);

  useEffect(() => {
    loadCachedAnalysis();
    loadQuickStats();
  }, [user]);

  const loadCachedAnalysis = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('ai_generated_content')
        .select('*')
        .eq('user_id', user.id)
        .eq('content_type', 'unified_analysis')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        try {
          const parsed = JSON.parse(data.generated_text);
          setAnalysis({
            content: parsed.content || data.generated_text,
            keyInsights: parsed.keyInsights || [],
            recommendations: parsed.recommendations || [],
            timestamp: new Date(data.created_at)
          });
        } catch {
          setAnalysis({
            content: data.generated_text,
            keyInsights: [],
            recommendations: [],
            timestamp: new Date(data.created_at)
          });
        }
      }
    } catch (error) {
      console.error('Error loading cached analysis:', error);
    }
  };

  const loadQuickStats = async () => {
    if (!user) return;

    try {
      const [sourcesResult, patientsResult, visitsResult, campaignsResult] = await Promise.all([
        supabase.from('patient_sources').select('*').eq('created_by', user.id),
        supabase.from('monthly_patients').select('*').eq('user_id', user.id),
        supabase.from('marketing_visits').select('*').eq('user_id', user.id),
        supabase.from('campaigns').select('*').eq('created_by', user.id),
      ]);

      const sources = sourcesResult.data || [];
      const patients = patientsResult.data || [];
      const visits = visitsResult.data || [];
      const campaigns = campaignsResult.data || [];

      const totalReferrals = patients.reduce((sum, p) => sum + (p.patient_count || 0), 0);
      const activeSources = sources.filter(s => s.is_active).length;
      const completedVisits = visits.filter(v => v.visited).length;
      const activeCampaigns = campaigns.filter(c => c.status === 'Active').length;

      const currentMonth = new Date().toISOString().slice(0, 7);
      const thisMonthReferrals = patients
        .filter(p => p.year_month === currentMonth)
        .reduce((sum, p) => sum + (p.patient_count || 0), 0);

      setQuickStats([
        {
          label: 'Total Sources',
          value: sources.length.toString(),
          icon: Building2
        },
        {
          label: 'Active Sources',
          value: activeSources.toString(),
          trend: activeSources > sources.length * 0.8 ? 'up' : activeSources > sources.length * 0.6 ? 'stable' : 'down',
          icon: Users
        },
        {
          label: 'This Month',
          value: `${thisMonthReferrals} referrals`,
          trend: thisMonthReferrals > 0 ? 'up' : 'stable',
          icon: TrendingUp
        },
        {
          label: 'Campaigns',
          value: `${activeCampaigns} active`,
          icon: Target
        }
      ]);
    } catch (error) {
      console.error('Error loading quick stats:', error);
    }
  };

  const generateUnifiedAnalysis = async () => {
    if (!user) return;

    setIsLoading(true);

    try {
      // Get comprehensive unified data
      const unifiedData = await fetchAllData();
      
      if (!unifiedData) {
        throw new Error('Failed to fetch practice data');
      }

      // Create detailed analysis prompt with actual data
      const analysisPrompt = `
Analyze this comprehensive practice data and provide 4-6 actionable business insights:

PRACTICE DATA SUMMARY:
- Total Referral Sources: ${unifiedData.analytics.total_sources}
- Total Referrals (All Time): ${unifiedData.analytics.total_referrals}
- Active Recent Sources: ${unifiedData.analytics.active_sources_this_month}
- Source Type Distribution: ${JSON.stringify(unifiedData.analytics.source_types_distribution)}

MONTHLY TRENDS:
${unifiedData.analytics.last_6_months_trend.length > 0 
  ? unifiedData.analytics.last_6_months_trend.map(m => `${m.year_month}: ${m.patient_count} patients`).join('\n')
  : 'No recent data available'
}

MARKETING VISITS DATA:
- Total Visits Tracked: ${unifiedData.visits.length}
- Recent Visit Activity: ${unifiedData.analytics.recent_visits}

CAMPAIGN PERFORMANCE:
- Active Campaigns: ${unifiedData.campaigns.filter(c => c.status === 'Active').length}
- Campaign Success Rate: ${unifiedData.analytics.campaign_delivery_success_rate}%

BUSINESS OPPORTUNITIES:
- Discovered Offices: ${unifiedData.analytics.discovered_offices_count}
- Imported Offices: ${unifiedData.analytics.imported_offices}
- Pending Reviews: ${unifiedData.analytics.pending_reviews}

ANALYSIS INSTRUCTION:
Generate a comprehensive, flowing analysis of this practice's performance, focusing on key insights and actionable recommendations. Keep it concise but thorough.

RETURN FORMAT: Return only the JSON structure specified in the system prompt.
`;

      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          task_type: 'comprehensive_analysis',
          context: {
            unified_data: unifiedData
          },
          prompt: analysisPrompt
        },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;

      const analysisContent = data.content || 'Analysis completed successfully.';
      
      // Extract key insights and recommendations from unified data
      const keyInsights = [
        `${unifiedData.analytics.total_sources} total referral sources with ${unifiedData.analytics.active_sources_this_month} currently active`,
        `${unifiedData.analytics.total_referrals} total referrals tracked across all time periods`,
        `${unifiedData.analytics.recent_visits} recent marketing visits with ${Math.round((unifiedData.visits.filter(v => v.visited).length / Math.max(unifiedData.visits.length, 1)) * 100)}% completion rate`,
        `${unifiedData.campaigns.filter(c => c.status === 'Active').length} active campaigns with ${unifiedData.analytics.campaign_delivery_success_rate}% success rate`
      ];

      const recommendations = [
        unifiedData.analytics.total_sources < 10 ? 'Expand referral network to reduce dependency risk' : 'Maintain regular source engagement',
        unifiedData.analytics.campaign_delivery_success_rate < 80 ? 'Improve campaign delivery rates and follow-up processes' : 'Continue excellent campaign execution',
        'Monitor monthly referral trends for seasonal patterns',
        'Develop source-specific communication strategies based on performance data'
      ];

      const newAnalysis = {
        content: analysisContent,
        keyInsights,
        recommendations,
        timestamp: new Date()
      };

      // Cache the analysis
      await supabase.from('ai_generated_content').insert({
        user_id: user.id,
        content_type: 'unified_analysis',
        generated_text: JSON.stringify(newAnalysis),
        status: 'generated'
      });

      setAnalysis(newAnalysis);
      loadQuickStats(); // Refresh stats

      toast({
        title: 'Analysis Updated',
        description: 'Your practice analysis has been refreshed with the latest data.',
      });

    } catch (error: any) {
      console.error('Error generating analysis:', error);
      toast({
        title: 'Analysis Error',
        description: 'Failed to generate analysis. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Main Analysis Card */}
      <Card className="bg-gradient-to-br from-teal-50 via-white to-slate-50 border-teal-200/50">
        <CardContent className="p-8">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-100 rounded-lg">
                <Sparkles className="h-6 w-6 text-teal-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-slate-800">AI Practice Analysis</h3>
                <p className="text-sm text-slate-600">
                  {analysis?.timestamp ? `Last updated ${analysis.timestamp.toLocaleDateString()}` : 'Generate your first analysis'}
                </p>
              </div>
            </div>
            <Button 
              onClick={generateUnifiedAnalysis} 
              disabled={isLoading}
              variant="outline"
              className="border-teal-200 hover:bg-teal-50"
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {isLoading ? 'Analyzing...' : 'Refresh Analysis'}
            </Button>
          </div>

          {/* Analysis Content */}
          {analysis ? (
            <div className="space-y-6">
              {/* Main Analysis Text */}
              <div className="prose prose-slate max-w-none">
                <div className="bg-white/70 backdrop-blur-sm rounded-lg p-6 border border-slate-200/50">
                  <FormattedAIText text={analysis.content} />
                </div>
              </div>

              {/* Key Insights */}
              {analysis.keyInsights.length > 0 && (
                <div>
                  <h4 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-teal-600" />
                    Key Insights
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {analysis.keyInsights.map((insight, index) => (
                      <div key={index} className="bg-white/50 rounded-lg p-3 border border-slate-200/50">
                        <p className="text-sm text-slate-700">{insight}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {analysis.recommendations.length > 0 && (
                <div>
                  <h4 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
                    <Target className="h-4 w-4 text-teal-600" />
                    Recommendations
                  </h4>
                  <div className="space-y-2">
                    {analysis.recommendations.map((rec, index) => (
                      <div key={index} className="bg-white/50 rounded-lg p-3 border border-slate-200/50 flex items-start gap-2">
                        <div className="w-2 h-2 bg-teal-500 rounded-full mt-2 flex-shrink-0"></div>
                        <p className="text-sm text-slate-700">{rec}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="h-8 w-8 text-teal-600" />
              </div>
              <h4 className="text-lg font-medium text-slate-800 mb-2">Ready to Analyze</h4>
              <p className="text-slate-600 mb-6 max-w-md mx-auto">
                Get AI-powered insights about your practice performance, referral patterns, and growth opportunities.
              </p>
              <Button 
                onClick={generateUnifiedAnalysis}
                disabled={isLoading}
                className="bg-teal-600 hover:bg-teal-700"
              >
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Generate Analysis
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {quickStats.map((stat, index) => {
          const IconComponent = stat.icon;
          return (
            <Card key={index} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-lg font-semibold text-slate-800">{stat.value}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {stat.trend && (
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${
                          stat.trend === 'up' ? 'text-green-600 border-green-200' :
                          stat.trend === 'down' ? 'text-red-600 border-red-200' :
                          'text-slate-600 border-slate-200'
                        }`}
                      >
                        {stat.trend === 'up' ? '↗' : stat.trend === 'down' ? '↘' : '→'}
                      </Badge>
                    )}
                    <IconComponent className="h-5 w-5 text-slate-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}