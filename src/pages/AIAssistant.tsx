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
        <Brain className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">AI Assistant</h1>
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
                  className="flex items-center gap-2 py-3 data-[state=active]:bg-primary/10 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
                >
                  <Brain className="h-4 w-4" />
                  Analysis
                </TabsTrigger>
                <TabsTrigger 
                  value="chat" 
                  className="flex items-center gap-2 py-3 data-[state=active]:bg-primary/10 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
                >
                  <MessageSquare className="h-4 w-4" />
                  Chat
                </TabsTrigger>
                <TabsTrigger 
                  value="settings" 
                  className="flex items-center gap-2 py-3 data-[state=active]:bg-primary/10 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
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