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
      <div className="flex items-center justify-between mb-2">
        <div className="text-center space-y-4">
          <div className="space-y-2">
            <h2 className="text-4xl font-playfair font-bold text-foreground">Content Creator</h2>
            <div className="w-32 h-1 bg-gradient-primary mx-auto rounded-full"></div>
          </div>
          <p className="text-lg font-inter text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Create professional marketing materials with AI-powered templates. Design beautiful brochures, welcome cards, and thank you notes that reflect your practice's unique brand and personality.
          </p>
        </div>
      </div>

      <AIContentCreator businessProfile={businessProfile} />
    </div>
  );
}