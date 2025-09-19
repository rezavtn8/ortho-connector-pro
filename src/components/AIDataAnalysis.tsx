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

      // Prepare more detailed analysis data with actual business metrics
      const currentMonth = new Date().toISOString().slice(0, 7);
      const last6MonthsData = monthlyData.filter(m => {
        const monthDate = new Date(m.year_month + '-01');
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        return monthDate >= sixMonthsAgo;
      });

      // Calculate source-specific metrics
      const sourceMetrics = sources.map(source => {
        const sourceMonthlyData = monthlyData.filter(m => m.source_id === source.id);
        const totalPatients = sourceMonthlyData.reduce((sum, m) => sum + (m.patient_count || 0), 0);
        const recentPatients = sourceMonthlyData
          .filter(m => m.year_month >= currentMonth.slice(0, 7))
          .reduce((sum, m) => sum + (m.patient_count || 0), 0);
        
        return {
          name: source.name,
          type: source.source_type,
          address: source.address,
          total_patients: totalPatients,
          recent_patients: recentPatients,
          last_referral: sourceMonthlyData
            .sort((a, b) => b.year_month.localeCompare(a.year_month))
            .find(m => m.patient_count > 0)?.year_month || 'No recent referrals'
        };
      });

      // Calculate geographic distribution
      const geographicData = sources
        .filter(s => s.address)
        .map(s => ({
          name: s.name,
          address: s.address,
          patients: monthlyData
            .filter(m => m.source_id === s.id)
            .reduce((sum, m) => sum + (m.patient_count || 0), 0)
        }))
        .sort((a, b) => b.patients - a.patients);

      const analysisData = {
        business_profile: businessProfile,
        raw_sources: sources,
        raw_monthly_data: monthlyData,
        raw_visits: visits,
        metrics: {
          total_sources: sources.length,
          active_sources: sources.filter(s => s.is_active).length,
          total_lifetime_referrals: monthlyData.reduce((sum, m) => sum + (m.patient_count || 0), 0),
          current_month_referrals: monthlyData
            .filter(m => m.year_month === currentMonth)
            .reduce((sum, m) => sum + (m.patient_count || 0), 0),
          last_6_months_referrals: last6MonthsData.reduce((sum, m) => sum + (m.patient_count || 0), 0)
        },
        source_breakdown: sourceMetrics,
        geographic_distribution: geographicData.slice(0, 10),
        source_types_distribution: sources.reduce((acc, s) => {
          acc[s.source_type] = (acc[s.source_type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        monthly_trends: last6MonthsData.reduce((acc, m) => {
          if (!acc[m.year_month]) {
            acc[m.year_month] = 0;
          }
          acc[m.year_month] += m.patient_count || 0;
          return acc;
        }, {} as Record<string, number>),
        top_performers: sourceMetrics
          .filter(s => s.total_patients > 0)
          .sort((a, b) => b.total_patients - a.total_patients)
          .slice(0, 5),
        underperformers: sourceMetrics
          .filter(s => s.total_patients === 0 || s.recent_patients === 0)
      };

      // Call AI assistant for comprehensive analysis
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          task_type: 'comprehensive_analysis',
          context: {
            analysis_data: analysisData,
            analysis_type: 'business_intelligence'
          },
          prompt: `CRITICAL: Use ONLY the actual data provided below. Do NOT create sample data, placeholder names, or fictional examples.

REAL CLINIC DATA ANALYSIS:

BUSINESS METRICS:
- Total Sources: ${analysisData.metrics.total_sources}
- Active Sources: ${analysisData.metrics.active_sources}  
- Lifetime Referrals: ${analysisData.metrics.total_lifetime_referrals}
- Current Month: ${analysisData.metrics.current_month_referrals} referrals
- Last 6 Months: ${analysisData.metrics.last_6_months_referrals} referrals

TOP PERFORMING SOURCES (by total patients):
${analysisData.top_performers.map((s, i) => 
  `${i+1}. ${s.name} - ${s.total_patients} patients (${s.type}, ${s.address || 'No address'})`
).join('\n')}

SOURCE TYPE BREAKDOWN:
${Object.entries(analysisData.source_types_distribution).map(([type, count]) => 
  `- ${type}: ${count} sources (${Math.round(count/analysisData.metrics.total_sources*100)}%)`
).join('\n')}

MONTHLY TREND (Last 6 Months):
${Object.entries(analysisData.monthly_trends).map(([month, count]) => 
  `- ${month}: ${count} patients`
).join('\n')}

UNDERPERFORMING SOURCES:
${analysisData.underperformers.slice(0, 5).map(s => 
  `- ${s.name} (${s.type}): ${s.total_patients} total patients, ${s.recent_patients} recent`
).join('\n')}

REQUIREMENTS:
1. Reference ONLY these actual source names, numbers, and data points
2. Calculate actual percentages from the real data provided
3. Each insight must have: Bold executive summary (one sentence), Supporting data (real numbers), Insight (interpretation)
4. Do NOT use examples like "SmileWorks Dental" unless that exact name appears in the data above
5. Remove ** from section titles - use clean text headers
6. Provide 4-6 comprehensive insights covering distribution, trends, geographic patterns, and actionable recommendations`,
        },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;

      // Parse AI response more carefully to extract real insights
      const aiContent = data.content || '';
      
      // Split by numbered sections and clean up formatting
      let sections = aiContent.split(/(?=\d+\.\s)/);
      if (sections[0].trim() === '') {
        sections = sections.slice(1);
      }
      
      const generatedInsights: AIInsight[] = [];
      const icons = [BarChart3, TrendingUp, MapPin, Target, Shield, Search];
      const types = ['summary', 'improvement', 'alert', 'action'] as const;

      sections.forEach((section, index) => {
        if (section.trim() && index < 6) {
          const lines = section.trim().split('\n');
          // Remove the number prefix and clean title
          let title = lines[0]?.replace(/^\d+\.\s*/, '').replace(/\*\*/g, '').trim() || `Analysis ${index + 1}`;
          
          // Extract executive summary (usually in bold or first substantive line)
          let executiveSummary = '';
          let remainingContent = '';
          
          const contentLines = lines.slice(1).join('\n');
          
          // Look for bold executive summary
          const boldMatch = contentLines.match(/\*\*([^*]+)\*\*/);
          if (boldMatch) {
            executiveSummary = boldMatch[1];
            remainingContent = contentLines.replace(boldMatch[0], '').trim();
          } else {
            // Use first substantial sentence as executive summary
            const sentences = contentLines.split(/[.!?]+/);
            executiveSummary = sentences[0]?.trim() + '.' || '';
            remainingContent = sentences.slice(1).join('. ').trim();
          }
          
          const fullContent = executiveSummary ? 
            `**${executiveSummary}**\n\n${remainingContent}` : 
            contentLines;
          
          // Determine priority based on content analysis
          let priority: 'high' | 'medium' | 'low' = 'medium';
          const contentLower = fullContent.toLowerCase();
          if (contentLower.includes('risk') || contentLower.includes('concern') || 
              contentLower.includes('urgent') || contentLower.includes('critical') ||
              contentLower.includes('0 referral') || contentLower.includes('no recent')) {
            priority = 'high';
          } else if (contentLower.includes('opportunity') || contentLower.includes('growth') ||
                     contentLower.includes('improve') || contentLower.includes('increase')) {
            priority = 'medium';
          } else if (contentLower.includes('strong') || contentLower.includes('good') ||
                     contentLower.includes('performing well')) {
            priority = 'low';
          }

          generatedInsights.push({
            id: (index + 1).toString(),
            type: types[index % types.length],
            title: title,
            content: fullContent,
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