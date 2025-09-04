import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  Loader2, 
  FileText, 
  Heart, 
  Target, 
  TrendingDown, 
  Lightbulb, 
  Network, 
  MapPin,
  ChevronDown,
  ChevronUp,
  MessageCircle
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

      if (data.structuredInsights) {
        setStructuredInsights(data.structuredInsights);
      }
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
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .split('\n')
      .map((line, index) => (
        <div key={index} className="mb-2" dangerouslySetInnerHTML={{ __html: line }} />
      ));
  };

  const getCardIcon = (cardType: string) => {
    const iconMap = {
      narrativeSummary: FileText,
      relationshipHealth: Heart,
      outreachPriorities: Target,
      decliningOffices: TrendingDown,
      emergingOpportunities: Lightbulb,
      networkBalance: Network,
      competitiveInsight: MapPin
    };
    return iconMap[cardType as keyof typeof iconMap] || FileText;
  };

  const getCardColorClasses = (cardType: string) => {
    const colorMap = {
      narrativeSummary: 'border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5',
      relationshipHealth: 'border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 dark:border-green-800 dark:from-green-950 dark:to-emerald-950',
      outreachPriorities: 'border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50 dark:border-blue-800 dark:from-blue-950 dark:to-cyan-950',
      decliningOffices: 'border-orange-200 bg-gradient-to-br from-orange-50 to-red-50 dark:border-orange-800 dark:from-orange-950 dark:to-red-950',
      emergingOpportunities: 'border-yellow-200 bg-gradient-to-br from-yellow-50 to-amber-50 dark:border-yellow-800 dark:from-yellow-950 dark:to-amber-950',
      networkBalance: 'border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 dark:border-purple-800 dark:from-purple-950 dark:to-indigo-950',
      competitiveInsight: 'border-teal-200 bg-gradient-to-br from-teal-50 to-cyan-50 dark:border-teal-800 dark:from-teal-950 dark:to-cyan-950'
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
        {dataContext && (
          <div className="flex justify-center flex-wrap gap-2 mt-4">
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

      {/* Top Row - Large Narrative Summary Card */}
      <Card className={`w-full ${getCardColorClasses('narrativeSummary')}`}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary" />
              {structuredInsights.narrativeSummary.title}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleCardExpansion('narrativeSummary')}
            >
              {expandedCards.narrativeSummary ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-medium mb-3">{structuredInsights.narrativeSummary.summary}</p>
          {expandedCards.narrativeSummary && (
            <div className="mt-4 prose prose-sm max-w-none dark:prose-invert">
              {formatMessage(structuredInsights.narrativeSummary.details)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Middle Row - Medium Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {['relationshipHealth', 'outreachPriorities', 'decliningOffices'].map((cardKey) => {
          const card = structuredInsights[cardKey as keyof StructuredInsights];
          const Icon = getCardIcon(cardKey);
          
          return (
            <Card key={cardKey} className={`${getCardColorClasses(cardKey)} hover:shadow-lg transition-shadow cursor-pointer`}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5" />
                    <span className="text-base">{card.title}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleCardExpansion(cardKey)}
                  >
                    {expandedCards[cardKey] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium mb-2">{card.summary}</p>
                {card.score && (
                  <Badge variant="secondary" className="mb-2">{card.score}</Badge>
                )}
                {expandedCards[cardKey] && (
                  <div className="mt-4 space-y-3">
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      {formatMessage(card.details)}
                    </div>
                    {card.metrics && (
                      <div>
                        <p className="text-xs font-semibold mb-1">Key Metrics:</p>
                        <div className="flex flex-wrap gap-1">
                          {card.metrics.map((metric, index) => (
                            <Badge key={index} variant="outline" className="text-xs">{metric}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {card.priorities && (
                      <div>
                        <p className="text-xs font-semibold mb-1">Priorities:</p>
                        <div className="space-y-1">
                          {card.priorities.map((priority, index) => (
                            <div key={index} className="text-xs">• {priority}</div>
                          ))}
                        </div>
                      </div>
                    )}
                    {card.offices && (
                      <div>
                        <p className="text-xs font-semibold mb-1">Offices:</p>
                        <div className="space-y-1">
                          {card.offices.map((office, index) => (
                            <div key={index} className="text-xs">• {office}</div>
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
            <Card key={cardKey} className={`${getCardColorClasses(cardKey)} hover:shadow-md transition-shadow cursor-pointer`}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    <span className="text-sm">{card.title}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleCardExpansion(cardKey)}
                  >
                    {expandedCards[cardKey] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground">{card.summary}</p>
                {expandedCards[cardKey] && (
                  <div className="mt-3 prose prose-xs max-w-none dark:prose-invert">
                    {formatMessage(card.details)}
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