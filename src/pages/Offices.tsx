import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Search, Grid, List, Download, Upload, Filter, MapPin, Phone, Globe, Mail, Star, Plus, Minus, Users, ExternalLink } from 'lucide-react';
import { ReferringOffice, OfficeTag, OfficeScore } from '@/lib/database.types';
import { AddOfficeDialog } from '@/components/AddOfficeDialog';

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
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'table'>('table');
  const [sortBy, setSortBy] = useState('name');
  const [filterBy, setFilterBy] = useState('all');
  const [selectedOffices, setSelectedOffices] = useState<string[]>([]);
  const [updatingPatients, setUpdatingPatients] = useState<Set<string>>(new Set());
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

  const updatePatientCount = async (officeId: string, newCount: number) => {
    if (newCount < 0) return;
    
    setUpdatingPatients(prev => new Set([...prev, officeId]));
    try {
      // For simplicity, we'll update the current month's referral count
      const currentDate = new Date();
      const monthYear = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-01`;
      
      const { error } = await supabase
        .from('referral_data')
        .upsert({
          office_id: officeId,
          month_year: monthYear,
          referral_count: newCount
        });

      if (error) throw error;

      // Update local state
      setOffices(prev => prev.map(office => 
        office.id === officeId 
          ? { ...office, totalReferrals: newCount }
          : office
      ));

      toast({
        title: "Patient count updated",
        description: `Patient count set to ${newCount}`,
      });
    } catch (error) {
      console.error('Error updating patient count:', error);
      toast({
        title: "Error",
        description: "Failed to update patient count",
        variant: "destructive",
      });
    } finally {
      setUpdatingPatients(prev => {
        const newSet = new Set(prev);
        newSet.delete(officeId);
        return newSet;
      });
    }
  };

  const incrementPatient = (officeId: string, currentCount: number) => {
    updatePatientCount(officeId, currentCount + 1);
  };

  const decrementPatient = (officeId: string, currentCount: number) => {
    updatePatientCount(officeId, Math.max(0, currentCount - 1));
  };

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
              <AddOfficeDialog onOfficeAdded={fetchOffices} />
              
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

        {/* Offices Table */}
        <div className="bg-card border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedOffices.length === filteredAndSortedOffices.length && filteredAndSortedOffices.length > 0}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedOffices(filteredAndSortedOffices.map(o => o.id));
                      } else {
                        setSelectedOffices([]);
                      }
                    }}
                  />
                </TableHead>
                <TableHead>Office Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Patient Load</TableHead>
                <TableHead>Last Referral</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedOffices.map((office) => {
                const isUpdating = updatingPatients.has(office.id);
                return (
                  <TableRow key={office.id} className="hover:bg-muted/50">
                    <TableCell>
                      <Checkbox
                        checked={selectedOffices.includes(office.id)}
                        onCheckedChange={() => toggleOfficeSelection(office.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{office.name}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {office.address}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        {office.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            <span>{office.phone}</span>
                          </div>
                        )}
                        {office.email && (
                          <div className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            <span className="truncate max-w-32">{office.email}</span>
                          </div>
                        )}
                        {office.website && (
                          <div className="flex items-center gap-1">
                            <Globe className="w-3 h-3" />
                            <a href={office.website} target="_blank" rel="noopener noreferrer" 
                               className="text-primary hover:underline text-xs">
                              Website
                            </a>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getScoreBadgeVariant(office.score)}>
                        {office.score}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4 text-primary" />
                          <span className={`font-bold text-lg ${isUpdating ? 'animate-pulse' : ''}`}>
                            {office.totalReferrals}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => decrementPatient(office.id, office.totalReferrals)}
                            disabled={isUpdating || office.totalReferrals <= 0}
                            className="h-7 w-7 p-0 hover:bg-destructive/10 hover:border-destructive hover:text-destructive"
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => incrementPatient(office.id, office.totalReferrals)}
                            disabled={isUpdating}
                            className="h-7 w-7 p-0 bg-teal-600 hover:bg-teal-700 text-white"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {office.lastReferralDate 
                          ? new Date(office.lastReferralDate).toLocaleDateString()
                          : 'Never'
                        }
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {office.tags.slice(0, 2).map((tag) => (
                          <Badge key={tag.id} variant="outline" className="text-xs">
                            {tag.tag}
                          </Badge>
                        ))}
                        {office.tags.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{office.tags.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => window.open(`/office/${office.id}`, '_blank')}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(office.address)}`, '_blank')}
                        >
                          <MapPin className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
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