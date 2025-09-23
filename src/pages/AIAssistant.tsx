import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AIBusinessSetup } from '@/components/AIBusinessSetup';
import { AIUsageDashboard } from '@/components/AIUsageDashboard';
import { BusinessAnalysisControl } from '@/components/BusinessAnalysisControl';
import { AIChatAssistant } from '@/components/AIChatAssistant';
import { Bot, MessageSquare, Mail, FileText, BarChart3, Settings, Activity, Building2, User, Network, Palette, TrendingUp, Zap } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

import { useNavigate } from 'react-router-dom';

export function AIAssistant() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [businessProfile, setBusinessProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    loadBusinessProfile();
  }, [user]);

  const loadBusinessProfile = async () => {
    if (!user) return;

    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col space-y-3 mb-8">
        <div className="flex items-center gap-3">
          <Bot className="h-8 w-8 title-icon" />
          <h1 className="text-4xl font-bold page-title">AI Assistant</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Intelligent automation and insights for your practice
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3" variant="pills">
          <TabsTrigger value="overview" variant="pills">Overview</TabsTrigger>
          <TabsTrigger value="chat" variant="pills">AI Chat</TabsTrigger>
          <TabsTrigger value="setup" variant="pills">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Business Profile Section */}
          {businessProfile?.business_persona && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  {businessProfile.business_persona.practice_name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Practice Owner</p>
                      <p className="text-sm text-muted-foreground">{businessProfile.business_persona.owner_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Network className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Referral Network</p>
                      <p className="text-sm text-muted-foreground">{businessProfile.business_persona.referral_network_size} sources</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Communication Style</p>
                      <p className="text-sm text-muted-foreground capitalize">{businessProfile.communication_style?.replace('-', ' & ') || 'Professional'}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Insights Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">AI Business Analysis</h3>
            </div>
            <BusinessAnalysisControl />
          </div>

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setActiveTab('chat')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  AI Consultation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Chat with AI for personalized insights and recommendations about your practice.
                </p>
                <Button className="w-full">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Start Chat
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  Smart Campaigns
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Create AI-powered marketing campaigns based on your practice data.
                </p>
                <Button className="w-full" variant="outline" onClick={() => navigate('/campaigns')}>
                  <Mail className="h-4 w-4 mr-2" />
                  Create Campaign
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Content Studio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Generate marketing materials tailored to your practice's brand and voice.
                </p>
                <Button className="w-full" variant="outline" onClick={() => navigate('/creator')}>
                  <Palette className="h-4 w-4 mr-2" />
                  Create Content
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  Review Manager
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  AI-powered responses to reviews that match your practice's voice.
                </p>
                <Button className="w-full" variant="outline" onClick={() => navigate('/reviews')}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Manage Reviews
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Usage Analytics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Monitor AI usage, costs, and performance metrics for optimization.
                </p>
                <Button className="w-full" variant="outline" onClick={() => setActiveTab('setup')}>
                  <Activity className="h-4 w-4 mr-2" />
                  View Usage
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>


        <TabsContent value="chat" className="space-y-6">
          <AIChatAssistant />
        </TabsContent>

        <TabsContent value="setup" className="space-y-6">
          <Tabs defaultValue="business" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 max-w-md" variant="pills">
              <TabsTrigger value="business" variant="pills">Business Setup</TabsTrigger>
              <TabsTrigger value="usage" variant="pills">Usage Dashboard</TabsTrigger>
            </TabsList>
            
            <TabsContent value="business">
              <AIBusinessSetup />
            </TabsContent>
            
            <TabsContent value="usage">
              <AIUsageDashboard />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}