import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useOffices } from '@/hooks/useOffices';
import { useOfficeTags } from '@/hooks/useOfficeTags';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { ResilientErrorBoundary } from '@/components/ResilientErrorBoundary';
import { SelectionActionBar } from '@/components/SelectionActionBar';
import { TierQuickActions } from '@/components/TierQuickActions';
import { TagBadge } from '@/components/TagBadge';
import { TagManager } from '@/components/TagManager';
import { AddressCorrectionDialog } from '@/components/AddressCorrectionDialog';
import { Eye, Edit, Users, Trash2, Search, MapPin, Phone, Mail, AlertCircle, TrendingUp, Calendar, Tag, Loader2, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PatientLoadHistoryEditor } from '@/components/PatientLoadHistoryEditor';
import { AddOfficeDialog as AddSourceDialog } from '@/components/AddSourceDialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface Office {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  notes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  currentMonthReferrals: number;
  totalReferrals: number;
  strength: 'Strong' | 'Moderate' | 'Sporadic' | 'Cold';
  category: 'VIP' | 'Strong' | 'Moderate' | 'Sporadic' | 'Cold';
  lastActiveMonth?: string | null;
  google_rating?: number | null;
  l12?: number;
  r3?: number;
  mslr?: number;
  tier?: string;
}

