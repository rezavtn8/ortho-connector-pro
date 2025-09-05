import React, { useState, useEffect } from 'react';
import { 
  Send, 
  Loader2, 
  Heart, 
  Target, 
  TrendingDown, 
  Lightbulb, 
  Network, 
  MapPin,
  MessageCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AIAssistantHeader } from '@/components/AIAssistantHeader';
import { PerformanceOverview } from '@/components/PerformanceOverview';
import { InsightCard } from '@/components/InsightCard';
import { ActionSummary } from '@/components/ActionSummary';

interface InsightData {
  title: string;
  summary: string;
  details: string;
  metrics?: Array<{
    label: string;
    value: string;
    trend?: 'up' | 'down';
    trendValue?: string;
  }>;
  progressBars?: Array<{
    label: string;
    value: number;
    color?: string;
  }>;
  actionItems?: string[];
  offices?: string[];
}

interface ChatMessage {
  id: string;
  type: 'question' | 'answer';
  content: string;
  timestamp: Date;
}

interface DataContext {
  officesCount: number;
  monthlyRecords: number;
  campaignsCount: number;
  visitsCount: number;
  discoveredOfficesCount?: number;
  reviewsCount?: number;
  dataQuality?: {
    addressCompleteness: string;
    googleIntegration: string;
    averageRating: string;
  };
}

