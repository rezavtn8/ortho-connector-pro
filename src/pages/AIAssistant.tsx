import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AIBusinessSetup } from '@/components/AIBusinessSetup';
import { AIUsageDashboard } from '@/components/AIUsageDashboard';
import { Bot, MessageSquare, Mail, FileText, BarChart3, Settings, Activity } from 'lucide-react';

export function AIAssistant() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">AI Assistant</h2>
          <p className="text-muted-foreground">Intelligent automation for your practice</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="setup">Business Setup</TabsTrigger>
          <TabsTrigger value="usage">Usage Dashboard</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* AI Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  Email Generator
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Generate professional referral emails with business context and personalization.
                </p>
                <Button className="w-full">
                  <Mail className="h-4 w-4 mr-2" />
                  Generate Emails
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  Review Responses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  AI-powered responses to Google reviews that match your practice's voice.
                </p>
                <Button className="w-full" variant="outline" onClick={() => window.location.hash = 'reviews'}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Manage Reviews
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Content Creator
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Create marketing materials and practice communications with your brand voice.
                </p>
                <Button className="w-full" variant="outline">
                  <FileText className="h-4 w-4 mr-2" />
                  Create Content
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-primary" />
                  Business Context
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Configure your AI assistant's understanding of your practice and brand.
                </p>
                <Button className="w-full" variant="outline" onClick={() => setActiveTab('setup')}>
                  <Settings className="h-4 w-4 mr-2" />
                  Setup AI Context
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
                  Monitor AI usage, costs, and performance metrics for your practice.
                </p>
                <Button className="w-full" variant="outline" onClick={() => setActiveTab('usage')}>
                  <Activity className="h-4 w-4 mr-2" />
                  View Analytics
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="setup">
          <AIBusinessSetup />
        </TabsContent>

        <TabsContent value="usage">
          <AIUsageDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}