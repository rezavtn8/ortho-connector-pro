import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Building2, ArrowUpDown, Filter, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePagination, useInfiniteScroll } from '@/hooks/usePagination';

interface OfficeData {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  google_rating?: number;
  google_place_id?: string;
  opening_hours?: string;
  yelp_rating?: number;
  distance_miles?: number;
  last_updated_from_google?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  l12: number; // Last 12 months
  r3: number;  // Last 3 months  
  mslr: number; // Months since last referral
  total_patients: number;
  tier: 'VIP' | 'Warm' | 'Cold' | 'Dormant';
  tags: Array<{ id: string; tag_name: string; created_at: string }>;
  monthly_data: Array<{ id: string; year_month: string; patient_count: number; created_at: string; updated_at: string }>;
}

type TierFilter = 'all' | 'VIP' | 'Warm' | 'Cold' | 'Dormant';
type SortField = 'name' | 'l12' | 'r3' | 'mslr';
type SortDirection = 'asc' | 'desc';

const TIER_CONFIG = {
  VIP: { 
    bg: 'bg-gradient-to-r from-amber-100 to-yellow-100', 
    text: 'text-amber-800', 
    border: 'border-amber-400',
    label: 'VIP'
  },
  Warm: { 
    bg: 'bg-gradient-to-r from-emerald-100 to-green-100', 
    text: 'text-emerald-800', 
    border: 'border-emerald-400',
    label: 'Warm'
  },
  Cold: { 
    bg: 'bg-gradient-to-r from-blue-100 to-cyan-100', 
    text: 'text-blue-800', 
    border: 'border-blue-400',
    label: 'Cold'
  },
  Dormant: { 
    bg: 'bg-gradient-to-r from-slate-100 to-gray-100', 
    text: 'text-slate-700', 
    border: 'border-slate-400',
    label: 'Dormant'
  },
};

export function Offices() {
  const { toast } = useToast();
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [sortField, setSortField] = useState<SortField>('l12');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [enableInfiniteScroll, setEnableInfiniteScroll] = useState(false);

  // Create query function for pagination
  const queryFn = useCallback(async (startIndex: number, endIndex: number) => {
    // For RPC functions, we need to handle pagination differently
    // Since the function returns all data, we'll get all data and handle pagination client-side for now
    const { data, error } = await supabase.rpc('get_office_data_with_relations');

    if (error) throw error;

    const allData = (data || []) as OfficeData[];
    const totalCount = allData.length;
    const paginatedData = allData.slice(startIndex, startIndex + 20);

    return { 
      data: paginatedData, 
      error: null, 
      count: totalCount 
    };
  }, []);

  // Use pagination hook
  const {
    data: offices,
    loading,
    loadingMore,
    hasMore,
    totalCount,
    error,
    loadMore,
    refresh,
  } = usePagination<OfficeData>(queryFn, { pageSize: 20 });

  // Set up infinite scroll
  useInfiniteScroll(loadMore, hasMore && enableInfiniteScroll, loadingMore);


  // Process the raw office data from pagination hook
  const processedOffices = useMemo(() => {
    return offices.map((office: any) => ({
      ...office,
      tags: Array.isArray(office.tags) ? office.tags : [],
      monthly_data: Array.isArray(office.monthly_data) ? office.monthly_data : [],
    }));
  }, [offices]);

  // Handle errors
  useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: "Failed to load offices data",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredAndSortedOffices = useMemo(() => {
    return processedOffices
      .filter(office => {
        const matchesSearch = searchTerm === '' || 
          office.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          office.address?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesTier = tierFilter === 'all' || office.tier === tierFilter;
        return matchesSearch && matchesTier;
      })
      .sort((a, b) => {
        const direction = sortDirection === 'asc' ? 1 : -1;
        
        switch (sortField) {
          case 'name':
            return direction * a.name.localeCompare(b.name);
          case 'l12':
            return direction * (a.l12 - b.l12);
          case 'r3':
            return direction * (a.r3 - b.r3);
          case 'mslr':
            return direction * (a.mslr - b.mslr);
          default:
            return 0;
        }
      });
  }, [processedOffices, searchTerm, tierFilter, sortField, sortDirection]);

  const tierCounts = useMemo(() => {
    return processedOffices.reduce((acc, office) => {
      acc[office.tier] = (acc[office.tier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [processedOffices]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">Offices</h1>
        </div>
        <Card>
          <CardContent className="p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground mt-2">Loading offices...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">Offices</h1>
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              {processedOffices.length} of {totalCount} office{totalCount !== 1 ? 's' : ''}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEnableInfiniteScroll(!enableInfiniteScroll)}
            >
              {enableInfiniteScroll ? 'Disable' : 'Enable'} Auto-load
            </Button>
          </div>
        </div>

        {/* Tier Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Object.entries(TIER_CONFIG).map(([tier, config]) => (
            <Card key={tier} className="hover:shadow-card transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{config.label}</p>
                    <p className="text-2xl font-bold">{tierCounts[tier] || 0}</p>
                  </div>
                  <div className={`px-3 py-1.5 rounded-full ${config.bg} ${config.text} ${config.border} border font-semibold text-sm shadow-sm hover:shadow-md transition-all duration-200`}>
                    {config.label}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Office Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1">
                <Input
                  placeholder="Search offices..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
              <Select value={tierFilter} onValueChange={(value) => setTierFilter(value as TierFilter)}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  <SelectItem value="VIP">VIP</SelectItem>
                  <SelectItem value="Warm">Warm</SelectItem>
                  <SelectItem value="Cold">Cold</SelectItem>
                  <SelectItem value="Dormant">Dormant</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button 
                        variant="ghost" 
                        onClick={() => handleSort('name')}
                        className="h-auto p-0 font-medium"
                      >
                        Office Name
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-center">Tier</TableHead>
                    <TableHead className="text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            onClick={() => handleSort('l12')}
                            className="h-auto p-0 font-medium"
                          >
                            L12
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Last 12 Months - Total referrals in the past year</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableHead>
                    <TableHead className="text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            onClick={() => handleSort('r3')}
                            className="h-auto p-0 font-medium"
                          >
                            R3
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Recent 3 Months - Referrals in the last quarter</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableHead>
                    <TableHead className="text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            onClick={() => handleSort('mslr')}
                            className="h-auto p-0 font-medium"
                          >
                            MSLR
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Months Since Last Referral - Time since the last patient</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedOffices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <div className="text-muted-foreground">
                          {offices.length === 0 ? 'No offices found' : 'No offices match your filters'}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAndSortedOffices.map((office) => (
                      <TableRow key={office.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{office.name}</div>
                            {office.address && (
                              <div className="text-sm text-muted-foreground truncate max-w-xs">
                                {office.address}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className={`inline-flex items-center px-3 py-1.5 rounded-full ${TIER_CONFIG[office.tier].bg} ${TIER_CONFIG[office.tier].text} ${TIER_CONFIG[office.tier].border} border font-semibold text-sm shadow-sm hover:shadow-md transition-all duration-200`}>
                            {office.tier}
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {office.l12}
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {office.r3}
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {office.mslr === 999 ? '—' : office.mslr}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            
            {/* Load More Button */}
            {hasMore && (
              <div className="flex justify-center pt-6">
                <Button
                  onClick={loadMore}
                  disabled={loadingMore}
                  variant="outline"
                  className="gap-2"
                >
                  {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loadingMore ? 'Loading...' : 'Load More Offices'}
                </Button>
              </div>
            )}

            {/* Infinite scroll indicator */}
            {enableInfiniteScroll && loadingMore && (
              <div className="flex justify-center pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading more offices...
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}