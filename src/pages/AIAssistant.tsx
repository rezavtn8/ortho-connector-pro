import React, { useState } from 'react';
import { AIOverviewDashboard } from '@/components/AIOverviewDashboard';
import { AIChatAssistant } from '@/components/AIChatAssistant';
import { AISettingsPanel } from '@/components/AISettingsPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, MessageSquare, Settings } from 'lucide-react';

interface AIAssistantProps {
  onPageChange?: (page: string) => void;
  onSourceSelect?: (sourceId: string) => void;
}

export function AIAssistant({ onPageChange, onSourceSelect }: AIAssistantProps = {}) {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">AI Practice Intelligence</h1>
              <p className="text-muted-foreground text-lg">
                GPT-4 powered insights and analytics for your dental practice
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-muted/50 rounded-xl p-1 h-14">
            <TabsTrigger 
              value="overview" 
              className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg py-3 px-4 transition-all"
            >
              <BarChart3 className="h-4 w-4" />
              <span className="font-medium">Overview Dashboard</span>
            </TabsTrigger>
            <TabsTrigger 
              value="chat" 
              className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg py-3 px-4 transition-all"
            >
              <MessageSquare className="h-4 w-4" />
              <span className="font-medium">AI Chat Assistant</span>
            </TabsTrigger>
            <TabsTrigger 
              value="settings" 
              className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg py-3 px-4 transition-all"
            >
              <Settings className="h-4 w-4" />
              <span className="font-medium">Settings & Data</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 animate-fade-in">
            <AIOverviewDashboard />
          </TabsContent>

          <TabsContent value="chat" className="space-y-6 animate-fade-in">
            <div className="max-w-5xl mx-auto">
              <AIChatAssistant />
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6 animate-fade-in">
            <AISettingsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}