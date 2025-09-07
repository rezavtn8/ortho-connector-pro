import React, { useState, useMemo } from 'react';
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
import { Building2, ArrowUpDown, Filter, Loader2, RefreshCw, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useOfficeData } from '@/hooks/useQueryData';
import { SkeletonCard, SkeletonTable } from '@/components/ui/skeleton-card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccessibility, addSkipToMain } from '@/hooks/useAccessibility';
import { AccessibleButton } from '@/components/ui/accessible-button';
import { AccessibleInput } from '@/components/ui/accessible-form';

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
  const { announce } = useAccessibility();
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [sortField, setSortField] = useState<SortField>('l12');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchTerm, setSearchTerm] = useState('');

  // Add skip to main content
  addSkipToMain();

  // Use React Query for office data with infinite loading
  const {
    data,
    isLoading: loading,
    isFetchingNextPage: loadingMore,
    hasNextPage: hasMore,
    fetchNextPage: loadMore,
    refetch,
    error,
    isFetching
  } = useOfficeData();

  // Flatten pages data
  const offices = useMemo(() => {
    return data?.pages?.flatMap(page => page.data) || [];
  }, [data]);

  const totalCount = data?.pages?.[0]?.totalCount || 0;

  // Process the raw office data
  const processedOffices = useMemo(() => {
    return offices.map((office: any) => ({
      ...office,
      tags: Array.isArray(office.tags) ? office.tags : [],
      monthly_data: Array.isArray(office.monthly_data) ? office.monthly_data : [],
    }));
  }, [offices]);

  // Handle errors
  React.useEffect(() => {
    if (error) {
      announce('Failed to load offices data', 'assertive');
      toast({
        title: "Error",
        description: "Failed to load offices data",
        variant: "destructive",
      });
    }
  }, [error, toast, announce]);

  // Announce data loaded
  React.useEffect(() => {
    if (offices.length > 0 && !loading) {
      announce(`${offices.length} offices loaded`);
    }
  }, [offices, loading, announce]);

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
          <div>
            <h1 className="text-3xl font-bold text-foreground">Offices</h1>
            <p className="text-muted-foreground">Loading your offices...</p>
          </div>
          <Skeleton className="h-9 w-24" />
        </div>

        {/* Tier Summary Cards Skeletons */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4" role="grid" aria-label="Loading office tier summary">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} role="gridcell">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-8 w-12" />
                  </div>
                  <Skeleton className="h-8 w-16 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Offices Table Skeleton */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Office Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SkeletonTable rows={8} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <main id="main-content" role="main">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Offices</h1>
              <p className="text-muted-foreground" id="offices-description">
                Manage and track performance of dental office referral sources
              </p>
            </div>
            <div className="flex items-center gap-4" role="toolbar" aria-label="Office actions">
              <div className="text-sm text-muted-foreground" aria-live="polite">
                {offices.length} of {totalCount} office{totalCount !== 1 ? 's' : ''}
              </div>
              {isFetching && (
                <div 
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                  role="status"
                  aria-live="polite"
                >
                  <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Refreshing...</span>
                </div>
              )}
              <AccessibleButton 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  refetch();
                  announce('Refreshing offices data');
                }}
                disabled={isFetching}
                loading={isFetching}
                loadingText="Refreshing offices..."
                aria-label="Refresh offices data"
                shortcut="R"
              >
                <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
                Refresh
              </AccessibleButton>
            </div>
          </div>

          {/* Tier Summary Cards */}
          <section aria-labelledby="tier-summary-heading">
            <h2 id="tier-summary-heading" className="sr-only">Office Tier Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4" role="grid">
              {Object.entries(TIER_CONFIG).map(([tier, config]) => (
                <Card key={tier} className="hover:shadow-card transition-shadow" role="gridcell" tabIndex={0}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">{config.label}</p>
                        <p 
                          className="text-2xl font-bold"
                          aria-label={`${tierCounts[tier] || 0} ${config.label} offices`}
                        >
                          {tierCounts[tier] || 0}
                        </p>
                      </div>
                      <div className={`px-3 py-1.5 rounded-full ${config.bg} ${config.text} ${config.border} border font-semibold text-sm shadow-sm hover:shadow-md transition-all duration-200`}>
                        {config.label}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Filters and Office Table */}
          <section aria-labelledby="office-table-heading">
            <Card>
              <CardHeader>
                <CardTitle id="office-table-heading" className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" aria-hidden="true" />
                  Office Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4 mb-6" role="search">
                  <div className="flex-1">
                    <label htmlFor="office-search" className="sr-only">
                      Search offices by name or address
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                      <Input
                        id="office-search"
                        placeholder="Search offices..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 w-full"
                        aria-describedby="search-help"
                      />
                    </div>
                    <p id="search-help" className="sr-only">
                      Search for offices by name or address. Results update as you type.
                    </p>
                  </div>
                  
                  <div className="w-full sm:w-48">
                    <label htmlFor="tier-filter" className="sr-only">
                      Filter offices by tier
                    </label>
                    <Select 
                      value={tierFilter} 
                      onValueChange={(value) => {
                        setTierFilter(value as TierFilter);
                        announce(`Filtered to ${value === 'all' ? 'all tiers' : value + ' tier'}`);
                      }}
                    >
                      <SelectTrigger id="tier-filter" aria-describedby="tier-filter-help">
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
                    <p id="tier-filter-help" className="sr-only">
                      Filter the office list by performance tier
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-border overflow-hidden">
                  <Table role="table" aria-label="Office performance data">
                    <TableHeader>
                      <TableRow role="row">
                        <TableHead role="columnheader">
                          <AccessibleButton 
                            variant="ghost" 
                            onClick={() => {
                              handleSort('name');
                              announce(`Sorted by office name ${sortDirection === 'asc' ? 'descending' : 'ascending'}`);
                            }}
                            className="h-auto p-0 font-medium"
                            aria-label={`Sort by office name ${sortField === 'name' ? (sortDirection === 'asc' ? 'descending' : 'ascending') : ''}`}
                          >
                            Office Name
                            <ArrowUpDown className="ml-2 h-4 w-4" aria-hidden="true" />
                          </AccessibleButton>
                        </TableHead>
                        <TableHead className="text-center" role="columnheader">Tier</TableHead>
                        <TableHead className="text-center" role="columnheader">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AccessibleButton 
                                variant="ghost" 
                                onClick={() => {
                                  handleSort('l12');
                                  announce(`Sorted by last 12 months ${sortDirection === 'asc' ? 'descending' : 'ascending'}`);
                                }}
                                className="h-auto p-0 font-medium"
                                aria-label={`Sort by last 12 months referrals ${sortField === 'l12' ? (sortDirection === 'asc' ? 'descending' : 'ascending') : ''}`}
                              >
                                L12
                                <ArrowUpDown className="ml-2 h-4 w-4" aria-hidden="true" />
                              </AccessibleButton>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Last 12 Months - Total referrals in the past year</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableHead>
                        <TableHead className="text-center" role="columnheader">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AccessibleButton 
                                variant="ghost" 
                                onClick={() => {
                                  handleSort('r3');
                                  announce(`Sorted by recent 3 months ${sortDirection === 'asc' ? 'descending' : 'ascending'}`);
                                }}
                                className="h-auto p-0 font-medium"
                                aria-label={`Sort by recent 3 months referrals ${sortField === 'r3' ? (sortDirection === 'asc' ? 'descending' : 'ascending') : ''}`}
                              >
                                R3
                                <ArrowUpDown className="ml-2 h-4 w-4" aria-hidden="true" />
                              </AccessibleButton>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Recent 3 Months - Referrals in the last quarter</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableHead>
                        <TableHead className="text-center" role="columnheader">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AccessibleButton 
                                variant="ghost" 
                                onClick={() => {
                                  handleSort('mslr');
                                  announce(`Sorted by months since last referral ${sortDirection === 'asc' ? 'descending' : 'ascending'}`);
                                }}
                                className="h-auto p-0 font-medium"
                                aria-label={`Sort by months since last referral ${sortField === 'mslr' ? (sortDirection === 'asc' ? 'descending' : 'ascending') : ''}`}
                              >
                                MSLR
                                <ArrowUpDown className="ml-2 h-4 w-4" aria-hidden="true" />
                              </AccessibleButton>
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
                            <div className="text-muted-foreground" role="status">
                              {offices.length === 0 ? 'No offices found' : 'No offices match your filters'}
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredAndSortedOffices.map((office, index) => (
                          <TableRow 
                            key={office.id} 
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                // Could navigate to office detail page here
                              }
                            }}
                            aria-label={`Office: ${office.name}, Tier: ${office.tier}, ${office.l12} referrals last 12 months`}
                          >
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
                              <div 
                                className={`inline-flex items-center px-3 py-1.5 rounded-full ${TIER_CONFIG[office.tier].bg} ${TIER_CONFIG[office.tier].text} ${TIER_CONFIG[office.tier].border} border font-semibold text-sm shadow-sm hover:shadow-md transition-all duration-200`}
                                aria-label={`${office.tier} tier office`}
                              >
                                {office.tier}
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-semibold" aria-label={`${office.l12} referrals in last 12 months`}>
                              {office.l12}
                            </TableCell>
                            <TableCell className="text-center font-semibold" aria-label={`${office.r3} referrals in recent 3 months`}>
                              {office.r3}
                            </TableCell>
                            <TableCell className="text-center font-semibold" aria-label={office.mslr === 999 ? 'No recent referrals' : `${office.mslr} months since last referral`}>
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
                    <AccessibleButton
                      onClick={() => {
                        loadMore();
                        announce('Loading more offices');
                      }}
                      disabled={loadingMore}
                      loading={loadingMore}
                      loadingText="Loading more offices..."
                      variant="outline"
                      className="gap-2"
                      aria-label="Load more offices"
                    >
                      {loadingMore ? 'Loading...' : 'Load More Offices'}
                    </AccessibleButton>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
    </TooltipProvider>
  );
}