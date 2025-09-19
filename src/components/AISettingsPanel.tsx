import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Settings, Bot, Database, Zap, CheckCircle } from 'lucide-react';

export function AISettingsPanel() {
  const [autoInsights, setAutoInsights] = useState(true);
  const [realTimeUpdates, setRealTimeUpdates] = useState(true);
  const [smartAnalysis, setSmartAnalysis] = useState(true);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">AI Settings</h2>
          <p className="text-muted-foreground">Configure your AI assistant preferences</p>
        </div>
      </div>

      {/* AI Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            AI Assistant Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h4 className="font-medium">Auto-generate Insights</h4>
              <p className="text-sm text-muted-foreground">
                Automatically analyze your practice data and generate insights
              </p>
            </div>
            <Switch
              checked={autoInsights}
              onCheckedChange={setAutoInsights}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h4 className="font-medium">Real-time Updates</h4>
              <p className="text-sm text-muted-foreground">
                Update insights when new data is added to your practice
              </p>
            </div>
            <Switch
              checked={realTimeUpdates}
              onCheckedChange={setRealTimeUpdates}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h4 className="font-medium">Smart Analysis</h4>
              <p className="text-sm text-muted-foreground">
                Use advanced AI to identify patterns and opportunities
              </p>
            </div>
            <Switch
              checked={smartAnalysis}
              onCheckedChange={setSmartAnalysis}
            />
          </div>
        </CardContent>
      </Card>

      {/* Data Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Data Connection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="font-medium">Practice Data</p>
                <p className="text-sm text-muted-foreground">Connected to your referral sources, patient data, and campaigns</p>
              </div>
            </div>
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Active</Badge>
          </div>
          
          <div className="text-sm text-muted-foreground bg-background border rounded-lg p-3">
            <p className="font-medium mb-2">AI has automatic access to:</p>
            <ul className="space-y-1 ml-4">
              <li>• Referral source performance data</li>
              <li>• Monthly patient counts and trends</li>
              <li>• Marketing visit logs and outcomes</li>
              <li>• Campaign delivery tracking</li>
              <li>• Geographic and demographic insights</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}