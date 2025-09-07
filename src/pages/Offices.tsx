import React, { useState, useEffect } from 'react';
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
import { PatientSource, MonthlyPatients } from '@/lib/database.types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePagination } from '@/hooks/usePagination';

interface OfficeData extends PatientSource {
  l12: number; // Last 12 months
  r3: number;  // Last 3 months  
  mslr: number; // Months since last referral
  tier: 'VIP' | 'Warm' | 'Cold' | 'Dormant';
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
  const [allOffices, setAllOffices] = useState<OfficeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [sortField, setSortField] = useState<SortField>('l12');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchTerm, setSearchTerm] = useState('');

  // Paginated offices state
  const [displayedOffices, setDisplayedOffices] = useState<OfficeData[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageSize = 20;

  useEffect(() => {
    loadOffices();
  }, []);

  const calculateTier = (l12: number, r3: number, mslr: number, allOffices: { l12: number }[]): OfficeData['tier'] => {
    // Dormant: no referrals in last 12 months
    if (l12 === 0) return 'Dormant';

    // VIP: top 20% by L12
    const sortedByL12 = allOffices.map(o => o.l12).sort((a, b) => b - a);
    const vipThresholdIndex = Math.ceil(sortedByL12.length * 0.2) - 1;
    const vipThreshold = sortedByL12[vipThresholdIndex] || 0;
    
    if (l12 >= vipThreshold && vipThreshold > 0) return 'VIP';

    // Warm: ≥4 in last 12 months OR ≥1 in last 3 months (but not VIP)
    if (l12 >= 4 || r3 >= 1) return 'Warm';

    // Cold: everything else
    return 'Cold';
  };

  const calculateMonthsSinceLastReferral = (monthlyData: MonthlyPatients[]): number => {
    const currentDate = new Date();
    const currentYearMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    
    // Sort by year_month descending to find the most recent month with patients
    const sortedData = monthlyData
      .filter(data => data.patient_count > 0)
      .sort((a, b) => b.year_month.localeCompare(a.year_month));
    
    if (sortedData.length === 0) return 999; // No referrals ever
    
    const lastReferralYearMonth = sortedData[0].year_month;
    const [lastYear, lastMonth] = lastReferralYearMonth.split('-').map(Number);
    const [currentYear, currentMonth] = [currentDate.getFullYear(), currentDate.getMonth() + 1];
    
    return (currentYear - lastYear) * 12 + (currentMonth - lastMonth);
  };

  const loadOffices = async () => {
    try {
      setLoading(true);
      
      // Load office sources only
      const { data: sourcesData, error: sourcesError } = await supabase
        .from('patient_sources')
        .select('*')
        .eq('source_type', 'Office')
        .eq('is_active', true)
        .order('name');

      if (sourcesError) throw sourcesError;

      // Load monthly data for the past 12 months
      const { data: monthlyData, error: monthlyError } = await supabase
        .from('monthly_patients')
        .select('*');

      if (monthlyError) throw monthlyError;

      // Calculate metrics for each office
      const processedOffices: OfficeData[] = [];
      const currentDate = new Date();
      
      for (const source of sourcesData || []) {
        const sourceMonthlyData = monthlyData?.filter(m => m.source_id === source.id) || [];
        
        // Calculate L12 (last 12 months)
        const l12 = sourceMonthlyData
          .filter(m => {
            const [year, month] = m.year_month.split('-').map(Number);
            const dataDate = new Date(year, month - 1);
            const twelveMonthsAgo = new Date(currentDate.getFullYear(), currentDate.getMonth() - 12);
            return dataDate >= twelveMonthsAgo;
          })
          .reduce((sum, m) => sum + m.patient_count, 0);

        // Calculate R3 (last 3 months)
        const r3 = sourceMonthlyData
          .filter(m => {
            const [year, month] = m.year_month.split('-').map(Number);
            const dataDate = new Date(year, month - 1);
            const threeMonthsAgo = new Date(currentDate.getFullYear(), currentDate.getMonth() - 3);
            return dataDate >= threeMonthsAgo;
          })
          .reduce((sum, m) => sum + m.patient_count, 0);

        // Calculate MSLR (months since last referral)
        const mslr = calculateMonthsSinceLastReferral(sourceMonthlyData);

        processedOffices.push({
          ...source,
          l12,
          r3,
          mslr,
          tier: 'Dormant', // Will be calculated after all offices are processed
        });
      }

      // Calculate tiers after processing all offices (needed for VIP calculation)
      const officesWithTiers = processedOffices.map(office => ({
        ...office,
        tier: calculateTier(office.l12, office.r3, office.mslr, processedOffices),
      }));

      setAllOffices(officesWithTiers);
    } catch (error) {
      console.error('Error loading offices:', error);
      toast({
        title: "Error",
        description: "Failed to load offices data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Filter and sort logic
  const filteredAndSortedOffices = allOffices
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

  // Paginate filtered results
  useEffect(() => {
    setDisplayedOffices(filteredAndSortedOffices.slice(0, (currentPage + 1) * pageSize));
    setHasMore(filteredAndSortedOffices.length > (currentPage + 1) * pageSize);
  }, [filteredAndSortedOffices, currentPage]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(0);
  }, [searchTerm, tierFilter, sortField, sortDirection]);

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      setLoadingMore(true);
      setTimeout(() => {
        setCurrentPage(prev => prev + 1);
        setLoadingMore(false);
      }, 500); // Simulate loading time
    }
  };

  const tierCounts = allOffices.reduce((acc, office) => {
    acc[office.tier] = (acc[office.tier] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

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
              Showing {displayedOffices.length} of {filteredAndSortedOffices.length} office{filteredAndSortedOffices.length !== 1 ? 's' : ''}
            </div>
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
                  {displayedOffices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <div className="text-muted-foreground">
                          {allOffices.length === 0 ? 'No offices found' : 'No offices match your filters'}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayedOffices.map((office) => (
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
            {hasMore && displayedOffices.length > 0 && (
              <div className="flex justify-center pt-6">
                <Button 
                  onClick={loadMore} 
                  disabled={loadingMore}
                  variant="outline"
                  className="gap-2"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>Load More Offices</>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}