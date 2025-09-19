import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertTriangle, TrendingUp, RefreshCw, BarChart3, Brain, ExternalLink } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface ReportSection {
  id: string;
  title: string;
  summary: string;
  priority: 'high' | 'medium' | 'low';
  full_analysis: string;
}

interface AnalysisData {
  business_profile: any;
  sources: any[];
  monthly_data: any[];
  visits: any[];
  total_sources: number;
  total_referrals: number;
  source_types: Record<string, number>;
  last_6_months: any[];
  // Additional comprehensive data
  campaigns?: any[];
  discovered_offices?: any[];
  reviews?: any[];
  campaign_deliveries?: any[];
  ai_usage_history?: any[];
  ai_templates?: any[];
  ai_content?: any[];
  user_profile?: any;
  clinic_info?: any;
  recent_activities?: any[];
}

const SECTION_CONFIGS = [
  {
    id: 'source_distribution',
    title: 'Source Distribution',
    description: 'Referral source concentration and diversification analysis'
  },
  {
    id: 'performance_trends', 
    title: 'Performance Trends',
    description: 'Monthly patterns and seasonal variations in referrals'
  },
  {
    id: 'geographic_distribution',
    title: 'Geographic Distribution', 
    description: 'Regional patterns and location-based insights'
  },
  {
    id: 'source_quality',
    title: 'Source Quality & Reliability',
    description: 'Assessment of source reliability and relationship strength'
  },
  {
    id: 'strategic_recommendations',
    title: 'Strategic Recommendations',
    description: 'Actionable strategies for practice growth'
  },
  {
    id: 'emerging_patterns',
    title: 'Emerging Patterns',
    description: 'New trends and opportunities in your referral network'
  }
];

