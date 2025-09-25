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
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [businessProfile, setBusinessProfile] = useState<any>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Load messages from localStorage on component mount
  useEffect(() => {
    if (user) {
      const storageKey = `ai-chat-messages-${user.id}`;
      const savedMessages = localStorage.getItem(storageKey);
      if (savedMessages) {
        try {
          const parsed = JSON.parse(savedMessages);
          const messagesWithDates = parsed.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }));
          setMessages(messagesWithDates);
        } catch (error) {
          console.error('Error loading saved messages:', error);
          // Set default welcome message if parsing fails
          setMessages([{
            id: '1',
            role: 'assistant',
            content: "Hi! I'm your AI practice assistant. I can help you analyze your referral patterns, suggest growth strategies, create marketing content, and answer questions about your practice data. What would you like to explore today?",
            timestamp: new Date(),
            type: 'general'
          }]);
        }
      } else {
        // Set default welcome message for new users
        setMessages([{
          id: '1',
          role: 'assistant',
          content: "Hi! I'm your AI practice assistant. I can help you analyze your referral patterns, suggest growth strategies, create marketing content, and answer questions about your practice data. What would you like to explore today?",
          timestamp: new Date(),
          type: 'general'
        }]);
      }
    }
  }, [user]);

  // Save messages to localStorage whenever messages change
  useEffect(() => {
    if (user && messages.length > 0) {
      const storageKey = `ai-chat-messages-${user.id}`;
      localStorage.setItem(storageKey, JSON.stringify(messages));
    }
  }, [messages, user]);

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
      // Get comprehensive practice data for deeper analysis
      const [
        sourcesResult, 
        monthlyResult, 
        userProfileResult,
        clinicResult,
        visitsResult,
        campaignsResult,
        campaignDeliveriesResult,
        discoveredOfficesResult,
        reviewStatusResult,
        sourceTagsResult,
        aiBusinessProfileResult,
        aiContentResult,
        aiTemplatesResult
      ] = await Promise.all([
        supabase.from('patient_sources').select('id, name, source_type, is_active, created_at, address').eq('created_by', user?.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('monthly_patients').select('id, source_id, year_month, patient_count, updated_at').eq('user_id', user?.id).order('year_month', { ascending: false }).limit(50),
        supabase.from('user_profiles').select('id, email, first_name, last_name, role, clinic_id').eq('user_id', user?.id).single(),
        supabase.from('clinics').select('id, name, address, latitude, longitude').eq('owner_id', user?.id).maybeSingle(),
        supabase.from('marketing_visits').select('id, office_id, visit_date, visited, star_rating, rep_name').eq('user_id', user?.id).order('visit_date', { ascending: false }).limit(50),
        supabase.from('campaigns').select('id, name, status, campaign_type, created_at').eq('created_by', user?.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('campaign_deliveries').select('id, campaign_id, office_id, delivery_status, created_at').eq('created_by', user?.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('discovered_offices').select('id, name, address, office_type, rating, imported').eq('discovered_by', user?.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('review_status').select('id, status, needs_attention, created_at').eq('user_id', user?.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('source_tags').select('id, source_id, tag_name, created_at').eq('user_id', user?.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('ai_business_profiles').select('id, business_persona, specialties, target_audience').eq('user_id', user?.id).single(),
        supabase.from('ai_generated_content').select('id, content_type, status, created_at').eq('user_id', user?.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('ai_response_templates').select('id, template_name, template_type, is_active').eq('user_id', user?.id).order('created_at', { ascending: false }).limit(50)
      ]);

      const sources = sourcesResult.data || [];
      const monthlyData = monthlyResult.data || [];
      const userProfile = userProfileResult.data;
      const clinic = clinicResult.data;
      const visits = visitsResult.data || [];
      const campaigns = campaignsResult.data || [];
      const campaignDeliveries = campaignDeliveriesResult.data || [];
      const discoveredOffices = discoveredOfficesResult.data || [];
      const reviewStatus = reviewStatusResult.data || [];
      const sourceTags = sourceTagsResult.data || [];
      const aiBusinessProfile = aiBusinessProfileResult.data;
      const aiContent = aiContentResult.data || [];
      const aiTemplates = aiTemplatesResult.data || [];

      // Calculate comprehensive analytics for deeper insights
      const currentMonth = new Date().toISOString().slice(0, 7);
      const lastMonth = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7);
      const last6Months = Array.from({length: 6}, (_, i) => {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        return date.toISOString().slice(0, 7);
      });

      const analytics = {
        // Source metrics
        total_sources: sources.length,
        active_sources: sources.filter(s => s.is_active).length,
        source_distribution: sources.reduce((acc, s) => {
          acc[s.source_type] = (acc[s.source_type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        
        // Referral metrics
        total_referrals_ytd: monthlyData.reduce((sum, m) => sum + (m.patient_count || 0), 0),
        current_month_referrals: monthlyData.filter(m => m.year_month === currentMonth).reduce((sum, m) => sum + (m.patient_count || 0), 0),
        last_month_referrals: monthlyData.filter(m => m.year_month === lastMonth).reduce((sum, m) => sum + (m.patient_count || 0), 0),
        
        // Performance trends
        monthly_trends: last6Months.map(month => ({
          month,
          referrals: monthlyData.filter(m => m.year_month === month).reduce((sum, m) => sum + (m.patient_count || 0), 0),
          active_sources: monthlyData.filter(m => m.year_month === month && m.patient_count > 0).length
        })),
        
        // Top performers
        top_sources: sources.map(source => {
          const sourceReferrals = monthlyData.filter(m => m.source_id === source.id).reduce((sum, m) => sum + (m.patient_count || 0), 0);
          const recent6MonthsReferrals = monthlyData.filter(m => m.source_id === source.id && last6Months.includes(m.year_month)).reduce((sum, m) => sum + (m.patient_count || 0), 0);
          return { ...source, total_referrals: sourceReferrals, recent_referrals: recent6MonthsReferrals };
        }).sort((a, b) => b.total_referrals - a.total_referrals).slice(0, 10),
        
        // Geographic insights
        geographic_distribution: sources.reduce((acc, s) => {
          if (s.address) {
            const city = s.address.split(',')[1]?.trim() || 'Unknown';
            acc[city] = (acc[city] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>),
        
        // Marketing visit metrics
        visit_metrics: {
          total_visits: visits.length,
          completed_visits: visits.filter(v => v.visited).length,
          avg_rating: visits.filter(v => v.star_rating).reduce((sum, v) => sum + (v.star_rating || 0), 0) / visits.filter(v => v.star_rating).length || 0,
          recent_visits: visits.filter(v => new Date(v.visit_date) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length
        },
        
        // Campaign metrics
        campaign_metrics: {
          total_campaigns: campaigns.length,
          active_campaigns: campaigns.filter(c => c.status === 'Active').length,
          completed_campaigns: campaigns.filter(c => c.status === 'Completed').length,
          draft_campaigns: campaigns.filter(c => c.status === 'Draft').length,
          total_deliveries: campaignDeliveries.length,
          completed_deliveries: campaignDeliveries.filter(d => d.delivery_status === 'Completed').length
        },
        
        // Discovery metrics
        discovery_metrics: {
          total_discovered: discoveredOffices.length,
          imported_offices: discoveredOffices.filter(d => d.imported).length,
          office_types: discoveredOffices.reduce((acc, d) => {
            acc[d.office_type] = (acc[d.office_type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          avg_rating: discoveredOffices.filter(d => d.rating).reduce((sum, d) => sum + (d.rating || 0), 0) / discoveredOffices.filter(d => d.rating).length || 0
        },
        
        // Review metrics
        review_metrics: {
          total_reviews: reviewStatus.length,
          needs_attention: reviewStatus.filter(r => r.needs_attention).length,
          review_statuses: reviewStatus.reduce((acc, r) => {
            acc[r.status] = (acc[r.status] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        },
        
        // AI usage metrics
        ai_metrics: {
          total_content_generated: aiContent.length,
          active_templates: aiTemplates.filter(t => t.is_active).length,
          template_types: aiTemplates.reduce((acc, t) => {
            acc[t.template_type] = (acc[t.template_type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        }
      };

      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          task_type: 'practice_consultation',
            context: {
              business_profile: businessProfile || aiBusinessProfile,
              practice_data: {
                // Core practice data
                sources: sources,
                monthly_data: monthlyData,
                user_profile: userProfile,
                clinic_info: clinic,
                marketing_visits: visits,
                
                // Extended data for comprehensive analysis
                campaigns: campaigns,
                campaign_deliveries: campaignDeliveries,
                discovered_offices: discoveredOffices,
                reviews: reviewStatus,
                source_tags: sourceTags,
                ai_content: aiContent,
                ai_templates: aiTemplates,
                
                // Rich analytics for deeper insights
                analytics: analytics
              },
              conversation_history: messages.slice(-3) // Last 3 messages for better context
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