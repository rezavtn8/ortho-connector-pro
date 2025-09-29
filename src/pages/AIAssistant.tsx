import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain, MessageSquare, Settings } from 'lucide-react';
import { AIAnalysisTab } from '@/components/ai/AIAnalysisTab';
import { AIChatTab } from '@/components/ai/AIChatTab';
import { AISettingsTab } from '@/components/ai/AISettingsTab';

export function AIAssistant() {
  const [activeTab, setActiveTab] = useState('analysis');

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
          <Brain className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">AI Assistant</h1>
          <p className="text-muted-foreground">
            Get insights, chat, and customize your AI-powered business analysis
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="border-b">
              <TabsList className="grid w-full grid-cols-3 bg-transparent h-auto p-1">
                <TabsTrigger 
                  value="analysis" 
                  className="flex items-center gap-2 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-50 data-[state=active]:to-blue-50 dark:data-[state=active]:from-purple-950/30 dark:data-[state=active]:to-blue-950/30 data-[state=active]:border-b-2 data-[state=active]:border-purple-500 rounded-none data-[state=active]:shadow-sm"
                >
                  <Brain className="h-4 w-4" />
                  Analysis
                </TabsTrigger>
                <TabsTrigger 
                  value="chat" 
                  className="flex items-center gap-2 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-50 data-[state=active]:to-blue-50 dark:data-[state=active]:from-purple-950/30 dark:data-[state=active]:to-blue-950/30 data-[state=active]:border-b-2 data-[state=active]:border-purple-500 rounded-none data-[state=active]:shadow-sm"
                >
                  <MessageSquare className="h-4 w-4" />
                  Chat
                </TabsTrigger>
                <TabsTrigger 
                  value="settings" 
                  className="flex items-center gap-2 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-50 data-[state=active]:to-blue-50 dark:data-[state=active]:from-purple-950/30 dark:data-[state=active]:to-blue-950/30 data-[state=active]:border-b-2 data-[state=active]:border-purple-500 rounded-none data-[state=active]:shadow-sm"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="analysis" className="p-6 mt-0">
              <AIAnalysisTab />
            </TabsContent>

            <TabsContent value="chat" className="p-6 mt-0">
              <AIChatTab />
            </TabsContent>

            <TabsContent value="settings" className="p-6 mt-0">
              <AISettingsTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}