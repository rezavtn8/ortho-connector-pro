import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart3, TrendingUp, MapPin, Target, Shield, Search, Brain, RefreshCw, Eye } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { InsightModal } from './InsightModal';

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
  const [selectedInsight, setSelectedInsight] = useState<AIInsight | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
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

  const openModal = (insight: AIInsight) => {
    setSelectedInsight(insight);
    setIsModalOpen(true);
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high': 
        return { 
          className: 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400',
          label: 'High'
        };
      case 'medium': 
        return { 
          className: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400',
          label: 'Med'
        };
      case 'low': 
        return { 
          className: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
          label: 'Low'
        };
      default: 
        return { 
          className: 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400',
          label: 'Info'
        };
    }
  };

  const getCardStyle = () => {
    return 'bg-card border border-border/50';
  };

  const formatContent = (content: string, forDisplay = false) => {
    let formatted = content
      .replace(/###\s*/g, '') // Remove heading symbols
      .replace(/--+/g, '') // Remove dashes
      .replace(/^\s*[\-\*\+]\s*/gm, '• '); // Convert list items to bullets

    if (forDisplay) {
      // For display in cards, keep bold formatting but clean up
      formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    } else {
      // For truncated preview, remove all markdown
      formatted = formatted.replace(/\*\*(.*?)\*\*/g, '$1');
    }
    
    return formatted
      .split('\n')
      .filter(line => line.trim())
      .join('\n');
  };

  const truncateText = (text: string, maxLength: number = 150) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
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
      
      <div className="bg-muted/30 rounded-2xl p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {insights.map((insight) => {
            const IconComponent = insight.icon;
            const badgeInfo = getPriorityBadge(insight.priority);
            const formattedContent = formatContent(insight.content);
            const truncatedContent = truncateText(formattedContent);
            const shouldTruncate = formattedContent.length > 150;
            
            return (
              <Card 
                key={insight.id} 
                className={`${getCardStyle()} hover:shadow-lg hover:-translate-y-1 transition-all duration-300 rounded-xl h-[280px] flex flex-col group cursor-pointer`}
                onClick={() => shouldTruncate && openModal(insight)}
              >
                <CardHeader className="pb-3 flex-shrink-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="p-2 bg-cyan-50 dark:bg-cyan-950/50 rounded-lg flex-shrink-0">
                        <IconComponent className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                      </div>
                      <CardTitle className="text-base font-bold text-foreground leading-tight">
                        {insight.title}
                      </CardTitle>
                    </div>
                    <Badge 
                      className={`${badgeInfo.className} text-xs font-medium px-2 py-1 rounded-full border-0 flex-shrink-0`}
                    >
                      {badgeInfo.label}
                    </Badge>
                  </div>
                </CardHeader>
                
                <div className="px-6 mb-3">
                  <div className="h-px bg-border/50"></div>
                </div>
                
                <CardContent className="flex-1 flex flex-col pt-0">
                  <div className="text-muted-foreground leading-relaxed text-sm flex-1">
                    <div 
                      dangerouslySetInnerHTML={{ 
                        __html: formatContent(truncatedContent, true) 
                      }}
                      className="prose prose-sm max-w-none dark:prose-invert [&>strong]:font-semibold [&>strong]:text-foreground"
                    />
                  </div>
                  
                  {shouldTruncate && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 text-xs text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 font-medium group-hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          openModal(insight);
                        }}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        See More
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <InsightModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        insight={selectedInsight}
      />
    </div>
  );
}