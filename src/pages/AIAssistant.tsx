import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Brain, MessageSquare, Settings, Sparkles, BarChart3, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUnifiedAIData } from '@/hooks/useUnifiedAIData';
import { SimplifiedBusinessAnalysis } from '@/components/SimplifiedBusinessAnalysis';
import { AIChatAssistant } from '@/components/AIChatAssistant';
import { AIBusinessSetup } from '@/components/AIBusinessSetup';
import { AIUsageDashboard } from '@/components/AIUsageDashboard';

export default function AIAssistant() {
  const { user } = useAuth();
  const { data: unifiedData, loading: dataLoading } = useUnifiedAIData();
  const [activeTab, setActiveTab] = useState('overview');

  // Business profile is now part of unified data
  const businessProfile = unifiedData?.business_profile;

  if (!user) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">AI Assistant</h1>
          <p className="text-muted-foreground">Please log in to access AI features.</p>
        </div>
      </div>
    );
  }

  if (dataLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <div>
              <h3 className="text-lg font-semibold">Loading AI Assistant</h3>
              <p className="text-muted-foreground">
                Loading your practice data for AI analysis...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Brain className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">AI Assistant</h1>
          <p className="text-muted-foreground">
            AI-powered business intelligence and automated assistance for your practice
          </p>
        </div>
      </div>

      {!unifiedData && (
        <Alert>
          <AlertDescription>
            Loading practice data for AI features. This may take a moment...
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Analysis
          </TabsTrigger>
          <TabsTrigger value="chat" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="setup" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Setup
          </TabsTrigger>
          <TabsTrigger value="usage" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Usage
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {businessProfile && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Business Profile
                  <Badge variant="secondary">Active</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Practice:</span> {businessProfile.business_persona?.practice_name || 'Not set'}
                  </div>
                  <div>
                    <span className="font-medium">Communication Style:</span> {businessProfile.communication_style || 'Professional'}
                  </div>
                  <div>
                    <span className="font-medium">Specialties:</span> {businessProfile.specialties?.join(', ') || 'General Practice'}
                  </div>
                  <div>
                    <span className="font-medium">Target Audience:</span> {businessProfile.target_audience || 'Healthcare professionals'}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <SimplifiedBusinessAnalysis />
        </TabsContent>

        {activeTab === 'chat' && (
          <TabsContent value="chat">
            <AIChatAssistant />
          </TabsContent>
        )}

        {activeTab === 'setup' && (
          <TabsContent value="setup">
            <AIBusinessSetup />
          </TabsContent>
        )}

        {activeTab === 'usage' && (
          <TabsContent value="usage">
            <AIUsageDashboard />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}