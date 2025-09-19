import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Send, Bot, User, Lightbulb, BarChart3, FileText, Users, AlertTriangle, TrendingUp, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type?: 'analysis' | 'suggestion' | 'general';
}

export function AIChatAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm your AI practice assistant. I can help you analyze your referral patterns, suggest growth strategies, create marketing content, and answer questions about your practice data. What would you like to explore today?",
      timestamp: new Date(),
      type: 'general'
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [businessProfile, setBusinessProfile] = useState<any>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  const quickActions = [
    {
      label: 'Source distribution analysis',
      icon: BarChart3,
      prompt: 'Analyze my referral source distribution by type, geographic location, and performance. Are there concentration risks or gaps?'
    },
    {
      label: 'Identify underperformers',
      icon: AlertTriangle,
      prompt: 'Which of my referral sources are underperforming based on historical data? What specific actions should I take for each?'
    },
    {
      label: 'Seasonal patterns & trends',
      icon: TrendingUp,
      prompt: 'Analyze my referral patterns over the past year. What seasonal trends do you see and how can I prepare for them?'
    },
    {
      label: 'ROI optimization strategy',
      icon: Target,
      prompt: 'Based on my marketing visits and referral data, which sources give the best ROI and deserve more investment?'
    },
    {
      label: 'Market expansion opportunities',
      icon: Users,
      prompt: 'Analyze gaps in my referral network. What types of practices or geographic areas should I target for expansion?'
    },
    {
      label: 'Personalized outreach plan',
      icon: FileText,
      prompt: 'Create a data-driven outreach plan for my top 5 sources, including specific talking points based on their referral history.'
    }
  ];

  useEffect(() => {
    loadBusinessProfile();
  }, [user]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const loadBusinessProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.functions.invoke('ai-business-context', {
        body: { action: 'get' },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (!error && data.profile) {
        setBusinessProfile(data.profile);
      }
    } catch (error: any) {
      console.error('Error loading business profile:', error);
    }
  };

  const handleSendMessage = async (messageContent?: string) => {
    const content = messageContent || inputMessage.trim();
    if (!content || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Get comprehensive practice data for context
      const [sourcesResult, monthlyResult, visitsResult, campaignsResult] = await Promise.all([
        supabase.from('patient_sources').select('*').eq('created_by', user?.id),
        supabase.from('monthly_patients').select('*').eq('user_id', user?.id),
        supabase.from('marketing_visits').select('*').eq('user_id', user?.id),
        supabase.from('campaigns').select('*').eq('created_by', user?.id)
      ]);

      const sources = sourcesResult.data || [];
      const monthlyData = monthlyResult.data || [];
      const visits = visitsResult.data || [];
      const campaigns = campaignsResult.data || [];

      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          task_type: 'practice_consultation',
          context: {
            business_profile: businessProfile,
            practice_data: {
              sources: sources,
              monthly_data: monthlyData,
              visits: visits,
              campaigns: campaigns,
              analytics: {
                total_sources: sources.length,
                total_referrals: monthlyData.reduce((sum, m) => sum + (m.patient_count || 0), 0),
                active_sources_this_month: monthlyData.filter(m => {
                  const currentMonth = new Date().toISOString().slice(0, 7);
                  return m.year_month === currentMonth && m.patient_count > 0;
                }).length,
                source_types_distribution: sources.reduce((acc, s) => {
                  acc[s.source_type] = (acc[s.source_type] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>),
                recent_visits: visits.filter(v => {
                  const visitDate = new Date(v.visit_date);
                  const thirtyDaysAgo = new Date();
                  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                  return visitDate >= thirtyDaysAgo;
                }).length,
                last_6_months_trend: monthlyData.filter(m => {
                  const monthDate = new Date(m.year_month + '-01');
                  const sixMonthsAgo = new Date();
                  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
                  return monthDate >= sixMonthsAgo;
                })
              }
            },
            conversation_history: messages.slice(-5)
          },
          prompt: content,
        },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.content || 'I apologize, but I encountered an issue processing your request. Please try again.',
        timestamp: new Date(),
        type: content.toLowerCase().includes('analyz') || content.toLowerCase().includes('data') ? 'analysis' : 
              content.toLowerCase().includes('suggest') || content.toLowerCase().includes('recommend') ? 'suggestion' : 'general'
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Error calling AI assistant:', error);
      toast({
        title: 'Error',
        description: 'Failed to process your request. Please try again.',
        variant: 'destructive',
      });

      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I encountered an error processing your request. Please try again or contact support if the issue persists.',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (prompt: string) => {
    handleSendMessage(prompt);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getMessageIcon = (message: ChatMessage) => {
    if (message.role === 'user') return User;
    
    switch (message.type) {
      case 'analysis':
        return BarChart3;
      case 'suggestion':
        return Lightbulb;
      default:
        return Bot;
    }
  };

  const getMessageBadge = (message: ChatMessage) => {
    if (message.role === 'user') return null;
    
    switch (message.type) {
      case 'analysis':
        return <Badge variant="secondary" className="text-xs">Analysis</Badge>;
      case 'suggestion':
        return <Badge variant="default" className="text-xs">Suggestion</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          AI Practice Assistant
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col space-y-4 p-6">
        {/* Chat Messages */}
        <ScrollArea className="flex-1 pr-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.map((message) => {
              const IconComponent = getMessageIcon(message);
              return (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <IconComponent className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  
                  <div
                    className={`max-w-[80%] rounded-lg p-4 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      {getMessageBadge(message)}
                      <span className="text-xs opacity-70">
                        {formatTime(message.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                      {message.content}
                    </p>
                  </div>
                  
                  {message.role === 'user' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                      <User className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              );
            })}
            
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="bg-muted rounded-lg p-4 max-w-[80%]">
                  <div className="flex items-center space-x-2">
                    <div className="animate-pulse flex space-x-1">
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      Analyzing your data...
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Quick Actions */}
        <div className="flex-shrink-0 space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Business Intelligence Queries:</p>
          <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto">
            {quickActions.map((action, index) => {
              const IconComponent = action.icon;
              return (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="justify-start text-left h-auto p-2"
                  onClick={() => handleQuickAction(action.prompt)}
                  disabled={isLoading}
                >
                  <IconComponent className="h-3 w-3 mr-2 flex-shrink-0" />
                  <span className="text-xs">{action.label}</span>
                </Button>
              );
            })}
          </div>
        </div>

        {/* Message Input */}
        <div className="flex-shrink-0 flex space-x-2">
          <Textarea
            placeholder="Ask about referral source performance, geographic distribution, seasonal trends, ROI analysis, or any specific practice data insights..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            className="min-h-[50px] resize-none"
            disabled={isLoading}
          />
          <Button
            onClick={() => handleSendMessage()}
            disabled={!inputMessage.trim() || isLoading}
            className="px-4"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}