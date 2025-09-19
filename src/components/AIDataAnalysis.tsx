import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, TrendingUp, Target, Users, Activity, Zap, Brain, RefreshCw, BarChart3, MapPin, Calendar, Lightbulb, Shield } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface AIInsight {
  id: string;
  type: 'summary' | 'action' | 'improvement' | 'alert' | 'opportunity' | 'risk';
  title: string;
  content: string;
  rawContent: string;
  priority: 'high' | 'medium' | 'low';
  icon: any;
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
}

export function AIDataAnalysis() {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasAnalysis, setHasAnalysis] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    // Auto-load analysis if user is authenticated
    if (user && !hasAnalysis && !loading) {
      generateAIAnalysis();
    }
  }, [user]);

  const parseMarkdownContent = (content: string): string => {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br />');
  };

  const extractInsights = (aiContent: string): AIInsight[] => {
    try {
      const insights: AIInsight[] = [];
      const icons = [TrendingUp, BarChart3, AlertTriangle, Target, Lightbulb, Shield, MapPin, Brain];
      
      // Try to parse as structured insights first
      const sections = aiContent.split(/\*\*([^*]+):\*\*/).filter(section => section.trim());
      
      if (sections.length >= 4) {
        // Structured format with **Title:** format
        for (let i = 0; i < sections.length - 1; i += 2) {
          const title = sections[i]?.trim();
          const content = sections[i + 1]?.trim();
          
          if (title && content && insights.length < 6) {
            const insight = createInsightFromContent(title, content, insights.length, icons);
            if (insight) insights.push(insight);
          }
        }
      } else {
        // Fallback: Split by numbered points or paragraphs
        const paragraphs = aiContent
          .split(/\n\s*\n/)
          .filter(p => p.trim().length > 50)
          .slice(0, 6);
        
        paragraphs.forEach((paragraph, index) => {
          const lines = paragraph.trim().split('\n');
          const title = extractTitle(lines[0]) || `Business Insight ${index + 1}`;
          const content = lines.slice(1).join('\n').trim() || paragraph.trim();
          
          const insight = createInsightFromContent(title, content, index, icons);
          if (insight) insights.push(insight);
        });
      }

      return insights.length > 0 ? insights : createFallbackInsights(aiContent);
    } catch (error) {
      console.error('Error parsing insights:', error);
      return createFallbackInsights(aiContent);
    }
  };

  const extractTitle = (line: string): string => {
    // Remove markdown formatting and extract meaningful title
    return line
      .replace(/^\d+\.\s*/, '')
      .replace(/\*\*/g, '')
      .replace(/[:.-].*/, '')
      .trim()
      .slice(0, 50);
  };

  const createInsightFromContent = (title: string, content: string, index: number, icons: any[]): AIInsight | null => {
    if (!title || !content) return null;

    const lowerContent = content.toLowerCase();
    
    // Determine type and priority based on content analysis
    let type: AIInsight['type'] = 'summary';
    let priority: AIInsight['priority'] = 'medium';
    
    if (lowerContent.includes('risk') || lowerContent.includes('concern') || lowerContent.includes('warning')) {
      type = 'risk';
      priority = 'high';
    } else if (lowerContent.includes('opportunity') || lowerContent.includes('growth') || lowerContent.includes('potential')) {
      type = 'opportunity';
      priority = 'medium';
    } else if (lowerContent.includes('recommend') || lowerContent.includes('should') || lowerContent.includes('consider')) {
      type = 'action';
      priority = 'medium';
    } else if (lowerContent.includes('improve') || lowerContent.includes('enhance') || lowerContent.includes('optimize')) {
      type = 'improvement';
      priority = 'medium';
    } else if (lowerContent.includes('alert') || lowerContent.includes('urgent') || lowerContent.includes('critical')) {
      type = 'alert';
      priority = 'high';
    }

    if (lowerContent.includes('strong') || lowerContent.includes('excellent') || lowerContent.includes('good')) {
      priority = 'low';
    }

    return {
      id: `insight-${index + 1}`,
      type,
      title: title.slice(0, 60),
      content: parseMarkdownContent(content),
      rawContent: content,
      priority,
      icon: icons[index % icons.length]
    };
  };

  const createFallbackInsights = (content: string): AIInsight[] => {
    const fallbackInsight: AIInsight = {
      id: 'fallback-1',
      type: 'summary',
      title: 'AI Analysis Results',
      content: parseMarkdownContent(content || 'Analysis completed. Please review your practice data for insights.'),
      rawContent: content || '',
      priority: 'medium',
      icon: Brain
    };
    return [fallbackInsight];
  };

  const generateAIAnalysis = async () => {
    if (!user) {
      setError('Please log in to generate analysis');
      return;
    }
    
    setLoading(true);
    setError(null);
    setHasAnalysis(false);

    try {
      // Fetch comprehensive business data
      const [sourcesResult, monthlyResult, visitsResult, businessProfileResult] = await Promise.all([
        supabase.from('patient_sources').select('*').eq('created_by', user.id).order('created_at', { ascending: false }),
        supabase.from('monthly_patients').select('*').eq('user_id', user.id).order('year_month', { ascending: false }),
        supabase.from('marketing_visits').select('*').eq('user_id', user.id).order('visit_date', { ascending: false }),
        supabase.functions.invoke('ai-business-context', {
          body: { action: 'get' },
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
        })
      ]);

      // Handle potential errors in data fetching
      if (sourcesResult.error) throw new Error(`Sources error: ${sourcesResult.error.message}`);
      if (monthlyResult.error) throw new Error(`Monthly data error: ${monthlyResult.error.message}`);
      if (visitsResult.error) throw new Error(`Visits error: ${visitsResult.error.message}`);

      const sources = sourcesResult.data || [];
      const monthlyData = monthlyResult.data || [];
      const visits = visitsResult.data || [];
      const businessProfile = businessProfileResult.data?.profile || {};

      // Prepare comprehensive analysis data
      const analysisData: AnalysisData = {
        business_profile: businessProfile,
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
        }).slice(0, 6)
      };

      console.log('Analysis data prepared:', analysisData);

      // Call AI assistant for comprehensive analysis
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          task_type: 'comprehensive_analysis',
          context: {
            analysis_data: analysisData,
            analysis_type: 'business_intelligence'
          },
          prompt: `Analyze this healthcare practice data and provide 4-6 specific insights about:
1. Referral source concentration and diversification opportunities
2. Performance trends and seasonal patterns in referrals  
3. Marketing visit effectiveness and ROI analysis
4. Source reliability and relationship strength assessment
5. Growth opportunities and market expansion potential
6. Risk mitigation and operational improvements

Focus on actionable insights with specific data points. Each insight should start with **Bold Summary:** followed by detailed analysis and clear recommendations.`,
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

      console.log('AI Content received:', aiContent.slice(0, 200));

      // Parse and extract insights
      const generatedInsights = extractInsights(aiContent);
      
      if (generatedInsights.length === 0) {
        throw new Error('No insights could be generated from the response');
      }

      setInsights(generatedInsights);
      setHasAnalysis(true);
      
      toast({
        title: 'Analysis Complete',
        description: `Generated ${generatedInsights.length} business insights from your practice data.`,
      });

    } catch (error: any) {
      console.error('Error generating AI analysis:', error);
      setError(error.message || 'Failed to generate analysis');
      
      toast({
        title: 'Analysis Failed',
        description: error.message || 'Unable to generate analysis. Please try again.',
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

  const getCardBorderClass = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-l-4 border-l-destructive/60';
      case 'medium': return 'border-l-4 border-l-primary/60';
      case 'low': return 'border-l-4 border-l-muted-foreground/40';
      default: return '';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'risk': return 'text-destructive';
      case 'alert': return 'text-destructive';
      case 'opportunity': return 'text-primary';
      case 'improvement': return 'text-accent-foreground';
      case 'action': return 'text-secondary-foreground';
      default: return 'text-primary';
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
            <Button onClick={generateAIAnalysis} variant="outline">
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
          <h3 className="text-lg font-semibold mb-2">AI Business Intelligence</h3>
          <p className="text-muted-foreground mb-4 max-w-md mx-auto">
            Generate comprehensive insights about your referral patterns, source performance, marketing effectiveness, and growth opportunities using your complete practice data.
          </p>
          <Button onClick={generateAIAnalysis} className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Generate Analysis
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
            Analyzing your practice data with AI...
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-5 bg-muted rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded"></div>
                  <div className="h-4 bg-muted rounded w-5/6"></div>
                  <div className="h-4 bg-muted rounded w-4/6"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">AI Business Intelligence</h3>
          <p className="text-sm text-muted-foreground">
            Data-driven insights from {insights.length} analysis points
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={generateAIAnalysis}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh Analysis
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {insights.map((insight) => {
          const IconComponent = insight.icon;
          return (
            <Card 
              key={insight.id} 
              className={`${getCardBorderClass(insight.priority)} hover:shadow-md transition-all duration-200 hover:scale-[1.02]`}
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <IconComponent className={`h-5 w-5 flex-shrink-0 ${getTypeColor(insight.type)}`} />
                    <span className="truncate">{insight.title}</span>
                  </div>
                  <Badge 
                    variant={getPriorityColor(insight.priority) as any} 
                    className="text-xs ml-2 flex-shrink-0"
                  >
                    {insight.priority.toUpperCase()}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div 
                  className="text-muted-foreground leading-relaxed text-sm"
                  dangerouslySetInnerHTML={{ __html: insight.content }}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {insights.length === 0 && hasAnalysis && (
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto bg-muted/20 rounded-full flex items-center justify-center mb-4">
            <Brain className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">No insights generated. Please try refreshing the analysis.</p>
        </div>
      )}
    </div>
  );
}