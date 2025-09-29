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
    <div className="space-y-6">
      {/* Header - Teal Theme matching other pages */}
      <div className="flex flex-col space-y-3 mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Brain className="h-8 w-8 title-icon" />
          <h1 className="text-4xl font-bold page-title">AI Assistant</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Intelligent insights and data-driven chat powered by AI
        </p>
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