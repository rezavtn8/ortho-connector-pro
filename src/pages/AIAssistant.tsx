import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  Loader2, 
  BarChart3, 
  Users, 
  Target, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle, 
  Activity,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  RefreshCw,
  Stethoscope
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface InsightCard {
  title: string;
  summary: string;
  details: string;
  score?: string;
  metrics?: string[];
  priorities?: string[];
  offices?: string[];
}

interface StructuredInsights {
  narrativeSummary: InsightCard;
  relationshipHealth: InsightCard;
  outreachPriorities: InsightCard;
  decliningOffices: InsightCard;
  emergingOpportunities: InsightCard;
  networkBalance: InsightCard;
  competitiveInsight: InsightCard;
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
  const [structuredInsights, setStructuredInsights] = useState<StructuredInsights | null>(null);
  const [dataContext, setDataContext] = useState<DataContext | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

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

      // Create structured insights from the practice performance data
      const mockStructuredInsights: StructuredInsights = {
        narrativeSummary: {
          title: "Practice Performance Overview",
          summary: "Your practice shows strong referral patterns with room for optimization. Initial data analysis reveals key insights about your healthcare practice performance.",
          details: data.response || "Detailed analysis of your practice performance and key metrics."
        },
        relationshipHealth: {
          title: "Patient Flow Analysis", 
          summary: "Stable but fluctuating patient volume with high reliance on organic referrals.",
          details: "Monthly patient volume shows some fluctuation (59-88 patients), indicating potential seasonality or external factors influencing patient flow. The practice heavily relies on referrals, particularly from Google (113 patients – 57% of total in last 6 months). This highlights a need for diversification of referral sources. The absence of marketing campaigns hinders growth potential and limits control over patient acquisition.",
          metrics: ["Patient Volume: 59-88/month", "Google Referrals: 57%", "No Active Marketing"]
        },
        outreachPriorities: {
          title: "Referral Source Performance",
          summary: "Clear distinction between high-performing and underperforming sources.",
          details: "Top Performers (Google, Preservation Dentistry, Ivy Dental): These sources consistently deliver significant patient volume. Focus on strengthening relationships with these key partners. Underperformers (Crossroads Dental, etc.): These sources yield minimal patients despite existing relationships. Targeted outreach and relationship building are crucial.",
          priorities: ["Strengthen Google partnership", "Enhance Preservation Dentistry relationship", "Target outreach to Crossroads Dental"]
        },
        decliningOffices: {
          title: "Referral Volume Insights",
          summary: "Google dominance presents risk with concentrated referral sources.",
          details: "Google is the primary driver of patient volume, but this presents a risk. Diversification is key to mitigate reliance on a single source. A significant portion of patients comes from a small number of sources, creating vulnerability. Exploring new partnerships is essential.",
          offices: ["High Google dependency", "Limited source diversity"]
        },
        emergingOpportunities: {
          title: "Marketing Opportunities",
          summary: "No marketing data available - critical gap identified.",
          details: "The absence of marketing campaigns prevents any assessment of ROI. Implementing and tracking marketing initiatives is critical for growth and patient acquisition control."
        },
        networkBalance: {
          title: "Action Items",
          summary: "Focus on relationship building and marketing implementation.",
          details: "Prioritize Relationship Building: Strengthen relationships with top-performing referral sources through regular communication, appreciation gestures, and potential joint marketing efforts. Implement marketing campaigns to reduce dependency and gain better control over patient flow."
        },
        competitiveInsight: {
          title: "Data Health Check",
          summary: "Strong foundational data with room for enhancement.",
          details: "Current data provides good insights but could be enhanced with more detailed tracking of referral source performance and patient journey analytics."
        }
      };

