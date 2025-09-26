import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Send, Bot, User, Lightbulb, BarChart3, FileText, Users, AlertTriangle, TrendingUp, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAIChatMessages } from '@/contexts/AppStateContext';
import { useUnifiedAIData } from '@/hooks/useUnifiedAIData';
import { toast } from '@/hooks/use-toast';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type?: 'analysis' | 'suggestion' | 'general';
}

export function AIChatAssistant() {
  const { user } = useAuth();
  const { messages, setMessages } = useAIChatMessages();
  const { data: unifiedData, loading: dataLoading, fetchAllData } = useUnifiedAIData();
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Initialize with welcome message if no messages exist and ensure timestamps are proper Date objects
  useEffect(() => {
    if (messages.length === 0) {
      const welcomeMessage = [{
        id: '1',
        role: 'assistant' as const,
        content: "Hi! I'm your AI practice assistant. I can help you analyze your referral patterns, suggest growth strategies, create marketing content, and answer questions about your practice data. What would you like to explore today?",
        timestamp: new Date(),
        type: 'general' as const
      }];
      setMessages(welcomeMessage);
    } else {
      // Ensure all existing messages have proper Date objects for timestamps
      const messagesWithValidTimestamps = messages.map(message => ({
        ...message,
        timestamp: message.timestamp instanceof Date ? message.timestamp : new Date(message.timestamp)
      }));
      
      // Only update if we actually converted some timestamps
      const hasInvalidTimestamps = messages.some(m => !(m.timestamp instanceof Date));
      if (hasInvalidTimestamps) {
        setMessages(messagesWithValidTimestamps);
      }
    }
  }, [messages.length, setMessages]);

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

  // Load unified data when component mounts
  useEffect(() => {
    if (user && !unifiedData) {
      fetchAllData();
    }
  }, [user, unifiedData, fetchAllData]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  // Business profile is now part of unified data
  const businessProfile = unifiedData?.business_profile;

  const handleSendMessage = async (messageContent?: string) => {
    const content = messageContent || inputMessage.trim();
    if (!content || isLoading) return;

    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please log in to use AI chat features.',
        variant: 'destructive',
      });
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date()
    };

    setMessages([...messages, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Ensure we have unified data
      const data = unifiedData || await fetchAllData();
      
      if (!data) {
        throw new Error('Failed to load practice data');
      }

      const { data: aiResponse, error } = await supabase.functions.invoke('unified-ai-service', {
        body: {
          task_type: 'chat',
          prompt: content,
          context: {
            business_profile: businessProfile,
            practice_data: data,
            conversation_history: messages.slice(-3) // Last 3 messages for better context
          },
        },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) {
        throw new Error(error.message || 'AI service error');
      }

      if (!aiResponse?.success) {
        throw new Error(aiResponse?.error || 'AI service failed');
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiResponse.data || 'I apologize, but I encountered an issue processing your request. Please try again.',
        timestamp: new Date(),
        type: content.toLowerCase().includes('analyz') || content.toLowerCase().includes('data') ? 'analysis' : 
              content.toLowerCase().includes('suggest') || content.toLowerCase().includes('recommend') ? 'suggestion' : 'general'
      };

      setMessages([...messages, assistantMessage]);
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

      setMessages([...messages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (prompt: string) => {
    handleSendMessage(prompt);
  };

  const formatTime = (date: Date | string | number) => {
    try {
      // Ensure we have a proper Date object
      const dateObj = date instanceof Date ? date : new Date(date);
      
      // Check if the date is valid
      if (isNaN(dateObj.getTime())) {
        return 'Invalid time';
      }
      
      return dateObj.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      console.warn('Error formatting time:', error, 'Input:', date);
      return 'Invalid time';
    }
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

  const formatMessageContent = (content: string) => {
    // Remove markdown and replace with styled components
    const parts = content.split(/(\*\*[^*]+\*\*)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const text = part.slice(2, -2);
        return (
          <span key={index} className="font-semibold text-primary">
            {text}
          </span>
        );
      }
      return part;
    });
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
    <Card className="h-[600px] flex flex-col overflow-hidden">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          AI Practice Assistant
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col space-y-4 p-6 min-h-0">
        {/* Chat Messages */}
        <ScrollArea className="flex-1 w-full" ref={scrollAreaRef}>
          <div className="space-y-4 pr-4">
            {messages.map((message) => {
              const IconComponent = getMessageIcon(message);
              return (
                <div
                  key={message.id}
                  className={`flex gap-3 w-full ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <IconComponent className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  
                  <div
                    className={`max-w-[calc(100%-3rem)] min-w-0 rounded-lg p-4 break-words ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      {getMessageBadge(message)}
                      <span className="text-xs opacity-70 flex-shrink-0">
                        {formatTime(message.timestamp)}
                      </span>
                    </div>
                    <div className="text-sm whitespace-pre-wrap leading-relaxed break-words">
                      {formatMessageContent(message.content)}
                    </div>
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
              <div className="flex gap-3 justify-start w-full">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="bg-muted rounded-lg p-4 max-w-[calc(100%-3rem)] min-w-0 break-words">
                  <div className="flex items-center space-x-2">
                    <div className="animate-pulse flex space-x-1">
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      Analyzing your practice data...
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