function OfficesContent() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingOffice, setEditingOffice] = useState<Office | null>(null);
  const [editForm, setEditForm] = useState<Partial<Office>>({});
  const [patientLoadOffice, setPatientLoadOffice] = useState<{ id: string; name: string; currentLoad: number } | null>(null);
  const [tierFilter, setTierFilter] = useState<string>('All');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'name' | 'tier' | 'l12' | 'r3' | 'total' | 'lastActive'>('total');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);
  
  // Address correction state
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [correctionProgress, setCorrectionProgress] = useState(0);
  const [showCorrectionDialog, setShowCorrectionDialog] = useState(false);
  const [correctionResults, setCorrectionResults] = useState<any[]>([]);
  const [hasBeenCorrected, setHasBeenCorrected] = useState(false);

  // Fetch offices data with tier calculations
  const { data: offices, isLoading, error, refetch } = useOffices();
  
  // Fetch tags
  const { tags, getTagsForOffice, getOfficesWithTag } = useOfficeTags();

  // Filter and sort offices
  const { filteredOffices, stats, officesByTier } = useMemo(() => {
    if (!offices) return { 
      filteredOffices: [], 
      stats: { total: 0, vip: 0, warm: 0, dormant: 0, cold: 0, l12Total: 0, currentMonth: 0 },
      officesByTier: { VIP: [], Warm: [], Dormant: [], Cold: [] }
    };
    
    // Filter by search term
    let filtered = offices.filter(office =>
      office.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      office.address?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Filter by tier
    if (tierFilter !== 'All') {
      filtered = filtered.filter(office => office.tier === tierFilter);
    }

    // Filter by tag
    if (tagFilter) {
      const officeIdsWithTag = getOfficesWithTag(tagFilter);
      filtered = filtered.filter(office => officeIdsWithTag.includes(office.id));
    }

    // Sort offices
    filtered.sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortField) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'tier':
          const tierOrder = { VIP: 1, Warm: 2, Dormant: 3, Cold: 4 };
          aVal = tierOrder[a.tier as keyof typeof tierOrder] || 5;
          bVal = tierOrder[b.tier as keyof typeof tierOrder] || 5;
          break;
        case 'l12':
          aVal = a.l12 || 0;
          bVal = b.l12 || 0;
          break;
        case 'r3':
          aVal = a.r3 || 0;
          bVal = b.r3 || 0;
          break;
        case 'total':
          aVal = a.totalReferrals || 0;
          bVal = b.totalReferrals || 0;
          break;
        case 'lastActive':
          aVal = a.lastActiveMonth || '0000-00';
          bVal = b.lastActiveMonth || '0000-00';
          break;
        default:
          return 0;
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    // Calculate stats
    const stats = {
      total: offices.length,
      vip: offices.filter(o => o.tier === 'VIP').length,
      warm: offices.filter(o => o.tier === 'Warm').length,
      dormant: offices.filter(o => o.tier === 'Dormant').length,
      cold: offices.filter(o => o.tier === 'Cold').length,
      l12Total: offices.reduce((sum, o) => sum + (o.l12 || 0), 0),
      currentMonth: offices.reduce((sum, o) => sum + (o.currentMonthReferrals || 0), 0)
    };

    // Group offices by tier for quick actions
    const officesByTier = {
      VIP: offices.filter(o => o.tier === 'VIP').map(o => o.id),
      Warm: offices.filter(o => o.tier === 'Warm').map(o => o.id),
      Dormant: offices.filter(o => o.tier === 'Dormant').map(o => o.id),
      Cold: offices.filter(o => o.tier === 'Cold').map(o => o.id),
    };

    return { filteredOffices: filtered, stats, officesByTier };
  }, [offices, searchTerm, tierFilter, tagFilter, sortField, sortDirection, getOfficesWithTag]);

  // Selection handlers
  const handleSelectAll = useCallback(() => {
    if (selectedIds.length === filteredOffices.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredOffices.map(o => o.id));
    }
  }, [selectedIds, filteredOffices]);

  const handleSelectOne = useCallback((id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  // Campaign handlers for SelectionActionBar
  const handleEmailCampaign = useCallback(() => {
    // Navigate to campaigns with pre-selected offices
    navigate(`/campaigns?action=new-email&ids=${selectedIds.join(',')}`);
  }, [navigate, selectedIds]);

  const handleGiftCampaign = useCallback(() => {
    navigate(`/campaigns?action=new-gift&ids=${selectedIds.join(',')}`);
  }, [navigate, selectedIds]);

  const handleScheduleVisits = useCallback(() => {
    navigate(`/marketing-visits?action=schedule&ids=${selectedIds.join(',')}`);
  }, [navigate, selectedIds]);

  // Tier quick action handlers
  const handleTierEmailCampaign = useCallback((tier: string, ids: string[]) => {
    navigate(`/campaigns?action=new-email&tier=${tier}&ids=${ids.join(',')}`);
  }, [navigate]);

  const handleTierGiftCampaign = useCallback((tier: string, ids: string[]) => {
    navigate(`/campaigns?action=new-gift&tier=${tier}&ids=${ids.join(',')}`);
  }, [navigate]);

  const handleTierScheduleVisits = useCallback((tier: string, ids: string[]) => {
    navigate(`/marketing-visits?action=schedule&tier=${tier}&ids=${ids.join(',')}`);
  }, [navigate]);

  const handleView = (office: Office) => {
    navigate(`/sources/${office.id}`);
  };

  const handleEdit = (office: Office) => {
    setEditingOffice(office);
    setEditForm(office);
  };

  const handleSaveEdit = async () => {
    if (!editingOffice || !editForm.name) return;

    try {
      const { error } = await supabase
        .from('patient_sources')
        .update({
          name: editForm.name,
          address: editForm.address || null,
          phone: editForm.phone || null,
          email: editForm.email || null,
          notes: editForm.notes || null,
        })
        .eq('id', editingOffice.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Office updated successfully'
      });
      setEditingOffice(null);
      setEditForm({});
      refetch();
    } catch (error) {
      console.error('Error updating office:', error);
      toast({
        title: 'Error',
        description: 'Failed to update office',
        variant: 'destructive'
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingOffice(null);
    setEditForm({});
  };

  const handlePatientCounts = (office: Office) => {
    setPatientLoadOffice({
      id: office.id,
      name: office.name,
      currentLoad: office.currentMonthReferrals || 0
    });
  };

  const handleDelete = async (office: Office) => {
    if (!confirm(`Are you sure you want to delete ${office.name}?`)) return;

    try {
      const { error } = await supabase
        .from('patient_sources')
        .delete()
        .eq('id', office.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Office deleted successfully'
      });
      setSelectedIds(prev => prev.filter(id => id !== office.id));
      refetch();
    } catch (error) {
      console.error('Error deleting office:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete office',
        variant: 'destructive'
      });
    }
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getTierBadgeVariant = (tier?: string) => {
    switch (tier) {
      case 'VIP': return 'default';
      case 'Warm': return 'secondary';
      case 'Dormant': return 'outline';
      case 'Cold': return 'outline';
      default: return 'outline';
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'VIP': return '🌟';
      case 'Warm': return '🔥';
      case 'Dormant': return '💤';
      case 'Cold': return '❄️';
      default: return '📍';
    }
  };

  const formatLastActive = (lastActiveMonth?: string | null) => {
    if (!lastActiveMonth) return 'Never';
    const date = new Date(lastActiveMonth + '-01');
    const now = new Date();
    const monthsDiff = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
    
    if (monthsDiff === 0) return 'This month';
    if (monthsDiff === 1) return 'Last month';
    return `${monthsDiff} months ago`;
  };

  const selectedNames = useMemo(() => 
    filteredOffices.filter(o => selectedIds.includes(o.id)).map(o => o.name),
    [filteredOffices, selectedIds]
  );

  // Address correction handler
  const handleCorrectAddresses = async () => {
    if (hasBeenCorrected) {
      toast({
        title: "Already corrected",
        description: "Addresses have already been corrected once. Refresh the page to run again.",
        variant: "destructive",
      });
      return;
    }

    const officesWithAddresses = offices?.filter(o => o.address) || [];
    const officeIds = officesWithAddresses.map(o => o.id);

    if (officeIds.length === 0) {
      toast({
        title: "No addresses to correct",
        description: "No partner offices with addresses found.",
        variant: "destructive",
      });
      return;
    }

    setIsCorrecting(true);
    setCorrectionProgress(0);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      toast({
        title: "Starting address correction",
        description: `Processing ${officeIds.length} offices with Google Maps API...`,
      });

      const { data: result, error: fnError } = await supabase.functions.invoke('correct-office-addresses', {
        body: { officeIds },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (fnError) {
        throw new Error(fnError.message || 'Address correction failed');
      }
      
      const resultsWithNames = result.results.map((r: any) => {
        const office = officesWithAddresses.find(o => o.id === r.id);
        return {
          ...r,
          officeName: office?.name || 'Unknown'
        };
      });

      setCorrectionResults(resultsWithNames);
      setShowCorrectionDialog(true);
      setCorrectionProgress(100);

    } catch (error: any) {
      console.error('Address correction error:', error);
      toast({
        title: "Correction failed",
        description: error.message || "Failed to correct addresses",
        variant: "destructive",
      });
    } finally {
      setIsCorrecting(false);
    }
  };

  const handleApplyCorrections = async (selectedIds: string[]) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const updates = correctionResults
        .filter(r => selectedIds.includes(r.id))
        .map(r => ({ id: r.id, address: r.corrected }));

      const { data: result, error: fnError } = await supabase.functions.invoke('apply-address-corrections', {
        body: { updates },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (fnError) {
        throw new Error(fnError.message || 'Failed to apply corrections');
      }

      toast({
        title: "Addresses updated",
        description: `Successfully updated ${result.updated} of ${result.total} addresses.`,
      });

      setShowCorrectionDialog(false);
      setHasBeenCorrected(true);
      
      // Refresh to show updated addresses
      setTimeout(() => refetch(), 500);
    } catch (error: any) {
      console.error('Apply corrections error:', error);
      toast({
        title: "Update failed",
        description: error.message || 'Unknown error occurred',
        variant: "destructive",
      });
      throw error;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-3 mb-8">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 title-icon" />
          <h1 className="text-4xl font-bold page-title">Partner Offices</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Manage your referring partner offices and track their referral performance
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div className="flex flex-wrap gap-2">
          <Popover open={isTagManagerOpen} onOpenChange={setIsTagManagerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Tag className="h-4 w-4 mr-2" />
                Manage Tags
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="start">
              <TagManager />
            </PopoverContent>
          </Popover>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleCorrectAddresses}
            disabled={isCorrecting || hasBeenCorrected || !offices?.length}
          >
            {isCorrecting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Correcting...
              </>
            ) : hasBeenCorrected ? (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                Addresses Corrected
              </>
            ) : (
              <>
                <MapPin className="h-4 w-4 mr-2" />
                Fix Addresses
              </>
            )}
          </Button>
        </div>
        <AddSourceDialog onOfficeAdded={refetch} />
      </div>

      {/* Correction Progress */}
      {isCorrecting && (
        <Card>
          <CardContent className="py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Correcting addresses with Google Maps...</span>
                <span>{correctionProgress}%</span>
              </div>
              <Progress value={correctionProgress} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Address Correction Dialog */}
      <AddressCorrectionDialog
        open={showCorrectionDialog}
        onOpenChange={setShowCorrectionDialog}
        corrections={correctionResults}
        onConfirm={handleApplyCorrections}
      />

      {/* Stats Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Partner Office Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Partners</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">🌟 VIP</p>
              <p className="text-2xl font-bold">{stats.vip}</p>
              <p className="text-xs text-muted-foreground">{stats.total > 0 ? Math.round((stats.vip / stats.total) * 100) : 0}%</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">🔥 Warm</p>
              <p className="text-2xl font-bold">{stats.warm}</p>
              <p className="text-xs text-muted-foreground">{stats.total > 0 ? Math.round((stats.warm / stats.total) * 100) : 0}%</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">💤 Dormant</p>
              <p className="text-2xl font-bold">{stats.dormant}</p>
              <p className="text-xs text-muted-foreground">{stats.total > 0 ? Math.round((stats.dormant / stats.total) * 100) : 0}%</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">❄️ Cold</p>
              <p className="text-2xl font-bold">{stats.cold}</p>
              <p className="text-xs text-muted-foreground">{stats.total > 0 ? Math.round((stats.cold / stats.total) * 100) : 0}%</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">L12 Referrals</p>
              <p className="text-2xl font-bold">{stats.l12Total}</p>
              <p className="text-xs text-muted-foreground">{stats.currentMonth} this month</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search offices by name or address..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2 flex-wrap items-center">
                <Button
                  variant={tierFilter === 'All' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTierFilter('All')}
                >
                  All
                </Button>
                <div className="flex items-center">
                  <Button
                    variant={tierFilter === 'VIP' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTierFilter('VIP')}
                  >
                    🌟 VIP
                  </Button>
                  <TierQuickActions
                    tier="VIP"
                    officeIds={officesByTier.VIP}
                    onEmailCampaign={handleTierEmailCampaign}
                    onGiftCampaign={handleTierGiftCampaign}
                    onScheduleVisits={handleTierScheduleVisits}
                  />
                </div>
                <div className="flex items-center">
                  <Button
                    variant={tierFilter === 'Warm' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTierFilter('Warm')}
                  >
                    🔥 Warm
                  </Button>
                  <TierQuickActions
                    tier="Warm"
                    officeIds={officesByTier.Warm}
                    onEmailCampaign={handleTierEmailCampaign}
                    onGiftCampaign={handleTierGiftCampaign}
                    onScheduleVisits={handleTierScheduleVisits}
                  />
                </div>
                <div className="flex items-center">
                  <Button
                    variant={tierFilter === 'Dormant' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTierFilter('Dormant')}
                  >
                    💤 Dormant
                  </Button>
                  <TierQuickActions
                    tier="Dormant"
                    officeIds={officesByTier.Dormant}
                    onEmailCampaign={handleTierEmailCampaign}
                    onGiftCampaign={handleTierGiftCampaign}
                    onScheduleVisits={handleTierScheduleVisits}
                  />
                </div>
                <div className="flex items-center">
                  <Button
                    variant={tierFilter === 'Cold' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTierFilter('Cold')}
                  >
                    ❄️ Cold
                  </Button>
                  <TierQuickActions
                    tier="Cold"
                    officeIds={officesByTier.Cold}
                    onEmailCampaign={handleTierEmailCampaign}
                    onGiftCampaign={handleTierGiftCampaign}
                    onScheduleVisits={handleTierScheduleVisits}
                  />
                </div>
              </div>
            </div>
            
            {/* Tag Filters */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-sm text-muted-foreground mr-2">Filter by tag:</span>
                {tagFilter && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setTagFilter(null)}
                    className="h-7 px-2 text-xs"
                  >
                    Clear filter
                  </Button>
                )}
                {tags.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => setTagFilter(tagFilter === tag.id ? null : tag.id)}
                    className={`transition-all ${tagFilter === tag.id ? 'ring-2 ring-primary ring-offset-2 rounded-full' : 'hover:opacity-80'}`}
                  >
                    <TagBadge name={tag.name} color={tag.color} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Unified Office Table */}
      {isLoading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Loading offices...
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-destructive font-medium">Failed to load offices</p>
            <p className="text-sm text-muted-foreground mt-2">Please try refreshing</p>
          </CardContent>
        </Card>
      ) : filteredOffices.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {searchTerm || tierFilter !== 'All' || tagFilter ? 'No offices found matching your filters' : 'No offices yet. Add your first partner office!'}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedIds.length === filteredOffices.length && filteredOffices.length > 0}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('name')}
                    >
                      Office Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead 
                      className="text-center cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('tier')}
                    >
                      Category {sortField === 'tier' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead 
                      className="text-center cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('total')}
                    >
                      Total {sortField === 'total' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead 
                      className="text-center cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('l12')}
                    >
                      L12 {sortField === 'l12' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead 
                      className="text-center cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('r3')}
                    >
                      R3 {sortField === 'r3' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('lastActive')}
                    >
                      Last Active {sortField === 'lastActive' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOffices.map((office) => {
                    const officeTags = getTagsForOffice(office.id);
                    return (
                      <TableRow key={office.id} className={selectedIds.includes(office.id) ? 'bg-primary/5' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.includes(office.id)}
                            onCheckedChange={() => handleSelectOne(office.id)}
                            aria-label={`Select ${office.name}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{office.name}</p>
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {office.address || 'No address'}
                            </p>
                            {officeTags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {officeTags.map(tag => (
                                  <TagBadge key={tag.id} name={tag.name} color={tag.color} />
                                ))}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={getTierBadgeVariant(office.tier)}>
                            {getTierIcon(office.tier || 'Cold')} {office.tier}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-semibold">{office.totalReferrals || 0}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-semibold">{office.l12 || 0}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-semibold">{office.r3 || 0}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {formatLastActive(office.lastActiveMonth)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleView(office)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(office)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handlePatientCounts(office)}>
                              <Users className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(office)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {filteredOffices.map((office) => {
                const officeTags = getTagsForOffice(office.id);
                return (
                  <Card key={office.id} className={`p-4 ${selectedIds.includes(office.id) ? 'ring-2 ring-primary' : ''}`}>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedIds.includes(office.id)}
                          onCheckedChange={() => handleSelectOne(office.id)}
                          aria-label={`Select ${office.name}`}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-semibold">{office.name}</h3>
                              <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {office.address || 'No address'}
                              </p>
                            </div>
                            <Badge variant={getTierBadgeVariant(office.tier)}>
                              {getTierIcon(office.tier || 'Cold')} {office.tier}
                            </Badge>
                          </div>
                          {officeTags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {officeTags.map(tag => (
                                <TagBadge key={tag.id} name={tag.name} color={tag.color} />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 text-center py-2 border-y">
                        <div>
                          <p className="text-xs text-muted-foreground">Total</p>
                          <p className="text-lg font-bold">{office.totalReferrals || 0}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">L12</p>
                          <p className="text-lg font-bold">{office.l12 || 0}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">R3</p>
                          <p className="text-lg font-bold">{office.r3 || 0}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        Last active: {formatLastActive(office.lastActiveMonth)}
                      </div>

                      {office.phone && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {office.phone}
                        </div>
                      )}

                      {office.email && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {office.email}
                        </div>
                      )}
                      
                      <div className="flex gap-2 pt-2">
                        <Button variant="outline" size="sm" onClick={() => handleView(office)} className="flex-1">
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleEdit(office)} className="flex-1">
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handlePatientCounts(office)} className="flex-1">
                          <Users className="h-4 w-4 mr-1" />
                          Counts
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(office)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selection Action Bar */}
      <SelectionActionBar
        selectedIds={selectedIds}
        selectedNames={selectedNames}
        onClear={clearSelection}
        onEmailCampaign={handleEmailCampaign}
        onGiftCampaign={handleGiftCampaign}
        onScheduleVisits={handleScheduleVisits}
      />

      {/* Edit Office Dialog */}
      {editingOffice && (
        <Dialog open={!!editingOffice} onOpenChange={() => handleCancelEdit()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Office - {editingOffice.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={editForm.name || ''}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Address</label>
                <Input
                  value={editForm.address || ''}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Phone</label>
                <Input
                  value={editForm.phone || ''}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input
                  value={editForm.email || ''}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={handleCancelEdit}>Cancel</Button>
                <Button onClick={handleSaveEdit}>Save Changes</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Patient Load Modal */}
      {patientLoadOffice && (
        <Dialog open={!!patientLoadOffice} onOpenChange={() => setPatientLoadOffice(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Patient Counts - {patientLoadOffice.name}</DialogTitle>
            </DialogHeader>
            <PatientLoadHistoryEditor
              officeId={patientLoadOffice.id}
              officeName={patientLoadOffice.name}
              currentLoad={patientLoadOffice.currentLoad}
              onUpdate={(newLoad) => {
                setPatientLoadOffice(null);
                refetch();
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export function Offices() {
  return (
    <ResilientErrorBoundary showNetworkStatus>
      <OfficesContent />
    </ResilientErrorBoundary>
  );
}