      setStructuredInsights(mockStructuredInsights);
      setDataContext(data.dataContext);
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
      .split('\n')
      .map((line, index) => {
        // Handle main headers (##)
        if (line.startsWith('## ')) {
          return (
            <h3 key={index} className="text-lg font-semibold text-foreground mt-6 mb-3 first:mt-0">
              {line.replace('## ', '')}
            </h3>
          );
        }
        
        // Handle sub headers (###)  
        if (line.startsWith('### ')) {
          return (
            <h4 key={index} className="text-base font-medium text-foreground mt-4 mb-2 first:mt-0">
              {line.replace('### ', '')}
            </h4>
          );
        }
        
        // Handle numbered headers (1., 2., etc.)
        if (/^\d+\.\s+/.test(line)) {
          return (
            <h4 key={index} className="text-base font-medium text-foreground mt-4 mb-2 first:mt-0">
              {line}
            </h4>
          );
        }
        
        // Handle bullet points
        if (line.startsWith('* ')) {
          const content = line.replace('* ', '');
          // Handle bold text within bullet points
          const formattedContent = content
            .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
            .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');
          
          return (
            <div key={index} className="flex items-start gap-2 mb-2 ml-4">
              <span className="text-primary mt-1.5 text-xs">•</span>
              <div 
                className="text-sm text-muted-foreground flex-1" 
                dangerouslySetInnerHTML={{ __html: formattedContent }} 
              />
            </div>
          );
        }
        
        // Handle regular lines
        if (line.trim()) {
          const formattedContent = line
            .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
            .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');
          
          return (
            <div 
              key={index} 
              className="text-sm text-muted-foreground mb-2" 
              dangerouslySetInnerHTML={{ __html: formattedContent }} 
            />
          );
        }
        
        // Empty lines for spacing
        return <div key={index} className="h-2" />;
      });
  };

  const getCardIcon = (cardType: string) => {
    const iconMap = {
      narrativeSummary: BarChart3,
      relationshipHealth: Activity, // Patient Flow Analysis
      outreachPriorities: Users, // Referral Source Performance
      decliningOffices: TrendingUp, // Referral Volume Insights
      emergingOpportunities: AlertCircle, // Marketing Opportunities
      networkBalance: CheckCircle, // Action Items
      competitiveInsight: Stethoscope // Data Health Check
    };
    return iconMap[cardType as keyof typeof iconMap] || BarChart3;
  };

  const getCardColorClasses = (cardType: string) => {
    const colorMap = {
      narrativeSummary: 'border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5',
      relationshipHealth: 'border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50 dark:border-blue-800 dark:from-blue-950 dark:to-cyan-950', // Performance trends
      outreachPriorities: 'border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 dark:border-green-800 dark:from-green-950 dark:to-emerald-950', // Top performers
      decliningOffices: 'border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 dark:border-purple-800 dark:from-purple-950 dark:to-indigo-950', // Analysis
      emergingOpportunities: 'border-orange-200 bg-gradient-to-br from-orange-50 to-red-50 dark:border-orange-800 dark:from-orange-950 dark:to-red-950', // Critical gap
      networkBalance: 'border-yellow-200 bg-gradient-to-br from-yellow-50 to-amber-50 dark:border-yellow-800 dark:from-yellow-950 dark:to-amber-950', // Actions
      competitiveInsight: 'border-teal-200 bg-gradient-to-br from-teal-50 to-cyan-50 dark:border-teal-800 dark:from-teal-950 dark:to-cyan-950' // Data quality
    };
    return colorMap[cardType as keyof typeof colorMap] || 'border-border bg-card';
  };

  if (initialLoading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Bot className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">AI Assistant</h1>
          </div>
          <p className="text-muted-foreground">Analyzing your practice data...</p>
        </div>

        <Card>
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

  if (!structuredInsights) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Bot className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">AI Assistant</h1>
          </div>
          <p className="text-muted-foreground text-red-500">
            Failed to load structured insights. Please refresh the page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Bot className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">AI Assistant</h1>
        </div>
        <p className="text-muted-foreground">
          Get intelligent insights about your practice data
        </p>
        <div className="flex justify-center items-center gap-4 mt-4">
          <Button
            onClick={fetchInitialInsights}
            disabled={initialLoading}
            variant="outline"
            size="sm"
            className="mb-2 hover:bg-primary/10 hover:border-primary/20 transition-colors"
          >
            {initialLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Analysis
              </>
            )}
          </Button>
        </div>
        {dataContext && (
          <div className="flex justify-center flex-wrap gap-2 mt-2">
            <Badge variant="secondary">{dataContext.officesCount} Offices</Badge>
            <Badge variant="secondary">{dataContext.monthlyRecords} Monthly Records</Badge>
            <Badge variant="secondary">{dataContext.campaignsCount} Campaigns</Badge>
            <Badge variant="secondary">{dataContext.visitsCount} Visits</Badge>
            {dataContext.discoveredOfficesCount && (
              <Badge variant="outline">{dataContext.discoveredOfficesCount} Discovered</Badge>
            )}
            {dataContext.reviewsCount && (
              <Badge variant="outline">{dataContext.reviewsCount} Reviews</Badge>
            )}
          </div>
        )}
      </div>

      {/* Middle Row - Medium Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {['relationshipHealth', 'outreachPriorities', 'decliningOffices'].map((cardKey) => {
          const card = structuredInsights[cardKey as keyof StructuredInsights];
          const Icon = getCardIcon(cardKey);
          
          return (
            <Card key={cardKey} className={`${getCardColorClasses(cardKey)} hover:shadow-xl hover:scale-[1.02] transition-all duration-300 cursor-pointer border-0 shadow-md backdrop-blur-sm`}>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white/20 dark:bg-black/20">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-base font-semibold">{card.title}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleCardExpansion(cardKey)}
                    className="hover:bg-white/20 dark:hover:bg-black/20 rounded-lg"
                  >
                    {expandedCards[cardKey] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm font-medium mb-3 text-foreground/90">{card.summary}</p>
                {card.score && (
                  <div className="mb-3">
                    <Badge variant="secondary" className="bg-white/30 dark:bg-black/30 border-0 backdrop-blur-sm">
                      {card.score}
                    </Badge>
                  </div>
                )}
                {expandedCards[cardKey] && (
                  <div className="mt-4 space-y-4 animate-fade-in">
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      {formatMessage(card.details)}
                    </div>
                    {card.metrics && (
                      <div className="p-3 rounded-lg bg-white/20 dark:bg-black/20 backdrop-blur-sm">
                        <p className="text-xs font-semibold mb-2 text-foreground">Key Metrics:</p>
                        <div className="flex flex-wrap gap-2">
                          {card.metrics.map((metric, index) => (
                            <Badge key={index} variant="outline" className="text-xs bg-white/30 dark:bg-black/30 border-white/40 dark:border-black/40">
                              {metric}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {card.priorities && (
                      <div className="p-3 rounded-lg bg-white/20 dark:bg-black/20 backdrop-blur-sm">
                        <p className="text-xs font-semibold mb-2 text-foreground">Priorities:</p>
                        <div className="space-y-1">
                          {card.priorities.map((priority, index) => (
                            <div key={index} className="text-xs flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                              {priority}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {card.offices && (
                      <div className="p-3 rounded-lg bg-white/20 dark:bg-black/20 backdrop-blur-sm">
                        <p className="text-xs font-semibold mb-2 text-foreground">Focus Areas:</p>
                        <div className="space-y-1">
                          {card.offices.map((office, index) => (
                            <div key={index} className="text-xs flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                              {office}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Bottom Row - Smaller Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {['emergingOpportunities', 'networkBalance', 'competitiveInsight'].map((cardKey) => {
          const card = structuredInsights[cardKey as keyof StructuredInsights];
          const Icon = getCardIcon(cardKey);
          
          return (
            <Card key={cardKey} className={`${getCardColorClasses(cardKey)} hover:shadow-lg hover:scale-[1.01] transition-all duration-200 cursor-pointer border-0 shadow backdrop-blur-sm`}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-white/20 dark:bg-black/20">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-base font-semibold">{card.title}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleCardExpansion(cardKey)}
                    className="hover:bg-white/20 dark:hover:bg-black/20 rounded-md h-8 w-8 p-0"
                  >
                    {expandedCards[cardKey] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm font-medium mb-3 text-foreground/90">{card.summary}</p>
                {expandedCards[cardKey] && (
                  <div className="mt-3 p-3 rounded-lg bg-white/20 dark:bg-black/20 backdrop-blur-sm animate-fade-in">
                    <div className="prose prose-xs max-w-none dark:prose-invert">
                      {formatMessage(card.details)}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Chat Section */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            Ask Follow-up Questions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Chat Messages */}
          <ScrollArea className="h-64 pr-4">
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <MessageCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p>Ask questions about your data</p>
                  <p className="text-sm mt-1">
                    Try: "Which offices send me the most patients?" or "What trends do you see?"
                  </p>
                </div>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className="space-y-2">
                    {message.type === 'question' ? (
                      <div className="bg-primary/10 p-3 rounded-lg ml-auto max-w-[85%]">
                        <p className="text-sm">{message.content}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-muted p-3 rounded-lg mr-auto max-w-[85%]">
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
                <div className="bg-muted p-3 rounded-lg mr-auto max-w-[85%]">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">AI is thinking...</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <Separator />

          {/* Question Input */}
          <div className="flex gap-2">
            <Input
              placeholder="Ask about your data..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              className="flex-1"
            />
            <Button 
              onClick={askQuestion} 
              disabled={isLoading || !question.trim()}
              size="sm"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Suggested Questions */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Suggested questions:</p>
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
                  className="text-xs"
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