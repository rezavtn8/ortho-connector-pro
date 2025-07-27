import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OfficeCard } from '@/components/OfficeCard';
import { ReferringOffice, OfficeTag, ReferralData, OfficeScore } from '@/lib/database.types';
import { supabase } from '@/integrations/supabase/client';
import { Search, Plus, Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function Dashboard() {
  const [offices, setOffices] = useState<ReferringOffice[]>([]);
  const [tags, setTags] = useState<OfficeTag[]>([]);
  const [referralData, setReferralData] = useState<ReferralData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load offices
      const { data: officesData, error: officesError } = await supabase
        .from('referring_offices')
        .select('*')
        .order('name');

      if (officesError) throw officesError;

      // Load tags
      const { data: tagsData, error: tagsError } = await supabase
        .from('office_tags')
        .select('*');

      if (tagsError) throw tagsError;

      // Load referral data
      const { data: referralDataResult, error: referralError } = await supabase
        .from('referral_data')
        .select('*');

      if (referralError) throw referralError;

      setOffices(officesData || []);
      setTags(tagsData || []);
      setReferralData(referralDataResult || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load office data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getOfficeScore = async (officeId: string): Promise<OfficeScore> => {
    try {
      const { data, error } = await supabase
        .rpc('calculate_office_score', { office_id_param: officeId });
      
      if (error) throw error;
      return data as OfficeScore;
    } catch (error) {
      console.error('Error calculating office score:', error);
      return 'Cold';
    }
  };

  const getOfficeTags = (officeId: string) => {
    return tags.filter(tag => tag.office_id === officeId);
  };

  const getOfficeReferrals = (officeId: string) => {
    const officeReferrals = referralData.filter(data => data.office_id === officeId);
    const total = officeReferrals.reduce((sum, data) => sum + data.referral_count, 0);
    
    // Calculate recent referrals (last 3 months)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    const recent = officeReferrals
      .filter(data => new Date(data.month_year) >= threeMonthsAgo)
      .reduce((sum, data) => sum + data.referral_count, 0);

    return { total, recent };
  };

  const filteredOffices = offices.filter(office =>
    office.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    office.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalOffices = offices.length;
  const totalReferrals = referralData.reduce((sum, data) => sum + data.referral_count, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your referring office relationships
          </p>
        </div>
        <Button variant="medical" className="gap-2">
          <Plus className="w-4 h-4" />
          Add Office
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card variant="medical">
          <CardHeader>
            <CardTitle className="text-lg">Total Offices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{totalOffices}</div>
            <p className="text-sm text-muted-foreground">Referring offices tracked</p>
          </CardContent>
        </Card>

        <Card variant="medical">
          <CardHeader>
            <CardTitle className="text-lg">Total Referrals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{totalReferrals}</div>
            <p className="text-sm text-muted-foreground">All-time referrals</p>
          </CardContent>
        </Card>

        <Card variant="medical">
          <CardHeader>
            <CardTitle className="text-lg">Active Relationships</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {offices.filter(office => {
                const { recent } = getOfficeReferrals(office.id);
                return recent > 0;
              }).length}
            </div>
            <p className="text-sm text-muted-foreground">Offices with recent referrals</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="p-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search offices by name or address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" className="gap-2">
              <Filter className="w-4 h-4" />
              Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Offices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredOffices.map((office) => {
          const officeTags = getOfficeTags(office.id);
          const { total, recent } = getOfficeReferrals(office.id);
          
          return (
            <OfficeCard
              key={office.id}
              office={office}
              tags={officeTags}
              score="Moderate" // This would be calculated dynamically
              totalReferrals={total}
              recentReferrals={recent}
              onViewDetails={() => {
                toast({
                  title: "View Details",
                  description: `Opening details for ${office.name}`,
                });
              }}
              onEdit={() => {
                toast({
                  title: "Edit Office",
                  description: `Opening edit form for ${office.name}`,
                });
              }}
            />
          );
        })}
      </div>

      {filteredOffices.length === 0 && !loading && (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="text-muted-foreground">
              {searchTerm ? 'No offices found matching your search.' : 'No offices found. Add your first office to get started.'}
            </div>
            <Button variant="medical" className="mt-4 gap-2">
              <Plus className="w-4 h-4" />
              Add First Office
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}