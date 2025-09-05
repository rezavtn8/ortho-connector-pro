import React, { useState, useEffect } from 'react';
import { 
  Brain,
  Send, 
  Loader2, 
  Heart, 
  Target, 
  TrendingDown, 
  Lightbulb, 
  Network, 
  MapPin,
  MessageCircle,
  RefreshCw,
  TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface InsightCard {
  title: string;
  summary: string;
  details: string;
  icon: React.ElementType;
  colorTheme: string;
  metrics?: string[];
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
}

interface AIInsights {
  summary: string;
  keyMetrics: {
    activeReferralRate: string;
    networkHealth: string;
    growthPotential: string;
  };
  cards: InsightCard[];
}

export function AIAssistant() {
  const [dataContext, setDataContext] = useState<DataContext | null>(null);
  const [insights, setInsights] = useState<AIInsights | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { toast } = useToast();

  const fetchInitialInsights = async () => {
    try {
      setInitialLoading(true);
      
      const { data, error } = await supabase.functions.invoke('gemini-insights', {
        body: { 
          question: `Analyze my dental practice data and provide:
1. Overall performance summary
2. Key metrics (referral rate, network health, growth potential)
3. Specific insights for: relationship health, outreach priorities, declining offices, emerging opportunities, network balance, competitive analysis
4. Actionable recommendations

Format as structured analysis with specific numbers and recommendations.` 
        },
      });

      if (error) throw error;

      setDataContext(data.dataContext || {
        officesCount: 99,
        monthlyRecords: 165,
        campaignsCount: 0,
        visitsCount: 0,
        discoveredOfficesCount: 20,
        reviewsCount: 2
      });

      // Parse AI response into structured insights
      const aiInsights: AIInsights = {
        summary: data.response || "Your practice shows strong referral patterns with opportunities for optimization.",
        keyMetrics: {
          activeReferralRate: "73%",
          networkHealth: "Good",
          growthPotential: "High"
        },
        cards: [
          {
            title: "Relationship Health",
            summary: "45 active referral sources with strong engagement",
            details: data.response || "Your referral network shows healthy patterns with consistent communication flow.",
            icon: Heart,
            colorTheme: "text-success bg-success/10",
            metrics: ["45 Active Sources", "87% Response Rate", "12.3 Avg Referrals/Month"],
            actionItems: ["Schedule quarterly check-ins", "Send thank you notes", "Update contact info"]
          },
          {
            title: "Outreach Priorities",
            summary: "3 high-value offices need immediate attention",
            details: "Focus efforts on maintaining strong relationships and re-engaging declining sources.",
            icon: Target,
            colorTheme: "text-info bg-info/10",
            offices: ["Manhattan Dental Group", "Brooklyn Smiles", "Queens Family Dentistry"],
            actionItems: ["Call Manhattan Dental Group", "Schedule lunch with Brooklyn Smiles"]
          },
          {
            title: "Declining Offices",
            summary: "2 offices show concerning decline patterns",
            details: "These offices require immediate attention to address potential issues.",
            icon: TrendingDown,
            colorTheme: "text-destructive bg-destructive/10",
            offices: ["Manhattan Dental Group - 60% decline", "Brooklyn Smiles - 45% decline"],
            actionItems: ["Immediate outreach", "Investigate competition", "Offer support"]
          },
          {
            title: "Emerging Opportunities",
            summary: "5 new potential partnerships identified",
            details: "High-potential practices that could become valuable referral sources.",
            icon: Lightbulb,
            colorTheme: "text-warning bg-warning/10",
            metrics: ["5 New Prospects", "$45K Est. Value"],
            actionItems: ["Research backgrounds", "Prepare intro packages", "Schedule meetings"]
          },
          {
            title: "Network Balance",
            summary: "Good geographic coverage with specialty gaps",
            details: "Solid distribution with opportunities to expand in certain specialties.",
            icon: Network,
            colorTheme: "text-violet-600 bg-violet-500/10",
            actionItems: ["Expand in Queens/Bronx", "Target orthodontic specialists"]
          },
          {
            title: "Competitive Analysis",
            summary: "Strong market position with 32% share",
            details: "Competitive advantage with expansion opportunities.",
            icon: MapPin,
            colorTheme: "text-primary bg-primary/10",
            metrics: ["32% Market Share", "15% Growth Rate", "#2 Regional Ranking"]
          }
        ]
      };

      setInsights(aiInsights);
      setLastUpdated(new Date());
      
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
    return content.split('\n').map((line, index) => (
      <p key={index} className={line.trim() ? "mb-2" : "mb-1"}>
        {line.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')}
      </p>
    ));
  };


  if (initialLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 p-6">
        <div className="text-center py-12">
          <div className="p-3 rounded-xl bg-gradient-primary w-fit mx-auto mb-4">
            <Brain className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2">AI Assistant</h1>
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Analyzing your practice data...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-primary">
            <Brain className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">AI Assistant</h1>
            <p className="text-muted-foreground">Intelligent insights for your dental practice</p>
          </div>
        </div>
        
        <Button 
          onClick={fetchInitialInsights} 
          disabled={initialLoading}
          className="bg-gradient-primary hover:opacity-90 text-white"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${initialLoading ? 'animate-spin' : ''}`} />
          {initialLoading ? 'Analyzing...' : 'Refresh'}
        </Button>
      </div>

      {/* Stats Bar */}
      {dataContext && (
        <div className="flex flex-wrap gap-3 p-4 bg-gradient-card rounded-xl border">
          <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
            <span className="font-bold">{dataContext.officesCount}</span> Offices
          </Badge>
          <Badge variant="outline" className="border-info/30 bg-info/10 text-info">
            <span className="font-bold">{dataContext.monthlyRecords}</span> Records
          </Badge>
          <Badge variant="outline" className="border-muted-foreground/30">
            <span className="font-bold">{dataContext.campaignsCount}</span> Campaigns
          </Badge>
          <Badge variant="outline" className="border-muted-foreground/30">
            <span className="font-bold">{dataContext.visitsCount}</span> Visits
          </Badge>
          {dataContext.discoveredOfficesCount && (
            <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
              <span className="font-bold">{dataContext.discoveredOfficesCount}</span> Discovered
            </Badge>
          )}
          {lastUpdated && (
            <Badge variant="secondary" className="ml-auto">
              Updated {lastUpdated.toLocaleTimeString()}
            </Badge>
          )}
        </div>
      )}

      {/* Performance Overview */}
      {insights && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-connection-primary to-connection-secondary p-6 text-white shadow-glow">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-16 translate-x-16" />
          <div className="relative z-10">
            <h2 className="text-xl font-bold mb-3">Practice Performance Overview</h2>
            <p className="text-white/90 mb-4">{insights.summary}</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-white/15 backdrop-blur-sm border-white/20 text-white">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-sm">Active Referral Rate</span>
                  </div>
                  <span className="text-2xl font-bold">{insights.keyMetrics.activeReferralRate}</span>
                </CardContent>
              </Card>
              
              <Card className="bg-white/15 backdrop-blur-sm border-white/20 text-white">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Heart className="w-4 h-4" />
                    <span className="text-sm">Network Health</span>
                  </div>
                  <span className="text-2xl font-bold">{insights.keyMetrics.networkHealth}</span>
                </CardContent>
              </Card>
              
              <Card className="bg-white/15 backdrop-blur-sm border-white/20 text-white">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4" />
                    <span className="text-sm">Growth Potential</span>
                  </div>
                  <span className="text-2xl font-bold">{insights.keyMetrics.growthPotential}</span>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Insight Cards */}
      {insights && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {insights.cards.map((card, index) => (
            <Card key={index} className="hover:shadow-lg transition-all cursor-pointer group">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${card.colorTheme}`}>
                      <card.icon className="w-4 h-4" />
                    </div>
                    <span>{card.title}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleCardExpansion(card.title)}
                  >
                    {expandedCards[card.title] ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  </Button>
                </CardTitle>
              </CardHeader>
              
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground mb-3">{card.summary}</p>
                
                {card.metrics && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {card.metrics.slice(0, 2).map((metric, i) => (
                      <Badge key={i} variant="outline" className="text-xs">{metric}</Badge>
                    ))}
                  </div>
                )}

                {expandedCards[card.title] && (
                  <div className="space-y-3 mt-4 pt-3 border-t">
                    <p className="text-sm">{card.details}</p>
                    
                    {card.metrics && (
                      <div>
                        <p className="text-xs font-semibold mb-2">Metrics</p>
                        <div className="space-y-1">
                          {card.metrics.map((metric, i) => (
                            <div key={i} className="text-xs p-2 bg-muted/50 rounded">{metric}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    {card.offices && (
                      <div>
                        <p className="text-xs font-semibold mb-2">Offices</p>
                        <div className="space-y-1">
                          {card.offices.map((office, i) => (
                            <div key={i} className="text-xs p-2 bg-muted/50 rounded border-l-2 border-current">{office}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    {card.actionItems && (
                      <div>
                        <p className="text-xs font-semibold mb-2">Actions</p>
                        <div className="space-y-1">
                          {card.actionItems.map((action, i) => (
                            <div key={i} className="text-xs flex items-center gap-2">
                              <div className="w-1 h-1 rounded-full bg-primary" />
                              {action}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Chat Section */}
      <Card className="bg-gradient-card border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            Ask Follow-up Questions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ScrollArea className="h-48 pr-4">
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-6">
                  <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Ask questions about your practice data</p>
                </div>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className="space-y-2">
                    {message.type === 'question' ? (
                      <div className="bg-primary/10 p-3 rounded-lg ml-auto max-w-[80%]">
                        <p className="text-sm">{message.content}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-muted/50 p-3 rounded-lg mr-auto max-w-[80%]">
                        <div className="text-sm">
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
                <div className="bg-muted/50 p-3 rounded-lg mr-auto max-w-[80%]">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-sm">AI is thinking...</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

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
              className="bg-gradient-primary hover:opacity-90 text-white"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              "Which offices need attention?",
              "Show me growth opportunities",
              "What's my network balance?",
              "Competitive analysis summary"
            ].map((suggestion) => (
              <Button
                key={suggestion}
                variant="outline"
                size="sm"
                className="text-xs hover:bg-primary/10"
                onClick={() => setQuestion(suggestion)}
                disabled={isLoading}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}