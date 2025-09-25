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
  Sparkles,
  Brain,
  Zap,
  Eye,
  Shield
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format, subMonths } from 'date-fns';
import { useUnifiedAIData } from '@/hooks/useUnifiedAIData';

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
  const { data: unifiedData, loading: dataLoading, fetchAllData } = useUnifiedAIData();
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
        
        // Check if analysis is recent (less than 4 hours old) to avoid excessive AI usage
        const analysisAge = new Date().getTime() - new Date(data.created_at).getTime();
        const fourHours = 4 * 60 * 60 * 1000;
        
        if (analysisAge < fourHours) {
          console.log('Using recent cached analysis to avoid excessive AI usage');
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
      }
    } catch (error) {
      console.error('Failed to load cached analysis:', error);
    }
  };

  const runComprehensiveAnalysis = async () => {
    if (!user) return;
    
    // Check if we have recent analysis to avoid excessive AI usage
    if (cachedAnalysis) {
      const analysisAge = new Date().getTime() - new Date(cachedAnalysis.created_at).getTime();
      const fourHours = 4 * 60 * 60 * 1000;
      
      if (analysisAge < fourHours) {
        toast({
          title: "Recent Analysis Available",
          description: "Using cached analysis from the last 4 hours to optimize AI usage.",
        });
        return;
      }
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      console.log('Starting comprehensive AI analysis...');

      // Fetch all unified data first
      const data = unifiedData || await fetchAllData();
      
      if (!data) {
        throw new Error('Failed to load platform data');
      }

      console.log('Comprehensive data loaded:', {
        sources: data.sources.length,
        monthly_data: data.monthly_data.length,
        visits: data.visits.length,
        campaigns: data.campaigns.length,
        discovered_offices: data.discovered_offices.length,
        reviews: data.reviews.length,
        ai_usage: data.ai_usage_history.length
      });

      // Call the comprehensive AI insights function
      const { data: aiResponse, error: aiError } = await supabase.functions.invoke('comprehensive-ai-insights', {
        body: { context: data },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (aiError) {
        console.error('AI analysis error:', aiError);
        throw new Error('AI analysis failed: ' + aiError.message);
      }

      if (!aiResponse?.insights || !Array.isArray(aiResponse.insights)) {
        throw new Error('Invalid AI response format');
      }

      // Process insights with icons
      const processedInsights = aiResponse.insights.map((insight: any) => ({
        ...insight,
        icon: getInsightIcon(insight.title)
      }));

      // Cache the results
      const analysisText = JSON.stringify({ 
        insights: processedInsights,
        generated_at: new Date().toISOString(),
        method: 'comprehensive_ai',
        metadata: aiResponse.metadata
      });

      await supabase
        .from('ai_generated_content')
        .insert({
          user_id: user.id,
          content_type: 'business_analysis',
          generated_text: analysisText,
          status: 'generated',
          metadata: { 
            method: 'comprehensive_ai',
            model_used: 'gpt-4o-mini',
            data_points: aiResponse.metadata?.data_points || {}
          },
        });

      setInsights(processedInsights);
      setLastRun(new Date());

      toast({
        title: "AI Analysis Complete",
        description: `Generated ${processedInsights.length} dynamic insights using GPT-4o-mini.`,
      });

    } catch (error: any) {
      console.error('Comprehensive analysis failed:', error);
      setError(error.message);
      
      // Generate fallback analysis
      const fallbackInsights = generateFallbackAnalysis(unifiedData);
      setInsights(fallbackInsights);
      
      toast({
        title: "Analysis Completed (Fallback Mode)",
        description: "Generated insights using available data.",
        variant: "default",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateFallbackAnalysis = (data: any): BusinessInsight[] => {
    if (!data) {
      return [
        {
          title: "Data Loading Required",
          priority: "high" as const,
          summary: "Platform data needs to be loaded for comprehensive analysis",
          recommendation: "Refresh the page or check your connection to load practice data",
          detailedAnalysis: "The system requires access to your practice data to generate meaningful insights. This includes referral sources, patient volumes, marketing visits, campaigns, and other platform activities. Without this data, we cannot provide specific recommendations tailored to your practice's performance.",
          keyMetrics: [
            "No Data Available", 
            "Analysis Blocked",
            "Connection Required",
            "Refresh Needed"
          ],
          actionItems: [
            "Refresh the page to reload data",
            "Check internet connection stability", 
            "Verify you're logged in correctly",
            "Contact support if data loading persists"
          ],
          icon: AlertCircle
        }
      ];
    }

    // Generate basic insights from available data
    const insights: BusinessInsight[] = [];
    const { sources = [], analytics = {} } = data;

    if (sources.length === 0) {
      insights.push({
        title: "Referral Network Development Needed",
        priority: "high" as const,
        summary: "No referral sources found - practice needs to establish referral relationships",
        recommendation: "Start building your referral network by identifying and connecting with 5-10 target practices",
        detailedAnalysis: "Your practice currently has no tracked referral sources, which represents a significant opportunity for growth. Building a strong referral network is essential for sustainable patient acquisition and practice growth. Focus on identifying complementary practices in your area and establishing professional relationships.",
        keyMetrics: [
          "0 Referral Sources",
          "Growth Opportunity", 
          "Network Building Required",
          "Patient Acquisition Risk"
        ],
        actionItems: [
          "Identify 10 target practices for referral relationships",
          "Schedule introduction meetings with key practices",
          "Develop referral tracking system",
          "Create professional referral materials"
        ],
        icon: Building2
      });
    } else {
      insights.push({
        title: "Basic Network Analysis",
        priority: "medium" as const,
        summary: `${sources.length} referral sources tracked - analysis limited without AI enhancement`,
        recommendation: "Use comprehensive AI analysis for detailed insights and recommendations",
        detailedAnalysis: `Your practice has ${sources.length} referral sources in the system. For detailed performance analysis, optimization recommendations, and strategic insights, the comprehensive AI analysis provides deeper examination of patterns, opportunities, and specific action items tailored to your data.`,
        keyMetrics: [
          `${sources.length} Sources Tracked`,
          "Basic Data Available",
          "AI Enhancement Needed", 
          "Detailed Analysis Pending"
        ],
        actionItems: [
          "Run comprehensive AI analysis for detailed insights",
          "Review source performance data",
          "Update source information regularly",
          "Monitor referral patterns monthly"
        ],
        icon: BarChart3
      });
    }

    return insights;
  };

  const getInsightIcon = (title: string) => {
    const titleLower = title.toLowerCase();
    
    // AI and smart insights
    if (titleLower.includes('ai') || titleLower.includes('smart') || titleLower.includes('intelligent')) return Brain;
    if (titleLower.includes('opportunity') || titleLower.includes('missed') || titleLower.includes('potential')) return Zap;
    if (titleLower.includes('discovery') || titleLower.includes('discovered') || titleLower.includes('found')) return Eye;
    if (titleLower.includes('risk') || titleLower.includes('vulnerability') || titleLower.includes('threat')) return Shield;
    
    // Traditional categories
    if (titleLower.includes('referral') || titleLower.includes('network') || titleLower.includes('source')) return Building2;
    if (titleLower.includes('patient') || titleLower.includes('volume') || titleLower.includes('trend')) return TrendingUp;
    if (titleLower.includes('marketing') || titleLower.includes('visit') || titleLower.includes('outreach')) return Users;
    if (titleLower.includes('campaign') || titleLower.includes('delivery') || titleLower.includes('email')) return Target;
    if (titleLower.includes('review') || titleLower.includes('rating') || titleLower.includes('reputation')) return CheckCircle2;
    if (titleLower.includes('portfolio') || titleLower.includes('diversification') || titleLower.includes('balance')) return BarChart3;
    if (titleLower.includes('system') || titleLower.includes('status') || titleLower.includes('data')) return AlertCircle;
    
    return Sparkles; // Default for dynamic AI insights
  };

  const formatAnalysisAge = (date: Date) => {
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
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
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                AI Business Analysis
              </CardTitle>
              {lastRun && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Last run: {formatAnalysisAge(lastRun)}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button 
                onClick={runComprehensiveAnalysis}
                disabled={isAnalyzing || dataLoading}
                className="w-full sm:w-auto"
                size="lg"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    AI Analyzing...
                  </>
                ) : (
                  <>
                    <Brain className="mr-2 h-4 w-4" />
                    AI Analysis
                  </>
                )}
              </Button>
              
              {cachedAnalysis && (
                <Button 
                  onClick={loadCachedAnalysis}
                  variant="outline"
                  size="sm"
                  disabled={isAnalyzing}
                >
                  <RefreshCw className="mr-2 h-3 w-3" />
                  Refresh
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-muted-foreground">
                  AI-powered analysis that examines your practice data to identify critical opportunities. Analysis is cached for 4 hours to optimize AI usage and costs.
                </p>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Analysis Error: {error}
                  </AlertDescription>
                </Alert>
              )}

              {dataLoading && (
                <Alert>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <AlertDescription>
                    Loading platform data for comprehensive analysis...
                  </AlertDescription>
                </Alert>
              )}
              
              {lastRun && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted/50 rounded-md">
                  <Clock className="h-4 w-4" />
                  <span>
                    Last analysis: {formatAnalysisAge(lastRun)} • 
                    Next analysis available: {formatAnalysisAge(new Date(lastRun.getTime() + 4 * 60 * 60 * 1000))}
                  </span>
                </div>
              )}
            </div>
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {isAnalyzing ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <div>
                <h3 className="text-lg font-semibold">AI Analysis in Progress</h3>
                <p className="text-muted-foreground">
                  GPT-5 is examining your practice data to identify critical business insights...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : insights.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {insights.map((insight, index) => (
            <Card key={index} className="relative group hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <insight.icon className="h-5 w-5 text-primary" />
                    <Badge variant={getPriorityVariant(insight.priority) as any}>
                      {insight.priority}
                    </Badge>
                  </div>
                </div>
                <CardTitle className="text-base leading-tight">
                  {insight.title}
                </CardTitle>
              </CardHeader>
              
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {insight.summary}
                </p>
                
                <div className="p-3 bg-muted/50 rounded-md">
                  <p className="text-sm font-medium text-primary">
                    {insight.recommendation}
                  </p>
                </div>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full group">
                      View Details
                      <ChevronRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-1" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <insight.icon className="h-5 w-5 text-primary" />
                        {insight.title}
                        <Badge variant={getPriorityVariant(insight.priority) as any}>
                          {insight.priority}
                        </Badge>
                      </DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-6">
                      <div>
                        <h4 className="font-semibold mb-2">Summary</h4>
                        <p className="text-muted-foreground">{insight.summary}</p>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2">Recommendation</h4>
                        <div className="p-3 bg-primary/5 border border-primary/20 rounded-md">
                          <p className="text-primary font-medium">{insight.recommendation}</p>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-3">Detailed Analysis</h4>
                        <p className="text-sm leading-relaxed">{insight.detailedAnalysis}</p>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-semibold mb-3">Key Metrics</h4>
                          <div className="space-y-2">
                            {insight.keyMetrics.map((metric, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <span className="text-sm">{metric}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h4 className="font-semibold mb-3">Action Items</h4>
                          <div className="space-y-2">
                            {insight.actionItems.map((action, idx) => (
                              <div key={idx} className="flex items-start gap-2">
                                <Target className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                                <span className="text-sm">{action}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}