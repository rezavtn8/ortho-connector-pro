import React, { useState, useEffect } from 'react';
import { ContentDashboard } from '@/components/ContentDashboard';
import { AIContentStudio } from '@/components/AIContentStudio';
import { TemplateLibrary } from '@/components/TemplateLibrary';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, Library, BarChart3, Palette } from 'lucide-react';

interface CreatorProps {
  onPageChange?: (page: string) => void;
  onSourceSelect?: (sourceId: string) => void;
}

export function Creator() {
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
          <Palette className="h-8 w-8 title-icon" />
          <h1 className="text-4xl font-bold page-title">Creator</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          AI-powered content creation tools for your practice
        </p>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md" variant="pills">
          <TabsTrigger value="dashboard" variant="pills" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="studio" variant="pills" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            AI Studio
          </TabsTrigger>
          <TabsTrigger value="templates" variant="pills" className="flex items-center gap-2">
            <Library className="h-4 w-4" />
            Templates
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="dashboard" className="space-y-6">
            <ContentDashboard businessProfile={businessProfile} />
          </TabsContent>

          <TabsContent value="studio" className="space-y-6">
            <AIContentStudio businessProfile={businessProfile} />
          </TabsContent>

          <TabsContent value="templates" className="space-y-6">
            <TemplateLibrary businessProfile={businessProfile} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}