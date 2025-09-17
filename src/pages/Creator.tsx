import React, { useState, useEffect } from 'react';
import { AIContentCreator } from '@/components/AIContentCreator';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface CreatorProps {
  onPageChange?: (page: string) => void;
  onSourceSelect?: (sourceId: string) => void;
}

export function Creator({ onPageChange, onSourceSelect }: CreatorProps) {
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Content Creator</h2>
          <p className="text-muted-foreground">Create professional marketing materials with AI-powered templates</p>
        </div>
      </div>

      <AIContentCreator businessProfile={businessProfile} />
    </div>
  );
}