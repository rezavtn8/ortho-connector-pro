import React, { useState, useEffect } from 'react';
import { Bot, Send, Loader2, Sparkles, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ChatMessage {
  id: string;
  type: 'initial' | 'question' | 'answer';
  content: string;
  timestamp: Date;
  dataContext?: {
    officesCount: number;
    monthlyRecords: number;
    campaignsCount: number;
    visitsCount: number;
  };
}

export function AIAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
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

      const initialMessage: ChatMessage = {
        id: '1',
        type: 'initial',
        content: data.response,
        timestamp: new Date(),
        dataContext: data.dataContext
      };

      setMessages([initialMessage]);
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
        timestamp: new Date(),
        dataContext: data.dataContext
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

  useEffect(() => {
    fetchInitialInsights();
  }, []);

  const formatMessage = (content: string) => {
    // Simple formatting - convert **text** to bold and *text* to italic
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
      <div className="max-w-6xl mx-auto space-y-6">
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

  const initialInsights = messages.find(m => m.type === 'initial');
  const conversations = messages.filter(m => m.type !== 'initial');

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Bot className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">AI Assistant</h1>
        </div>
        <p className="text-muted-foreground">
          Get intelligent insights about your practice data and ask questions
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Proactive Insights */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Proactive Insights
            </CardTitle>
            {initialInsights?.dataContext && (
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {initialInsights.dataContext.officesCount} Offices
                </Badge>
                <Badge variant="secondary">
                  {initialInsights.dataContext.monthlyRecords} Monthly Records
                </Badge>
                <Badge variant="secondary">
                  {initialInsights.dataContext.campaignsCount} Campaigns
                </Badge>
                <Badge variant="secondary">
                  {initialInsights.dataContext.visitsCount} Visits
                </Badge>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96">
              <div className="prose prose-sm max-w-none dark:prose-invert">
                {initialInsights ? (
                  formatMessage(initialInsights.content)
                ) : (
                  <div className="text-center text-muted-foreground">
                    No insights available
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Your Questions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-primary" />
              Your Questions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Chat Messages */}
            <ScrollArea className="h-80 pr-4">
              <div className="space-y-4">
                {conversations.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <MessageCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                    <p>Ask questions about your data</p>
                    <p className="text-sm mt-1">
                      Try: "Which offices send me the most patients?" or "What trends do you see?"
                    </p>
                  </div>
                ) : (
                  conversations.map((message) => (
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
    </div>
  );
}