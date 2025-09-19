import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, TrendingUp, Target, Users, Activity, Zap, Brain, RefreshCw, BarChart3, MapPin, Calendar, Shield, Search, DollarSign } from 'lucide-react';
import { InsightDetailModal } from '@/components/InsightDetailModal';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface AIInsight {
  id: string;
  type: 'summary' | 'action' | 'improvement' | 'alert';
  title: string;
  content: string;
  executiveSummary: string;
  truncatedPreview: string;
  priority: 'high' | 'medium' | 'low';
  icon: any;
}

export function AIDataAnalysis() {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasAnalysis, setHasAnalysis] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState<AIInsight | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const { user } = useAuth();

  // Predefined insight categories with their icons
  const insightCategories = [
    { title: 'Source Distribution', icon: BarChart3 },
    { title: 'Performance Trends', icon: TrendingUp },
    { title: 'Geographic Distribution', icon: MapPin },
    { title: 'Source Quality & Reliability', icon: Shield },
    { title: 'Strategic Recommendations', icon: Target },
    { title: 'Emerging Patterns', icon: Search }
  ];

  const generateAIAnalysis = async () => {
    if (!user) return;
    
    setLoading(true);
    setHasAnalysis(false);

    try {
      // Fetch comprehensive business data
      const [sourcesResult, monthlyResult, visitsResult, businessProfileResult] = await Promise.all([
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

      const sources = sourcesResult.data || [];
      const monthlyData = monthlyResult.data || [];
      const visits = visitsResult.data || [];
      const businessProfile = businessProfileResult.data?.profile || {};

      // Prepare comprehensive data for AI analysis
      const analysisData = {
        business_profile: businessProfile,
        sources: sources,
        monthly_data: monthlyData,
        visits: visits,
        total_sources: sources.length,
        total_referrals: monthlyData.reduce((sum, m) => sum + (m.patient_count || 0), 0),
        source_types: sources.reduce((acc, s) => {
          acc[s.source_type] = (acc[s.source_type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        last_6_months: monthlyData.filter(m => {
          const monthDate = new Date(m.year_month + '-01');
          const sixMonthsAgo = new Date();
          sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
          return monthDate >= sixMonthsAgo;
        })
      };

      // Call AI assistant for comprehensive analysis
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          task_type: 'comprehensive_analysis',
          context: {
            analysis_data: analysisData,
            insight_categories: insightCategories.map(cat => cat.title)
          },
          prompt: `Generate structured insights for each of these 6 specific categories using real data:
1. Source Distribution - analyze referral source concentration, diversity, and dependency risks
2. Performance Trends - identify seasonal patterns, growth/decline trends in patient volume  
3. Geographic Distribution - examine location-based referral patterns and market coverage
4. Source Quality & Reliability - evaluate source consistency, reliability scores, and performance
5. Strategic Recommendations - provide specific actionable strategies based on data analysis
6. Emerging Patterns - identify new trends, opportunities, or risks in the data

For each category, structure your response with:
- Executive Summary (1 bold sentence)
- Supporting Data (specific numbers from the provided data)
- Insight Analysis (interpretation of what the data means)
- Recommended Actions (specific next steps)

Use only real data provided. If insufficient data exists for a category, state "Not enough data available to generate this insight."`,
        },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;

      // Parse AI response and create insight cards
      const aiContent = data.content || '';
      let sections: string[];
      
      // Try to split by numbered sections first, then by category names if that fails
      if (aiContent.includes('1.') && aiContent.includes('2.')) {
        sections = aiContent.split(/\d+\.\s*/);
      } else {
        // Split by category titles as fallback
        const categoryPattern = new RegExp(`(${insightCategories.map(cat => cat.title).join('|')})`, 'gi');
        sections = aiContent.split(categoryPattern).filter(s => s.trim());
      }
      
      const generatedInsights: AIInsight[] = [];
      const types = ['summary', 'improvement', 'alert', 'action', 'summary', 'improvement'] as const;

      // Process each category
      insightCategories.forEach((category, index) => {
        let content = '';
        let executiveSummary = '';
        let truncatedPreview = '';
        
        // Find matching content for this category
        const categoryIndex = sections.findIndex(section => 
          section.toLowerCase().includes(category.title.toLowerCase()) ||
          (index < sections.length - 1 && sections[index + 1])
        );
        
        if (categoryIndex !== -1 && categoryIndex + 1 < sections.length) {
          content = sections[categoryIndex + 1];
        } else if (index + 1 < sections.length) {
          content = sections[index + 1] || '';
        }

        // Clean and format content
        const cleanContent = content
          .replace(/\*\*(.*?)\*\*/g, '$1')
          .replace(/\*(.*?)\*/g, '$1')
          .replace(/###\s*/g, '')
          .replace(/--+/g, '')
          .trim();

        if (!cleanContent || cleanContent === category.title) {
          content = 'Not enough data available to generate this insight.';
          executiveSummary = 'Insufficient data for analysis';
          truncatedPreview = 'Not enough data available to generate this insight.';
        } else {
          const lines = cleanContent.split('\n').filter(line => line.trim());
          
          // Extract executive summary (first substantial line)
          executiveSummary = lines[0] || 'Analysis available';
          
          // Create truncated preview (first 3-4 lines)
          truncatedPreview = lines.slice(0, 4).join('\n') + (lines.length > 4 ? '...' : '');
          content = cleanContent;
        }
        
        // Determine priority based on keywords
        let priority: 'high' | 'medium' | 'low' = 'medium';
        if (content.toLowerCase().includes('risk') || content.toLowerCase().includes('concern') || 
            content.toLowerCase().includes('urgent') || content.toLowerCase().includes('critical')) {
          priority = 'high';
        } else if (content.toLowerCase().includes('opportunity') || content.toLowerCase().includes('growth') ||
                   content.toLowerCase().includes('improve') || content.toLowerCase().includes('increase')) {
          priority = 'medium';  
        } else if (content.toLowerCase().includes('good') || content.toLowerCase().includes('strong') ||
                   content.toLowerCase().includes('excellent') || content.toLowerCase().includes('performing well')) {
          priority = 'low';
        }

        generatedInsights.push({
          id: (index + 1).toString(),
          type: types[index % types.length],
          title: category.title,
          content: content,
          executiveSummary: executiveSummary,
          truncatedPreview: truncatedPreview,
          priority: priority,
          icon: category.icon
        });
      });

      setInsights(generatedInsights);
      setHasAnalysis(true);
      
      toast({
        title: 'Analysis Complete',
        description: 'Your comprehensive business analysis has been generated.',
      });

    } catch (error: any) {
      console.error('Error generating AI analysis:', error);
      toast({
        title: 'Analysis Failed',
        description: 'Unable to generate analysis. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high': 
        return { 
          variant: 'destructive' as const, 
          className: 'bg-red-500/10 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-800',
          label: 'High Risk'
        };
      case 'medium': 
        return { 
          variant: 'default' as const, 
          className: 'bg-orange-500/10 text-orange-700 border-orange-200 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-800',
          label: 'Medium'
        };
      case 'low': 
        return { 
          variant: 'secondary' as const, 
          className: 'bg-green-500/10 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-800',
          label: 'Low Risk'
        };
      default: 
        return { 
          variant: 'default' as const, 
          className: 'bg-blue-500/10 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-800',
          label: 'Info'
        };
    }
  };

  const getCardStyle = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-l-4 border-l-red-500 bg-gradient-to-r from-red-50/50 to-transparent dark:from-red-950/20';
      case 'medium': return 'border-l-4 border-l-orange-500 bg-gradient-to-r from-orange-50/50 to-transparent dark:from-orange-950/20';
      case 'low': return 'border-l-4 border-l-green-500 bg-gradient-to-r from-green-50/50 to-transparent dark:from-green-950/20';
      default: return 'border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-950/20';
    }
  };

  const handleSeeMore = (insight: AIInsight) => {
    setSelectedInsight(insight);
    setShowDetailModal(true);
  };

  if (!hasAnalysis && !loading) {
    return (
      <div className="text-center space-y-6 py-12">
        <div className="w-20 h-20 mx-auto bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center shadow-lg">
          <Brain className="h-10 w-10 text-primary" />
        </div>
        <div className="space-y-4">
          <h3 className="text-2xl font-bold text-foreground">AI Business Intelligence</h3>
          <p className="text-muted-foreground text-base max-w-lg mx-auto leading-relaxed">
            Generate comprehensive insights about your referral patterns, source distribution, performance trends, and actionable recommendations based on your complete practice data.
          </p>
          <Button 
            onClick={generateAIAnalysis} 
            className="bg-primary hover:bg-primary/90 px-6 py-3 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200"
            size="lg"
          >
            <BarChart3 className="h-5 w-5 mr-2" />
            Generate Analysis
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="text-center py-6">
          <div className="inline-flex items-center gap-3 text-base text-muted-foreground bg-muted/50 px-6 py-3 rounded-full">
            <div className="animate-spin">
              <RefreshCw className="h-5 w-5" />
            </div>
            Analyzing your practice data...
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse rounded-xl border-0 shadow-md h-[280px]">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-muted rounded-lg"></div>
                    <div className="h-6 bg-muted rounded-lg w-32"></div>
                  </div>
                  <div className="h-6 w-16 bg-muted rounded-full"></div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="h-4 bg-muted rounded-lg"></div>
                <div className="h-4 bg-muted rounded-lg w-5/6"></div>
                <div className="h-4 bg-muted rounded-lg w-4/6"></div>
                <div className="h-4 bg-muted rounded-lg w-3/4"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-2xl font-bold text-foreground">AI Business Intelligence</h3>
          <p className="text-muted-foreground">Data-driven insights and strategic recommendations</p>
        </div>
        <Button 
          variant="outline" 
          size="default"
          onClick={generateAIAnalysis}
          disabled={loading}
          className="rounded-xl px-4 py-2 font-medium border-2 hover:bg-muted/50 transition-all duration-200"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {insights.map((insight) => {
          const IconComponent = insight.icon;
          const badgeInfo = getPriorityBadge(insight.priority);
          
          return (
            <Card 
              key={insight.id} 
              className={`${getCardStyle(insight.priority)} hover:shadow-lg hover:-translate-y-1 transition-all duration-300 rounded-xl border-0 shadow-md h-[280px] flex flex-col`}
            >
              <CardHeader className="pb-3 flex-shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                      <IconComponent className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-base font-bold text-foreground leading-tight">
                      {insight.title}
                    </CardTitle>
                  </div>
                  <Badge 
                    className={`${badgeInfo.className} text-xs font-medium px-2 py-1 rounded-full border flex-shrink-0`}
                  >
                    {badgeInfo.label}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="flex-1 flex flex-col justify-between overflow-hidden">
                <div className="space-y-3">
                  {/* Executive Summary */}
                  <div className="font-semibold text-foreground text-sm leading-tight">
                    {insight.executiveSummary}
                  </div>
                  
                  {/* Truncated Preview */}
                  <div className="text-muted-foreground text-sm leading-relaxed line-clamp-4">
                    {insight.truncatedPreview.split('\n').slice(0, 3).map((line, index) => 
                      line.trim() && (
                        <p key={index} className="mb-2 last:mb-0">
                          {line.replace(/^\s*[\-\*\+]\s*/, '• ')}
                        </p>
                      )
                    )}
                  </div>
                </div>
                
                {/* See More Button */}
                <div className="pt-3 border-t border-border">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full text-primary hover:text-primary hover:bg-primary/5 font-medium"
                    onClick={() => handleSeeMore(insight)}
                  >
                    See More
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Detail Modal */}
      <InsightDetailModal 
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        insight={selectedInsight}
      />
    </div>
  );
}