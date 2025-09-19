import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, TrendingUp, Target, Users, Activity, Zap, Brain, RefreshCw, BarChart3, MapPin, Calendar, Shield, Search, DollarSign, ChevronUp, ChevronDown } from 'lucide-react';
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
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const { user } = useAuth();

  const toggleCardExpansion = (cardId: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(cardId)) {
      newExpanded.delete(cardId);
    } else {
      newExpanded.add(cardId);
    }
    setExpandedCards(newExpanded);
  };

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
      // Modern flat icons in teal/blue tones
      const icons = [BarChart3, TrendingUp, Target, Activity, Shield, Users];
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
          className: 'bg-red-50 text-red-600 border border-red-100 dark:bg-red-950/50 dark:text-red-400 dark:border-red-900/50',
          label: 'High'
        };
      case 'medium': 
        return { 
          className: 'bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-900/50',
          label: 'Medium'
        };
      case 'low': 
        return { 
          className: 'bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-900/50',
          label: 'Low'
        };
      default: 
        return { 
          className: 'bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-900/50',
          label: 'Info'
        };
    }
  };

  const getCardStyle = (priority: string) => {
    const baseStyle = 'bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800';
    switch (priority) {
      case 'high': return `${baseStyle} border-l-4 border-l-red-400`;
      case 'medium': return `${baseStyle} border-l-4 border-l-amber-400`;
      case 'low': return `${baseStyle} border-l-4 border-l-emerald-400`;
      default: return `${baseStyle} border-l-4 border-l-blue-400`;
    }
  };

  const formatContent = (content: string) => {
    // Clean and format content for modern display
    let cleaned = content
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
      .replace(/\*(.*?)\*/g, '$1') // Remove italic markdown
      .replace(/###\s*/g, '') // Remove heading symbols
      .replace(/--+/g, '') // Remove dashes
      .replace(/^\s*[\-\*\+]\s*/gm, '• ') // Convert list items to bullets
      .trim();
    
    // Split into sentences and clean up
    const sentences = cleaned.split(/[.!?]+/).filter(s => s.trim().length > 10);
    return sentences.map(s => s.trim()).join('. ') + (sentences.length > 0 ? '.' : '');
  };

  const getInsightType = (type: string) => {
    switch (type) {
      case 'summary': return { label: 'Data', color: 'text-blue-600 dark:text-blue-400' };
      case 'improvement': return { label: 'Insight', color: 'text-teal-600 dark:text-teal-400' };
      case 'alert': return { label: 'Alert', color: 'text-red-600 dark:text-red-400' };
      case 'action': return { label: 'Action', color: 'text-purple-600 dark:text-purple-400' };
      default: return { label: 'Info', color: 'text-gray-600 dark:text-gray-400' };
    }
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
          <h3 className="text-3xl font-bold text-foreground">AI Business Intelligence</h3>
          <p className="text-muted-foreground text-lg">Data-driven insights and strategic recommendations</p>
        </div>
        <Button 
          variant="outline" 
          size="default"
          onClick={generateAIAnalysis}
          disabled={loading}
          className="rounded-full px-6 py-2 font-medium hover:bg-muted/50 transition-all duration-200 border-gray-200 dark:border-gray-700"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
      
      {/* Background tint for grid area */}
      <div className="bg-gray-50/50 dark:bg-gray-900/20 rounded-3xl p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {insights.map((insight) => {
            const IconComponent = insight.icon;
            const badgeInfo = getPriorityBadge(insight.priority);
            const typeInfo = getInsightType(insight.type);
            const formattedContent = formatContent(insight.content);
            const isExpanded = expandedCards.has(insight.id);
            const shouldTruncate = formattedContent.length > 150;
            const displayContent = shouldTruncate && !isExpanded 
              ? formattedContent.substring(0, 150) + "..." 
              : formattedContent;
            
            return (
              <Card 
                key={insight.id} 
                className={`${getCardStyle(insight.priority)} hover:shadow-xl hover:-translate-y-2 transition-all duration-300 rounded-2xl shadow-md ${isExpanded ? 'h-auto' : 'h-[300px]'} flex flex-col group`}
              >
                <CardHeader className="pb-3 flex-shrink-0">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="p-2.5 bg-teal-50 dark:bg-teal-950/50 rounded-xl flex-shrink-0">
                        <IconComponent className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={`text-xs font-medium uppercase tracking-wider mb-1 ${typeInfo.color}`}>
                          {typeInfo.label}
                        </div>
                        <CardTitle className="text-xl font-bold text-foreground leading-tight">
                          {insight.title}
                        </CardTitle>
                      </div>
                    </div>
                    <Badge 
                      className={`${badgeInfo.className} text-xs font-medium px-3 py-1.5 rounded-full flex-shrink-0 shadow-sm`}
                    >
                      {badgeInfo.label}
                    </Badge>
                  </div>
                  
                  {/* Light divider */}
                  <div className="w-full h-px bg-gray-200 dark:bg-gray-700"></div>
                </CardHeader>
                
                <CardContent className="flex-1 overflow-hidden flex flex-col">
                  <div className={`text-gray-600 dark:text-gray-300 leading-relaxed text-sm ${isExpanded ? 'flex-1' : 'flex-1 overflow-hidden'}`}>
                    <p className="font-light whitespace-pre-wrap">
                      {displayContent}
                    </p>
                  </div>
                  
                  {shouldTruncate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleCardExpansion(insight.id)}
                      className="mt-3 p-0 h-auto text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium text-xs self-start"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-3 w-3 mr-1" />
                          Show Less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3 w-3 mr-1" />
                          See More
                        </>
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}