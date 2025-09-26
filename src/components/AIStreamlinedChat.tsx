import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Send, Bot, User, Lightbulb, BarChart3, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type?: 'quick' | 'analysis' | 'suggestion';
}

export function AIStreamlinedChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm your AI assistant. Ask me about your referral patterns, source performance, or get quick insights about your practice data.",
      timestamp: new Date(),
      type: 'quick'
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  const quickQuestions = [
    'Which sources are performing best?',
    'Show my referral trends',
    'Any recommendations for me?',
    'What should I focus on?',
    'How are my campaigns doing?',
    'Who needs follow-up?'
  ];

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

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
      // Get essential practice data only
      const [sourcesResult, patientsResult] = await Promise.all([
        supabase.from('patient_sources').select('*').eq('created_by', user?.id).limit(20),
        supabase.from('monthly_patients').select('*').eq('user_id', user?.id).limit(50)
      ]);

      const sources = sourcesResult.data || [];
      const patients = patientsResult.data || [];

      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          task_type: 'quick_consultation',
          context: {
            practice_data: {
              sources: sources,
              monthly_data: patients,
              summary: {
                total_sources: sources.length,
                active_sources: sources.filter(s => s.is_active).length,
                total_referrals: patients.reduce((sum, p) => sum + (p.patient_count || 0), 0),
                recent_activity: patients.filter(p => {
                  const currentMonth = new Date().toISOString().slice(0, 7);
                  return p.year_month === currentMonth;
                }).reduce((sum, p) => sum + (p.patient_count || 0), 0)
              }
            },
            conversation_history: messages.slice(-3) // Only last 3 messages for context
          },
          prompt: content + ' (Keep response under 150 words, be direct and actionable)'
        },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) {
        console.error('AI function error:', error);
        throw new Error(error.message || 'Failed to get AI response');
      }

      let responseContent = data?.content || 'I apologize, but I encountered an issue processing your request. Please try again.';
      
      // Limit response length for chat
      const words = responseContent.split(' ');
      if (words.length > 150) {
        responseContent = words.slice(0, 150).join(' ') + '...';
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseContent,
        timestamp: new Date(),
        type: content.toLowerCase().includes('analyz') || content.toLowerCase().includes('trend') ? 'analysis' :
              content.toLowerCase().includes('suggest') || content.toLowerCase().includes('recommend') ? 'suggestion' : 'quick'
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error: any) {
      console.error('Chat error:', error);
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I encountered a technical issue. Please try asking your question again.',
        timestamp: new Date(),
        type: 'quick'
      };

      setMessages(prev => [...prev, errorMessage]);

      toast({
        title: 'Chat Error',
        description: 'There was an issue with the AI response. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickQuestion = (question: string) => {
    handleSendMessage(question);
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

  const getMessageColor = (message: ChatMessage) => {
    if (message.role === 'user') return 'bg-primary text-primary-foreground';
    
    switch (message.type) {
      case 'analysis':
        return 'bg-blue-50 text-blue-900 border border-blue-200';
      case 'suggestion':
        return 'bg-green-50 text-green-900 border border-green-200';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Card className="h-[700px] flex flex-col">
      <CardHeader className="flex-shrink-0 pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="h-5 w-5 text-primary" />
          AI Chat Assistant
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Quick insights and answers about your practice data
        </p>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col space-y-4 p-6 pt-0">
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
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center mt-1">
                      <IconComponent className="h-4 w-4 text-slate-600" />
                    </div>
                  )}
                  
                  <div className="flex flex-col max-w-[85%]">
                    <div className={`rounded-2xl px-4 py-3 ${getMessageColor(message)}`}>
                      <p className="text-sm leading-relaxed">
                        {message.content}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground mt-1 px-2">
                      {formatTime(message.timestamp)}
                    </span>
                  </div>
                  
                  {message.role === 'user' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center mt-1">
                      <User className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              );
            })}
            
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-slate-600" />
                </div>
                <div className="bg-muted rounded-2xl px-4 py-3 max-w-[85%]">
                  <div className="flex items-center space-x-2">
                    <div className="animate-pulse flex space-x-1">
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      Thinking...
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Quick Questions */}
        <div className="flex-shrink-0 space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Quick questions:</p>
          <div className="flex flex-wrap gap-2">
            {quickQuestions.map((question, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                className="text-xs h-8 px-3 rounded-full hover:bg-primary hover:text-primary-foreground transition-colors"
                onClick={() => handleQuickQuestion(question)}
                disabled={isLoading}
              >
                {question}
              </Button>
            ))}
          </div>
        </div>

        {/* Message Input */}
        <div className="flex-shrink-0 flex space-x-2">
          <Input
            placeholder="Ask about your practice data..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            className="flex-1 rounded-full border-2 focus:border-primary transition-colors"
            disabled={isLoading}
          />
          <Button
            onClick={() => handleSendMessage()}
            disabled={!inputMessage.trim() || isLoading}
            className="rounded-full w-10 h-10 p-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}