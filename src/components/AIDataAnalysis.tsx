import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, TrendingUp, Target, Users, Activity, Zap, Brain, RefreshCw, BarChart3, MapPin, Calendar, Shield, Search, DollarSign } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface AIInsight {
  id: string;
  type: 'summary' | 'action' | 'improvement' | 'alert';
  title: string;
  content: string;
  priority: 'high' | 'medium' | 'low';
  icon: any;
}

export function AIDataAnalysis() {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasAnalysis, setHasAnalysis] = useState(false);
  const { user } = useAuth();

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
            analysis_type: 'business_intelligence'
          },
          prompt: `Analyze the complete business data and provide 4-6 comprehensive insights covering:
1. Referral source distribution and concentration risk
2. Performance trends and seasonal patterns  
3. Geographic distribution and market penetration
4. Source quality and reliability analysis
5. Specific actionable recommendations with data points
6. Risk factors and improvement opportunities

Focus on specific data-driven insights, not generic advice. Include actual numbers and percentages where relevant.`,
        },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;

      // Parse AI response and create insight cards
      const aiContent = data.content || '';
      const sections = aiContent.split(/\d+\./);
      
      const generatedInsights: AIInsight[] = [];
      const icons = [BarChart3, TrendingUp, MapPin, Target, Shield, Search];
      const types = ['summary', 'improvement', 'alert', 'action'] as const;

      sections.slice(1).forEach((section, index) => {
        if (section.trim() && index < 6) {
          const lines = section.trim().split('\n');
          const title = lines[0]?.replace(/[:,-].*/, '').trim() || `Analysis ${index + 1}`;
          const content = lines.slice(1).join('\n').trim() || section.trim();
          
          // Determine priority based on keywords
          let priority: 'high' | 'medium' | 'low' = 'medium';
          if (content.toLowerCase().includes('risk') || content.toLowerCase().includes('concern') || 
              content.toLowerCase().includes('urgent') || content.toLowerCase().includes('critical')) {
            priority = 'high';
          } else if (content.toLowerCase().includes('opportunity') || content.toLowerCase().includes('growth')) {
            priority = 'medium';
          } else if (content.toLowerCase().includes('good') || content.toLowerCase().includes('strong')) {
            priority = 'low';
          }

          generatedInsights.push({
            id: (index + 1).toString(),
            type: types[index % types.length],
            title: title,
            content: content,
            priority: priority,
            icon: icons[index % icons.length]
          });
        }
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

  const formatContent = (content: string) => {
    // Remove markdown symbols and format text for better readability
    return content
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
      .replace(/\*(.*?)\*/g, '$1') // Remove italic markdown
      .replace(/###\s*/g, '') // Remove heading symbols
      .replace(/--+/g, '') // Remove dashes
      .replace(/^\s*[\-\*\+]\s*/gm, '• ') // Convert list items to bullets
      .split('\n')
      .filter(line => line.trim()) // Remove empty lines
      .join('\n');
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
      
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
        {insights.map((insight) => {
          const IconComponent = insight.icon;
          const badgeInfo = getPriorityBadge(insight.priority);
          const formattedContent = formatContent(insight.content);
          
          return (
            <Card 
              key={insight.id} 
              className={`${getCardStyle(insight.priority)} hover:shadow-xl hover:-translate-y-1 transition-all duration-300 rounded-xl border-0 shadow-lg h-[320px] flex flex-col`}
            >
              <CardHeader className="pb-4 flex-shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                      <IconComponent className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg font-bold text-foreground leading-tight line-clamp-2">
                      {insight.title}
                    </CardTitle>
                  </div>
                  <Badge 
                    className={`${badgeInfo.className} text-xs font-medium px-3 py-1 rounded-full border flex-shrink-0`}
                  >
                    {badgeInfo.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                <div className="text-muted-foreground leading-relaxed text-sm line-clamp-8">
                  {formattedContent.split('\n').map((line, index) => {
                    if (line.startsWith('• ')) {
                      return (
                        <div key={index} className="flex items-start gap-2 mb-2">
                          <span className="text-primary font-bold text-xs mt-1">•</span>
                          <span className="flex-1">{line.substring(2)}</span>
                        </div>
                      );
                    }
                    return line.trim() && (
                      <p key={index} className="mb-3 last:mb-0">
                        {line}
                      </p>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}