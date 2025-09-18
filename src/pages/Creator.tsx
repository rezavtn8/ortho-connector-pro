import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MarketingDashboard } from '@/components/MarketingDashboard';
import { ContentLibrary } from '@/components/ContentLibrary';
import { MarketingCalendar } from '@/components/MarketingCalendar';
import { AIContentHub } from '@/components/AIContentHub';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { 
  BarChart3, 
  Calendar, 
  FileText, 
  Sparkles, 
  Target,
  TrendingUp,
  Users,
  Mail,
  Smartphone,
  Star,
  Crown
} from 'lucide-react';

interface CreatorProps {
  onPageChange?: (page: string) => void;
  onSourceSelect?: (sourceId: string) => void;
}

export function Creator({ onPageChange, onSourceSelect }: CreatorProps) {
  const [businessProfile, setBusinessProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
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

  const marketingFeatures = [
    {
      title: 'Marketing Dashboard',
      description: 'Overview of all your marketing activities and performance',
      icon: BarChart3,
      value: 'dashboard',
      color: 'text-primary'
    },
    {
      title: 'AI Content Hub', 
      description: 'Generate professional marketing materials with AI',
      icon: Sparkles,
      value: 'ai-content',
      color: 'text-purple-600',
      badge: 'Popular'
    },
    {
      title: 'Content Library',
      description: 'Professional templates and marketing materials',
      icon: FileText,
      value: 'library',
      color: 'text-blue-600'
    },
    {
      title: 'Marketing Calendar',
      description: 'Strategic campaign planning and scheduling',
      icon: Calendar,
      value: 'calendar',
      color: 'text-green-600'
    }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-lg"></div>
        <div className="relative p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-12 w-12 items-center justify-center bg-gradient-to-br from-primary to-primary/80 rounded-lg">
                  <Crown className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-foreground">Marketing Department</h1>
                  <p className="text-muted-foreground">Complete marketing automation for dental practices</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 bg-success rounded-full animate-pulse"></div>
                  <span className="text-sm text-muted-foreground">AI Assistant Active</span>
                </div>
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  <span className="text-sm text-muted-foreground">3 Active Campaigns</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-success" />
                  <span className="text-sm text-muted-foreground">+23% Patient Growth</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">$12,400</div>
              <div className="text-sm text-muted-foreground">Revenue This Month</div>
              <div className="text-xs text-success">+18% from campaigns</div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {marketingFeatures.map((feature) => {
          const IconComponent = feature.icon;
          return (
            <Card 
              key={feature.value}
              className={`cursor-pointer transition-all duration-300 hover:shadow-lg border-border/50 ${
                activeTab === feature.value ? 'ring-2 ring-primary/50 bg-gradient-to-br from-primary/5 to-primary/10' : 'hover:border-primary/30'
              }`}
              onClick={() => setActiveTab(feature.value)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-card to-accent/10">
                    <IconComponent className={`h-5 w-5 ${feature.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm text-foreground truncate">{feature.title}</h3>
                      {feature.badge && (
                        <Badge className="text-xs bg-gradient-to-r from-primary to-primary/80">
                          {feature.badge}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{feature.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="hidden">
          {marketingFeatures.map((feature) => (
            <TabsTrigger key={feature.value} value={feature.value}>
              {feature.title}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="dashboard" className="mt-0">
          <MarketingDashboard businessProfile={businessProfile} />
        </TabsContent>

        <TabsContent value="ai-content" className="mt-0">
          <AIContentHub businessProfile={businessProfile} />
        </TabsContent>

        <TabsContent value="library" className="mt-0">
          <ContentLibrary />
        </TabsContent>

        <TabsContent value="calendar" className="mt-0">
          <MarketingCalendar businessProfile={businessProfile} />
        </TabsContent>
      </Tabs>
    </div>
  );
}