import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Search, Grid, List, Download, Upload, Filter, MapPin, Phone, Globe, Mail, Star } from 'lucide-react';
import { ReferringOffice, OfficeTag, OfficeScore } from '@/lib/database.types';

interface OfficeWithData extends ReferringOffice {
  tags: OfficeTag[];
  totalReferrals: number;
  lastReferralDate: string | null;
  score: OfficeScore;
}

export const Offices = () => {
  const [offices, setOffices] = useState<OfficeWithData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'table'>('grid');
  const [sortBy, setSortBy] = useState('name');
  const [filterBy, setFilterBy] = useState('all');
  const [selectedOffices, setSelectedOffices] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchOffices();
  }, []);

  const fetchOffices = async () => {
    try {
      setLoading(true);
      
      // Fetch offices
      const { data: officesData, error: officesError } = await supabase
        .from('referring_offices')
        .select('*')
        .order('name');

      if (officesError) throw officesError;

      // Fetch tags for all offices
      const { data: tagsData, error: tagsError } = await supabase
        .from('office_tags')
        .select('*');

      if (tagsError) throw tagsError;

      // Fetch referral data and calculate scores
      const enrichedOffices: OfficeWithData[] = await Promise.all(
        (officesData || []).map(async (office) => {
          // Get total referrals
          const { data: referralData } = await supabase
            .from('referral_data')
            .select('referral_count, month_year')
            .eq('office_id', office.id);

          const totalReferrals = referralData?.reduce((sum, r) => sum + r.referral_count, 0) || 0;
          
          // Get last referral date
          const lastReferral = referralData
            ?.filter(r => r.referral_count > 0)
            ?.sort((a, b) => new Date(b.month_year).getTime() - new Date(a.month_year).getTime())[0];

          // Calculate score using database function
          const { data: scoreData } = await supabase.rpc('calculate_office_score', {
            office_id_param: office.id
          });

          return {
            ...office,
            tags: tagsData?.filter(tag => tag.office_id === office.id) || [],
            totalReferrals,
            lastReferralDate: lastReferral?.month_year || null,
            score: (scoreData as OfficeScore) || 'Cold'
          };
        })
      );

      setOffices(enrichedOffices);
    } catch (error) {
      console.error('Error fetching offices:', error);
      toast({
        title: "Error",
        description: "Failed to load offices",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedOffices = offices
    .filter(office => {
      const matchesSearch = office.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           office.address.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (filterBy === 'all') return matchesSearch;
      if (filterBy === 'strong') return matchesSearch && office.score === 'Strong';
      if (filterBy === 'moderate') return matchesSearch && office.score === 'Moderate';
      if (filterBy === 'sporadic') return matchesSearch && office.score === 'Sporadic';
      if (filterBy === 'cold') return matchesSearch && office.score === 'Cold';
      
      return matchesSearch;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'score':
          const scoreOrder = { 'Strong': 4, 'Moderate': 3, 'Sporadic': 2, 'Cold': 1 };
          return scoreOrder[b.score] - scoreOrder[a.score];
        case 'referrals':
          return b.totalReferrals - a.totalReferrals;
        case 'lastReferral':
          if (!a.lastReferralDate && !b.lastReferralDate) return 0;
          if (!a.lastReferralDate) return 1;
          if (!b.lastReferralDate) return -1;
          return new Date(b.lastReferralDate).getTime() - new Date(a.lastReferralDate).getTime();
        default:
          return 0;
      }
    });

  const getScoreBadgeVariant = (score: OfficeScore) => {
    switch (score) {
      case 'Strong':
        return 'success';
      case 'Moderate':
        return 'default';
      case 'Sporadic':
        return 'warning';
      case 'Cold':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const toggleOfficeSelection = (officeId: string) => {
    setSelectedOffices(prev => 
      prev.includes(officeId) 
        ? prev.filter(id => id !== officeId)
        : [...prev, officeId]
    );
  };

  const exportToCsv = () => {
    const csvData = filteredAndSortedOffices.map(office => ({
      Name: office.name,
      Address: office.address,
      Phone: office.phone || '',
      Email: office.email || '',
      Website: office.website || '',
      Score: office.score,
      'Total Referrals': office.totalReferrals,
      'Last Referral': office.lastReferralDate || '',
      Tags: office.tags.map(t => t.tag).join('; ')
    }));

    const csvString = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).map(value => `"${value}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'offices.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const renderOfficeCard = (office: OfficeWithData) => (
    <Card key={office.id} className="relative transition-all hover:shadow-lg">
      <div className="absolute top-4 left-4">
        <Checkbox
          checked={selectedOffices.includes(office.id)}
          onCheckedChange={() => toggleOfficeSelection(office.id)}
        />
      </div>
      
      <CardHeader className="pb-3 pt-12">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg mb-2">{office.name}</CardTitle>
            <Badge variant={getScoreBadgeVariant(office.score)} className="mb-2">
              {office.score}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="w-4 h-4" />
          <span className="line-clamp-2">{office.address}</span>
        </div>

        {office.phone && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="w-4 h-4" />
            <span>{office.phone}</span>
          </div>
        )}

        {office.email && (
          <div className="flex items-center gap-2 text-sm">
            <Mail className="w-4 h-4" />
            <span className="truncate">{office.email}</span>
          </div>
        )}

        {office.website && (
          <div className="flex items-center gap-2 text-sm">
            <Globe className="w-4 h-4" />
            <a href={office.website} target="_blank" rel="noopener noreferrer" 
               className="text-primary hover:underline truncate">
              {office.website}
            </a>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 pt-2 text-sm">
          <div>
            <span className="text-muted-foreground">Total Referrals:</span>
            <p className="font-semibold">{office.totalReferrals}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Last Referral:</span>
            <p className="font-semibold">
              {office.lastReferralDate 
                ? new Date(office.lastReferralDate).toLocaleDateString()
                : 'Never'
              }
            </p>
          </div>
        </div>

        {office.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-2">
            {office.tags.map((tag) => (
              <Badge key={tag.id} variant="outline" className="text-xs">
                {tag.tag}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-3">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={() => window.open(`/office/${office.id}`, '_blank')}
          >
            View Details
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(office.address)}`, '_blank')}
          >
            <MapPin className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading offices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-text bg-clip-text text-transparent mb-2">
            Office Management
          </h1>
          <p className="text-muted-foreground">
            Manage all referring offices - {filteredAndSortedOffices.length} offices total
          </p>
        </div>

        {/* Controls */}
        <div className="bg-card border rounded-lg p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search offices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex flex-wrap gap-3 items-center">
              {/* Filter */}
              <Select value={filterBy} onValueChange={setFilterBy}>
                <SelectTrigger className="w-40">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Offices</SelectItem>
                  <SelectItem value="strong">Strong Partners</SelectItem>
                  <SelectItem value="moderate">Moderate Partners</SelectItem>
                  <SelectItem value="sporadic">Sporadic Partners</SelectItem>
                  <SelectItem value="cold">Cold Offices</SelectItem>
                </SelectContent>
              </Select>

              {/* Sort */}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Sort by Name</SelectItem>
                  <SelectItem value="score">Sort by Score</SelectItem>
                  <SelectItem value="referrals">Sort by Referrals</SelectItem>
                  <SelectItem value="lastReferral">Sort by Last Referral</SelectItem>
                </SelectContent>
              </Select>

              {/* View Mode */}
              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="rounded-r-none"
                >
                  <Grid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="rounded-none border-x"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>

              {/* Actions */}
              <Button variant="outline" size="sm" onClick={exportToCsv}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>

              {selectedOffices.length > 0 && (
                <Badge variant="secondary">
                  {selectedOffices.length} selected
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Office Grid */}
        <div className={`grid gap-6 ${
          viewMode === 'grid' 
            ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
            : 'grid-cols-1'
        }`}>
          {filteredAndSortedOffices.map(renderOfficeCard)}
        </div>

        {filteredAndSortedOffices.length === 0 && (
          <div className="text-center py-12">
            <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Search className="w-12 h-12 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No offices found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search terms or filters
            </p>
          </div>
        )}
      </div>
    </div>
  );
};