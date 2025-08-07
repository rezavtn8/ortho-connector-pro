import React, { useState, useEffect } from 'react';
import { OfficesMapView } from '@/components/OfficesMapView';
import { supabase } from '@/integrations/supabase/client';
import { ReferringOffice, OfficeScore } from '@/lib/database.types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin } from 'lucide-react';

export function Map() {
  const [offices, setOffices] = useState<Array<ReferringOffice & { 
    score: OfficeScore; 
    totalReferrals: number;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOffices = async () => {
      try {
        // Load referring offices
        const { data: officesData, error: officesError } = await supabase
          .from('referring_offices')
          .select('*')
          .order('name');

        if (officesError) {
          console.error('Error loading offices:', officesError);
          return;
        }

        // Load referral data for each office
        const officesWithData = await Promise.all(
          (officesData || []).map(async (office) => {
            // Get total referrals
            const { data: referralData } = await supabase
              .from('referral_data')
              .select('referral_count')
              .eq('office_id', office.id);

            const totalReferrals = referralData?.reduce((sum, r) => sum + r.referral_count, 0) || 0;

            // Calculate score using the database function
            const { data: scoreData } = await supabase
              .rpc('calculate_office_score', { office_id_param: office.id });

            const score = (scoreData as OfficeScore) || 'Cold';

            return {
              ...office,
              score,
              totalReferrals,
            };
          })
        );

        setOffices(officesWithData);
      } catch (error) {
        console.error('Error loading office data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadOffices();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Map View
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading offices...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Map View</h1>
        <p className="text-muted-foreground">
          View all referring offices on the map with their locations and relationship status
        </p>
      </div>

      <OfficesMapView offices={offices} />
    </div>
  );
}