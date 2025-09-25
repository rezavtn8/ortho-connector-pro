import React, { useState, useEffect } from 'react';
import { AIContentCreator } from '@/components/AIContentCreator';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Palette } from 'lucide-react';

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

      {/* AI Content Creator */}
      <AIContentCreator businessProfile={businessProfile} />
    </div>
  );
}