export function AIAssistant() {
  const [dataContext, setDataContext] = useState<DataContext | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  // Mock data for insight cards
  const insightCardsData: Record<string, InsightData> = {
    relationshipHealth: {
      title: "Relationship Health",
      summary: "Overall relationship health is strong with 45 active referral sources",
      details: "Your referral network shows healthy engagement patterns with consistent communication and referral flow. Most relationships are performing well with regular touchpoints.",
      metrics: [
        { label: "Active Sources", value: "45", trend: "up", trendValue: "+3" },
        { label: "Response Rate", value: "87%", trend: "up", trendValue: "+5%" },
        { label: "Avg. Referrals/Month", value: "12.3", trend: "up", trendValue: "+2.1" }
      ],
      actionItems: [
        "Schedule quarterly check-ins with top 10 referrers",
        "Send thank you notes to high-performing offices",
        "Update contact information for 3 offices"
      ]
    },
    outreachPriorities: {
      title: "Outreach Priorities",
      summary: "3 high-value offices need immediate attention",
      details: "Focus outreach efforts on maintaining strong relationships and re-engaging with offices showing declining referral patterns.",
      offices: [
        "Manhattan Dental Group - Last referral 45 days ago",
        "Brooklyn Smiles - Referrals down 30% this quarter",
        "Queens Family Dentistry - New contact person"
      ],
      actionItems: [
        "Call Manhattan Dental Group this week",
        "Schedule lunch meeting with Brooklyn Smiles",
        "Send introduction email to Queens Family Dentistry"
      ]
    },
    decliningOffices: {
      title: "Declining Offices",
      summary: "2 offices show concerning referral decline patterns",
      details: "These offices have significantly reduced their referral activity over the past quarter and require immediate attention to understand and address potential issues.",
      offices: [
        "Manhattan Dental Group - 60% decline in referrals",
        "Brooklyn Smiles - 45% decline, new competitor nearby"
      ],
      metrics: [
        { label: "At Risk", value: "2", trend: "down", trendValue: "New" },
        { label: "Avg. Decline", value: "52%", trend: "down", trendValue: "-10%" }
      ],
      actionItems: [
        "Immediate outreach to both offices",
        "Investigate competitive landscape",
        "Offer additional support or incentives"
      ]
    },
    emergingOpportunities: {
      title: "Emerging Opportunities",
      summary: "5 new potential partnerships identified in your area",
      details: "Recent market analysis has identified several high-potential dental practices that could become valuable referral sources.",
      metrics: [
        { label: "New Prospects", value: "5", trend: "up", trendValue: "This month" },
        { label: "Estimated Value", value: "$45K", trend: "up", trendValue: "Annually" }
      ],
      actionItems: [
        "Research practice backgrounds and specialties",
        "Prepare introduction packages",
        "Schedule introduction meetings"
      ]
    },
    networkBalance: {
      title: "Network Balance",
      summary: "Good geographic coverage with specialty gaps",
      details: "Your network provides solid geographic distribution across key areas, but there are opportunities to expand in certain specialties.",
      progressBars: [
        { label: "Manhattan", value: 85 },
        { label: "Brooklyn", value: 65 },
        { label: "Queens", value: 40 },
        { label: "Bronx", value: 25 }
      ],
      actionItems: [
        "Expand presence in Queens and Bronx",
        "Target orthodontic specialists",
        "Seek pediatric dentistry partnerships"
      ]
    },
    competitiveInsight: {
      title: "Competitive Analysis",
      summary: "Strong market position with 32% share and growth opportunities",
      details: "Analysis shows you maintain a competitive advantage in your primary markets with opportunities for expansion.",
      metrics: [
        { label: "Market Share", value: "32%", trend: "up", trendValue: "+5%" },
        { label: "Growth Rate", value: "15%", trend: "up", trendValue: "YoY" },
        { label: "Competitive Ranking", value: "#2", trend: "up", trendValue: "In region" }
      ]
    }
  };

  const fetchInitialInsights = async () => {
    try {
      setInitialLoading(true);
      
      const { data, error } = await supabase.functions.invoke('gemini-insights', {
        body: { 
          question: `Please provide initial insights about my healthcare practice data. Focus on:
          1. Overall performance trends and patterns
          2. Top performing vs underperforming referral sources
          3. Patient referral volume analysis
          4. Marketing campaign effectiveness
          5. Suggested follow-up actions and opportunities
          
          Keep it concise and actionable.` 
        },
      });

      if (error) throw error;

      // Mock data context for now
      const mockDataContext: DataContext = {
        officesCount: 99,
        monthlyRecords: 165,
        campaignsCount: 0,
        visitsCount: 0,
        discoveredOfficesCount: 20,
        reviewsCount: 2
      };

      setDataContext(mockDataContext);
    } catch (error) {
      console.error('Error fetching initial insights:', error);
      toast({
        title: "Error",
        description: "Failed to load AI insights. Please try again.",
        variant: "destructive",
      });
    } finally {
      setInitialLoading(false);
    }
  };

  const askQuestion = async () => {
    if (!question.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString() + '-question',
      type: 'question',
      content: question,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setQuestion('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('gemini-insights', {
        body: { question },
      });

      if (error) throw error;

      const aiMessage: ChatMessage = {
        id: Date.now().toString() + '-answer',
        type: 'answer',
        content: data.response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error asking question:', error);
      toast({
        title: "Error",
        description: "Failed to get AI response. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      askQuestion();
    }
  };

  const toggleCardExpansion = (cardKey: string) => {
    setExpandedCards(prev => ({
      ...prev,
      [cardKey]: !prev[cardKey]
    }));
  };

  useEffect(() => {
    fetchInitialInsights();
  }, []);

  const formatMessage = (content: string) => {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .split('\n')
      .map((line, index) => (
        <div key={index} className="mb-2" dangerouslySetInnerHTML={{ __html: line }} />
      ));
  };


  if (initialLoading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6 p-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-gradient-primary animate-pulse">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
            <h1 className="text-3xl font-bold">AI Assistant</h1>
          </div>
          <p className="text-muted-foreground">Analyzing your practice data...</p>
        </div>

        <Card className="bg-gradient-card">
          <CardContent className="p-8">
            <div className="flex items-center justify-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Loading insights from your data...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-6">
      {/* Header */}
      <AIAssistantHeader
        isLoading={initialLoading}
        onRefresh={fetchInitialInsights}
        dataContext={dataContext || undefined}
      />

      {/* Performance Overview Banner */}
      <PerformanceOverview />

      {/* Insight Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <InsightCard
          title={insightCardsData.relationshipHealth.title}
          summary={insightCardsData.relationshipHealth.summary}
          details={insightCardsData.relationshipHealth.details}
          icon={Heart}
          colorTheme="green"
          isExpanded={expandedCards.relationshipHealth || false}
          onToggle={() => toggleCardExpansion('relationshipHealth')}
          metrics={insightCardsData.relationshipHealth.metrics}
          actionItems={insightCardsData.relationshipHealth.actionItems}
        />
        
        <InsightCard
          title={insightCardsData.outreachPriorities.title}
          summary={insightCardsData.outreachPriorities.summary}
          details={insightCardsData.outreachPriorities.details}
          icon={Target}
          colorTheme="blue"
          isExpanded={expandedCards.outreachPriorities || false}
          onToggle={() => toggleCardExpansion('outreachPriorities')}
          offices={insightCardsData.outreachPriorities.offices}
          actionItems={insightCardsData.outreachPriorities.actionItems}
        />

        <InsightCard
          title={insightCardsData.decliningOffices.title}
          summary={insightCardsData.decliningOffices.summary}
          details={insightCardsData.decliningOffices.details}
          icon={TrendingDown}
          colorTheme="red"
          isExpanded={expandedCards.decliningOffices || false}
          onToggle={() => toggleCardExpansion('decliningOffices')}
          offices={insightCardsData.decliningOffices.offices}
          metrics={insightCardsData.decliningOffices.metrics}
          actionItems={insightCardsData.decliningOffices.actionItems}
        />

        <InsightCard
          title={insightCardsData.emergingOpportunities.title}
          summary={insightCardsData.emergingOpportunities.summary}
          details={insightCardsData.emergingOpportunities.details}
          icon={Lightbulb}
          colorTheme="yellow"
          isExpanded={expandedCards.emergingOpportunities || false}
          onToggle={() => toggleCardExpansion('emergingOpportunities')}
          metrics={insightCardsData.emergingOpportunities.metrics}
          actionItems={insightCardsData.emergingOpportunities.actionItems}
        />

        <InsightCard
          title={insightCardsData.networkBalance.title}
          summary={insightCardsData.networkBalance.summary}
          details={insightCardsData.networkBalance.details}
          icon={Network}
          colorTheme="purple"
          isExpanded={expandedCards.networkBalance || false}
          onToggle={() => toggleCardExpansion('networkBalance')}
          progressBars={insightCardsData.networkBalance.progressBars}
          actionItems={insightCardsData.networkBalance.actionItems}
        />

        <InsightCard
          title={insightCardsData.competitiveInsight.title}
          summary={insightCardsData.competitiveInsight.summary}
          details={insightCardsData.competitiveInsight.details}
          icon={MapPin}
          colorTheme="cyan"
          isExpanded={expandedCards.competitiveInsight || false}
          onToggle={() => toggleCardExpansion('competitiveInsight')}
          metrics={insightCardsData.competitiveInsight.metrics}
        />
      </div>

      {/* Action Summary */}
      <ActionSummary />

      {/* Chat Section */}
      <Card className="bg-gradient-card border shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <div className="p-2 rounded-lg bg-primary/10">
              <MessageCircle className="w-5 h-5 text-primary" />
            </div>
            Ask Follow-up Questions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Chat Messages */}
          <ScrollArea className="h-64 pr-4">
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <div className="p-4 rounded-full bg-primary/10 w-fit mx-auto mb-4">
                    <MessageCircle className="w-12 h-12 text-primary" />
                  </div>
                  <p className="font-medium mb-2">Ask questions about your data</p>
                  <p className="text-sm">
                    Try: "Which offices send me the most patients?" or "What trends do you see?"
                  </p>
                </div>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className="space-y-2">
                    {message.type === 'question' ? (
                      <div className="bg-gradient-primary p-4 rounded-xl ml-auto max-w-[85%] text-white shadow-glow">
                        <p className="text-sm font-medium">{message.content}</p>
                        <p className="text-xs text-white/80 mt-2">
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-gradient-card p-4 rounded-xl mr-auto max-w-[85%] border shadow-card">
                        <div className="text-sm prose prose-sm max-w-none dark:prose-invert">
                          {formatMessage(message.content)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    )}
                  </div>
                ))
              )}

              {isLoading && (
                <div className="bg-gradient-card p-4 rounded-xl mr-auto max-w-[85%] border shadow-card">
                  <div className="flex items-center gap-3">
                    <div className="p-1 rounded-full bg-primary/10">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    </div>
                    <span className="text-sm font-medium">AI is analyzing your data...</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <Separator />

          {/* Question Input */}
          <div className="flex gap-3">
            <Input
              placeholder="Ask about your practice data..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              className="flex-1 bg-background/50 border-border/50 focus:bg-background"
            />
            <Button 
              onClick={askQuestion} 
              disabled={isLoading || !question.trim()}
              className="bg-gradient-primary hover:opacity-90 text-white shadow-glow"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Suggested Questions */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground">Suggested questions:</p>
            <div className="flex flex-wrap gap-2">
              {[
                "Which offices send the most patients?",
                "What are my trending patterns?",
                "How effective are my campaigns?",
                "Which areas need attention?"
              ].map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  className="text-xs bg-background/50 hover:bg-primary/10 hover:border-primary/30 hover:text-primary transition-all"
                  onClick={() => setQuestion(suggestion)}
                  disabled={isLoading}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}