export function AIDataAnalysis() {
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasAnalysis, setHasAnalysis] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user && !hasAnalysis && !loading) {
      generateStructuredReport();
    }
  }, [user]);

  const generateStructuredReport = async () => {
    if (!user) {
      setError('Please log in to generate analysis');
      return;
    }
    
    setLoading(true);
    setError(null);
    setHasAnalysis(false);

    try {
      // Fetch ALL comprehensive platform data using unified approach
      const [
        sourcesResult,
        monthlyResult, 
        visitsResult,
        campaignsResult,
        discoveredResult,
        reviewsResult,
        deliveriesResult,
        usageResult,
        userProfileResult,
        clinicResult,
        activityResult,
        aiBusinessProfileResult,
        aiTemplatesResult,
        aiContentResult
      ] = await Promise.all([
        supabase.from('patient_sources').select('*').eq('created_by', user.id),
        supabase.from('monthly_patients').select('*').eq('user_id', user.id),
        supabase.from('marketing_visits').select('*').eq('user_id', user.id),
        supabase.from('campaigns').select('*').eq('created_by', user.id),
        supabase.from('discovered_offices').select('*').eq('discovered_by', user.id),
        supabase.from('review_status').select('*').eq('user_id', user.id),
        supabase.from('campaign_deliveries').select('*').eq('created_by', user.id),
        supabase.from('ai_usage_tracking').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('user_profiles').select('*').eq('user_id', user.id).single(),
        supabase.from('clinics').select('*').eq('owner_id', user.id).maybeSingle(),
        supabase.from('activity_log').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
        supabase.from('ai_business_profiles').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('ai_response_templates').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
        supabase.from('ai_generated_content').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20)
      ]);

      // Extract data with error checking
      const sources = sourcesResult.data || [];
      const monthlyData = monthlyResult.data || [];
      const visits = visitsResult.data || [];
      const campaigns = campaignsResult.data || [];
      const discoveredOffices = discoveredResult.data || [];
      const reviews = reviewsResult.data || [];
      const deliveries = deliveriesResult.data || [];
      const aiUsage = usageResult.data || [];
      const userProfile = userProfileResult.data;
      const clinic = clinicResult.data;
      const activities = activityResult.data || [];
      const aiBusinessProfileData = aiBusinessProfileResult.data;
      const aiTemplates = aiTemplatesResult.data || [];
      const aiGeneratedContent = aiContentResult.data || [];

      // Get business profile from AI business context if not available
      let businessProfile = aiBusinessProfileData;
      if (!businessProfile) {
        try {
          const { data: contextData } = await supabase.functions.invoke('ai-business-context', {
            body: { action: 'get' },
            headers: {
              Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            },
          });
          businessProfile = contextData?.profile || null;
        } catch (e) {
          console.warn('Could not fetch business profile:', e);
          businessProfile = null;
        }
      }

      // Prepare comprehensive analysis data with ALL platform data
      const analysisData: AnalysisData = {
        business_profile: businessProfile || {},
        sources: sources,
        monthly_data: monthlyData,
        visits: visits,
        total_sources: sources.length,
        total_referrals: monthlyData.reduce((sum, m) => sum + (m.patient_count || 0), 0),
        source_types: sources.reduce((acc, s) => {
          const type = s.source_type || 'Unknown';
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        last_6_months: monthlyData.filter(m => {
          const monthDate = new Date(m.year_month + '-01');
          const sixMonthsAgo = new Date();
          sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
          return monthDate >= sixMonthsAgo;
        }).slice(0, 6),
        // Additional comprehensive data
        campaigns,
        discovered_offices: discoveredOffices,
        reviews,
        campaign_deliveries: deliveries,
        ai_usage_history: aiUsage,
        ai_templates: aiTemplates,
        ai_content: aiGeneratedContent,
        user_profile: userProfile,
        clinic_info: clinic,
        recent_activities: activities
      };

      console.log('Comprehensive analysis data prepared:', analysisData);

      // Call AI assistant for structured report
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          task_type: 'structured_report',
          context: {
            analysis_data: analysisData
          },
          prompt: 'Generate comprehensive structured report with specific insights for each section based on the real practice data provided.'
        },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) {
        console.error('AI Assistant error:', error);
        throw new Error(`AI analysis failed: ${error.message || 'Unknown error'}`);
      }

      const aiContent = data?.content;
      if (!aiContent || typeof aiContent !== 'string') {
        throw new Error('Invalid AI response format');
      }

      console.log('AI Content received:', aiContent);

      // Parse JSON response
      let reportData;
      try {
        reportData = JSON.parse(aiContent);
      } catch (parseError) {
        console.error('Failed to parse AI response as JSON:', aiContent);
        throw new Error('AI returned invalid JSON format');
      }

      // Convert to sections array
      const generatedSections: ReportSection[] = SECTION_CONFIGS.map(config => {
        const sectionData = reportData[config.id];
        if (!sectionData) {
          return {
            id: config.id,
            title: config.title,
            summary: 'No data available for analysis.',
            priority: 'low' as const,
            full_analysis: 'Insufficient data to provide meaningful insights for this section.'
          };
        }

        return {
          id: config.id,
          title: config.title,
          summary: sectionData.summary || 'Analysis completed.',
          priority: sectionData.priority || 'medium' as const,
          full_analysis: sectionData.full_analysis || sectionData.summary || 'No detailed analysis available.'
        };
      });

      setSections(generatedSections);
      setHasAnalysis(true);
      
      toast({
        title: 'Report Generated',
        description: `Business intelligence report completed with ${generatedSections.length} sections.`,
      });

    } catch (error: any) {
      console.error('Error generating structured report:', error);
      setError(error.message || 'Failed to generate report');
      
      toast({
        title: 'Report Failed',
        description: error.message || 'Unable to generate report. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const getPriorityBorder = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-l-destructive/60';
      case 'medium': return 'border-l-primary/60';
      case 'low': return 'border-l-muted-foreground/40';
      default: return 'border-l-muted-foreground/40';
    }
  };

  if (error && !hasAnalysis) {
    return (
      <div className="text-center space-y-4 py-8">
        <div className="w-16 h-16 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-2 text-destructive">Analysis Error</h3>
          <p className="text-muted-foreground mb-4 max-w-md mx-auto">
            {error}
          </p>
          <div className="flex gap-2 justify-center">
            <Button onClick={generateStructuredReport} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry Analysis
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!hasAnalysis && !loading) {
    return (
      <div className="text-center space-y-4 py-8">
        <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
          <Brain className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-2">AI Business Intelligence Report</h3>
          <p className="text-muted-foreground mb-4 max-w-md mx-auto">
            Generate a comprehensive structured report analyzing your referral patterns, source performance, geographic distribution, and strategic opportunities.
          </p>
          <Button onClick={generateStructuredReport} className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Generate Report
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-4">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <div className="animate-spin">
              <RefreshCw className="h-4 w-4" />
            </div>
            Generating business intelligence report...
          </div>
        </div>
        <div className="space-y-4">
          {SECTION_CONFIGS.map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className={`border-l-4 border-l-muted/60 p-6 ${i % 2 === 0 ? 'bg-muted/20' : 'bg-background'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="h-5 bg-muted rounded w-1/3"></div>
                  <div className="h-6 bg-muted rounded w-16"></div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded w-full"></div>
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">AI Business Intelligence Report</h3>
          <p className="text-sm text-muted-foreground">
            Comprehensive analysis across {sections.length} key areas using unified platform data
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={generateStructuredReport}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Analysis
        </Button>
      </div>
      
      <div className="space-y-0 border border-border/50 rounded-lg overflow-hidden">
        {sections.map((section, index) => (
          <div 
            key={section.id} 
            className={`
              border-l-4 ${getPriorityBorder(section.priority)} p-6 
              ${index % 2 === 0 ? 'bg-muted/20' : 'bg-background'}
              ${index < sections.length - 1 ? 'border-b border-border/30' : ''}
            `}
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-base font-semibold text-foreground">
                {section.title}
              </h4>
              <div className="flex items-center gap-2">
                <Badge 
                  variant={getPriorityColor(section.priority) as any}
                  className="text-xs"
                >
                  {section.priority.toUpperCase()}
                </Badge>
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              {section.summary}
            </p>
            
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 p-0 h-auto font-normal text-primary hover:text-primary/80">
                  View More <ExternalLink className="h-3 w-3" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    {section.title}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant={getPriorityColor(section.priority) as any}>
                      {section.priority.toUpperCase()} PRIORITY
                    </Badge>
                  </div>
                  <div className="prose prose-sm max-w-none text-muted-foreground leading-relaxed">
                    {section.full_analysis}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        ))}
      </div>

      {sections.length === 0 && hasAnalysis && (
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto bg-muted/20 rounded-full flex items-center justify-center mb-4">
            <Brain className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">No report data available. Please try generating the report again.</p>
        </div>
      )}
    </div>
  );
}