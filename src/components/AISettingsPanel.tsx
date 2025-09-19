import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Database, Upload, Settings, CheckCircle, AlertCircle, RefreshCw, FileText, Calendar } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface DataSource {
  name: string;
  type: 'supabase' | 'csv' | 'pms';
  status: 'connected' | 'disconnected' | 'error';
  lastSync?: string;
  recordCount?: number;
  description: string;
}

export function AISettingsPanel() {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { user } = useAuth();

  const checkDataSources = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Check Supabase data sources
      const [sourcesResult, monthlyResult, visitsResult, campaignsResult] = await Promise.all([
        supabase.from('patient_sources').select('count').eq('created_by', user.id),
        supabase.from('monthly_patients').select('count').eq('user_id', user.id),
        supabase.from('marketing_visits').select('count').eq('user_id', user.id),
        supabase.from('campaigns').select('count').eq('created_by', user.id)
      ]);

      const sources: DataSource[] = [
        {
          name: 'Referral Sources',
          type: 'supabase',
          status: (sourcesResult.count || 0) > 0 ? 'connected' : 'disconnected',
          recordCount: sourcesResult.count || 0,
          lastSync: new Date().toISOString(),
          description: 'Your referral source database with contact information and performance data'
        },
        {
          name: 'Monthly Patient Data',
          type: 'supabase',
          status: (monthlyResult.count || 0) > 0 ? 'connected' : 'disconnected',
          recordCount: monthlyResult.count || 0,
          lastSync: new Date().toISOString(),
          description: 'Historical patient referral counts by month and source'
        },
        {
          name: 'Marketing Visits',
          type: 'supabase',
          status: (visitsResult.count || 0) > 0 ? 'connected' : 'disconnected',
          recordCount: visitsResult.count || 0,
          lastSync: new Date().toISOString(),
          description: 'Marketing visit logs and relationship management activities'
        },
        {
          name: 'Campaign History',
          type: 'supabase',
          status: (campaignsResult.count || 0) > 0 ? 'connected' : 'disconnected',
          recordCount: campaignsResult.count || 0,
          lastSync: new Date().toISOString(),
          description: 'Marketing campaign execution and delivery tracking'
        }
      ];

      setDataSources(sources);
    } catch (error) {
      console.error('Error checking data sources:', error);
      toast({
        title: 'Error',
        description: 'Failed to check data sources',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkDataSources();
  }, [user]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-emerald-600" />;
      case 'disconnected':
        return <AlertCircle className="h-4 w-4 text-amber-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Database className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Connected</Badge>;
      case 'disconnected':
        return <Badge className="bg-amber-50 text-amber-700 border-amber-200">No Data</Badge>;
      case 'error':
        return <Badge className="bg-red-50 text-red-700 border-red-200">Error</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'supabase':
        return <Database className="h-4 w-4 text-blue-600" />;
      case 'csv':
        return <FileText className="h-4 w-4 text-green-600" />;
      case 'pms':
        return <Calendar className="h-4 w-4 text-purple-600" />;
      default:
        return <Settings className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">AI Settings & Data Sources</h2>
          <p className="text-muted-foreground">Manage your data connections and AI preferences</p>
        </div>
        <Button onClick={checkDataSources} disabled={loading} variant="outline" className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Status
        </Button>
      </div>

      {/* AI Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            AI Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h4 className="font-medium">Auto-refresh Insights</h4>
              <p className="text-sm text-muted-foreground">
                Automatically update insights when new data is available
              </p>
            </div>
            <Switch
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
          </div>
          
          <Separator />
          
          <div className="space-y-2">
            <h4 className="font-medium">Analysis Frequency</h4>
            <p className="text-sm text-muted-foreground">
              AI insights are generated from your latest data each time you refresh the dashboard
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Data Sources */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Connected Data Sources
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {dataSources.map((source, index) => (
              <div key={index} className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/30 transition-colors">
                <div className="flex-shrink-0 p-2 bg-muted rounded-lg">
                  {getTypeIcon(source.type)}
                </div>
                
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-foreground">{source.name}</h4>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(source.status)}
                      {getStatusBadge(source.status)}
                    </div>
                  </div>
                  
                  <p className="text-sm text-muted-foreground">
                    {source.description}
                  </p>
                  
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {source.recordCount !== undefined && (
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {source.recordCount} records
                      </span>
                    )}
                    {source.lastSync && (
                      <span className="flex items-center gap-1">
                        <RefreshCw className="h-3 w-3" />
                        Last synced: {new Date(source.lastSync).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {dataSources.filter(s => s.status === 'connected').length === 0 && (
            <div className="text-center py-8 border-2 border-dashed border-muted rounded-lg">
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <h4 className="font-medium text-foreground mb-2">No Data Sources Connected</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Start by adding referral sources and monthly patient data to enable AI insights
              </p>
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Import Data
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Quality */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-primary" />
            Data Quality Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {dataSources.map((source, index) => (
              <div key={index} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  {getTypeIcon(source.type)}
                  <span className="font-medium">{source.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {source.status === 'connected' && source.recordCount && source.recordCount > 0 ? (
                    <Badge className="bg-emerald-50 text-emerald-700">
                      {source.recordCount} records
                    </Badge>
                  ) : (
                    <Badge variant="secondary">No data</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}