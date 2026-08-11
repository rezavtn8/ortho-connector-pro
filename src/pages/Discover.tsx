import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { RefreshCw, Search, Building2, Star, Globe, MapPin, Download, SlidersHorizontal, X } from 'lucide-react';
// xlsx is ~94 kB gzipped and only needed when the user actually exports, so it is
// imported on demand inside the handler rather than at module scope.
import { DiscoveryWizard } from '@/components/DiscoveryWizard';
import type {
  DiscoveryPreferences,
  DiscoverySearch,
  DiscoveryUsage,
} from '@/components/DiscoveryWizard';
import { DiscoveryResults } from '@/components/DiscoveryResults';
import { SelectionActionBar } from '@/components/SelectionActionBar';
import { BulkAddToNetworkDialog } from '@/components/BulkAddToNetworkDialog';
import { SaveToGroupDialog } from '@/components/SaveToGroupDialog';
import { DiscoveredOfficeGroups } from '@/components/DiscoveredOfficeGroups';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useDiscoveredGroups } from '@/hooks/useDiscoveredGroups';

interface DiscoveredOffice {
  id: string;
  google_place_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  google_rating: number | null;
  user_ratings_total: number | null;
  latitude: number | null;
  longitude: number | null;
  office_type: string;
  search_distance: number;
  search_location_lat: number;
  search_location_lng: number;
  discovery_session_id: string | null;
  imported: boolean;
  fetched_at: string;
  distance?: number;
}

interface DiscoverySession {
  id: string;
  search_distance: number;
  search_lat: number;
  search_lng: number;
  office_type_filter?: string;
  zip_code_override?: string;
  results_count: number;
  api_call_made: boolean;
  created_at: string;
}

const PREFERENCES_KEY = 'nexora.discovery.preferences';

const DEFAULT_PREFERENCES: DiscoveryPreferences = {
  officeType: 'all',
  minRating: 0,
  includeSpecialties: true,
  requireWebsite: false,
};

const SPECIALTY_TYPES = new Set([
  'Orthodontics',
  'Oral Surgery',
  'Endodontics',
  'Periodontics',
  'Multi-specialty',
]);

/**
 * Result preferences survive a reload.
 *
 * They used to live only inside the wizard, so a filter you chose was applied
 * once to the search response and then silently dropped the next time the page
 * loaded every discovered office straight from the database.
 */
function loadPreferences(): DiscoveryPreferences {
  try {
    const stored = localStorage.getItem(PREFERENCES_KEY);
    return stored ? { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) } : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/**
 * Distance shown in the results.
 *
 * `distance_miles` is measured from the point the search actually ran at, which
 * is the clinic for a normal search and the ZIP code for an override. The page
 * used to recompute it from the clinic every time, so a ZIP-code search
 * reported how far each office was from a clinic it had nothing to do with.
 */
function withDistance(office: any) {
  return {
    ...office,
    distance: office.distance_miles ?? undefined,
  };
}

/** "3 days", "20 minutes" — how old a cached result set is. */
function formatAge(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${Math.max(1, minutes)} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `${hours} hour${hours === 1 ? '' : 's'}`;
  return `${Math.round(hours / 24)} days`;
}

/** Does this office match the user's result preferences? */
function matchesPreferences(office: any, prefs: DiscoveryPreferences): boolean {
  if (prefs.officeType !== 'all' && office.office_type !== prefs.officeType) return false;
  if (prefs.minRating > 0 && (office.google_rating ?? 0) < prefs.minRating) return false;
  if (prefs.requireWebsite && !office.website) return false;
  if (!prefs.includeSpecialties && SPECIALTY_TYPES.has(office.office_type)) return false;
  return true;
}

/**
 * The JSON body of a failed edge function call.
 *
 * supabase-js turns any non-2xx response into a FunctionsHttpError whose
 * message is just the status line; the server's explanation — an invalid ZIP,
 * the weekly limit, a missing clinic — is only in the attached response.
 */
async function readErrorBody(error: unknown): Promise<any | null> {
  const response = (error as any)?.context;
  if (!response || typeof response.json !== 'function') return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export const Discover = () => {
  const [currentSession, setCurrentSession] = useState<DiscoverySession | null>(null);
  const [discoveredOffices, setDiscoveredOffices] = useState<DiscoveredOffice[]>([]);
  const [cacheMetadata, setCacheMetadata] = useState<{ cacheAge?: number; expiresIn?: number } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingFromDB, setIsLoadingFromDB] = useState(true);
  const [usage, setUsage] = useState<DiscoveryUsage>({ used: 0, limit: 25, resetsAt: null });
  const [preferences, setPreferences] = useState<DiscoveryPreferences>(loadPreferences);
  const [clinicLocation, setClinicLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [clinicName, setClinicName] = useState<string | null>(null);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [lastSearch, setLastSearch] = useState<DiscoverySearch | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkAddDialog, setShowBulkAddDialog] = useState(false);
  const [showNewSearchDialog, setShowNewSearchDialog] = useState(false);
  const [showSaveToGroupDialog, setShowSaveToGroupDialog] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [activeGroupMemberIds, setActiveGroupMemberIds] = useState<string[]>([]);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const { groups, createGroup, addToGroup, renameGroup, deleteGroup, getGroupMemberIds, loadGroups } = useDiscoveredGroups();

  useEffect(() => {
    if (user) {
      loadUserProfile();
      loadUsage();
      loadDiscoveredOfficesFromDB();
    }
  }, [user]);

  // Load group members when active group changes
  useEffect(() => {
    if (activeGroupId) {
      getGroupMemberIds(activeGroupId).then(setActiveGroupMemberIds);
    } else {
      setActiveGroupMemberIds([]);
    }
  }, [activeGroupId, groups]);

  const loadDiscoveredOfficesFromDB = async () => {
    if (!user) return;
    
    setIsLoadingFromDB(true);
    try {
      const { data: offices, error } = await supabase
        .from('discovered_offices')
        .select('*')
        .eq('discovered_by', user.id)
        .order('fetched_at', { ascending: false });

      if (error) throw error;

      if (offices && offices.length > 0) {
        setDiscoveredOffices(offices.map(withDistance));

        const { data: latestSession } = await supabase
          .from('discovery_sessions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestSession) {
          setCurrentSession({
            id: latestSession.id,
            search_distance: latestSession.search_distance,
            search_lat: latestSession.search_lat,
            search_lng: latestSession.search_lng,
            office_type_filter: latestSession.office_type_filter || undefined,
            zip_code_override: latestSession.zip_code_override || undefined,
            results_count: latestSession.results_count || 0,
            api_call_made: latestSession.api_call_made || false,
            created_at: latestSession.created_at
          });
        }
      }
    } catch (error) {
      console.error('Error loading discovered offices from DB:', error);
    } finally {
      setIsLoadingFromDB(false);
    }
  };

  const loadUserProfile = async () => {
    if (!user) return;

    try {
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('clinic_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error || !profile?.clinic_id) {
        return;
      }

      setClinicId(profile.clinic_id);

      const { data: clinic } = await supabase
        .from('clinics')
        .select('name, latitude, longitude')
        .eq('id', profile.clinic_id)
        .maybeSingle();

      if (clinic?.name) setClinicName(clinic.name);

      if (clinic?.latitude && clinic?.longitude) {
        setClinicLocation({
          lat: clinic.latitude,
          lng: clinic.longitude
        });
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  /**
   * Fresh searches run in the last 7 days.
   *
   * The counter used to be hard-coded to "0 of 999", so the wizard displayed a
   * usage figure that was never once true.
   */
  const loadUsage = async () => {
    if (!user) return;

    const windowStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('discovery_sessions')
      .select('created_at')
      .eq('user_id', user.id)
      .eq('api_call_made', true)
      .gte('created_at', windowStart)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading discovery usage:', error);
      return;
    }

    const oldest = data?.[0]?.created_at;
    setUsage((prev) => ({
      used: data?.length ?? 0,
      limit: prev.limit,
      resetsAt: oldest
        ? new Date(new Date(oldest).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
        : null,
    }));
  };

  const runDiscovery = async (search: DiscoverySearch, forceRefresh: boolean): Promise<void> => {
    if (!user) return;

    if (!clinicId) {
      toast({
        title: 'Clinic not set up',
        description: 'Please set up your clinic information in Settings first.',
        variant: 'destructive',
      });
      return;
    }

    if (!clinicLocation && !search.zipCode) {
      toast({
        title: 'No search location',
        description: 'Add your clinic address in Settings, or search by ZIP code.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('discover-nearby-offices', {
        body: {
          clinic_id: clinicId,
          distance: search.distance,
          search_lat: clinicLocation?.lat,
          search_lng: clinicLocation?.lng,
          zip_code_override: search.zipCode || null,
          force_refresh: forceRefresh,
        },
      });

      // A non-2xx edge function response arrives as an error with the body
      // attached, so the server's actual explanation is read out of it rather
      // than replaced with a generic "please try again".
      const payload = data ?? (await readErrorBody(error));

      if (payload?.usage) setUsage((prev) => ({ ...prev, ...payload.usage }));

      if (!payload?.success) {
        toast({
          title: payload?.usage && payload.usage.used >= payload.usage.limit
            ? 'Weekly search limit reached'
            : 'Discovery failed',
          description: payload?.error || 'Could not reach the discovery service. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      setCacheMetadata(
        payload.cached ? { cacheAge: payload.cacheAge, expiresIn: payload.expiresIn } : null,
      );

      const offices: DiscoveredOffice[] = (payload.offices || []).map(withDistance);
      setDiscoveredOffices(offices);

      setCurrentSession({
        id: payload.sessionId || 'temp-' + Date.now(),
        search_distance: search.distance,
        search_lat: payload.searchCenter?.lat ?? clinicLocation?.lat ?? 0,
        search_lng: payload.searchCenter?.lng ?? clinicLocation?.lng ?? 0,
        office_type_filter: undefined,
        zip_code_override: search.zipCode || undefined,
        results_count: offices.length,
        api_call_made: !payload.cached,
        created_at: new Date().toISOString(),
      });

      setShowNewSearchDialog(false);

      toast({
        title: offices.length > 0 ? 'Search complete' : 'No offices found',
        description: payload.message,
        variant: offices.length > 0 ? 'default' : 'destructive',
      });

      // Coverage gaps and Google-side failures are reported rather than passed
      // off as a complete result set.
      const diagnostics = payload.diagnostics;
      if (diagnostics?.failedRequests > 0 || diagnostics?.coverageIncomplete) {
        console.warn('[discover] partial coverage', diagnostics);
        toast({
          title: 'Partial results',
          description:
            'Some searches did not complete, so a few offices may be missing. Refresh to try again.',
          variant: 'destructive',
        });
      }

      if (!payload.cached) await loadUsage();
    } catch (error) {
      console.error('Error running discovery:', error);
      toast({
        title: 'Error',
        description: 'Failed to discover offices. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDiscover = async (search: DiscoverySearch, prefs: DiscoveryPreferences) => {
    setLastSearch(search);
    savePreferences(prefs);
    setIsLoading(true);
    try {
      await runDiscovery(search, false);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Re-run the last search against Google, bypassing the cache.
   *
   * "Refresh" previously called the same endpoint with the same arguments,
   * which hit the 7-day cache and returned the identical rows — the button
   * spun and changed nothing.
   */
  const handleForceRefresh = async () => {
    const search: DiscoverySearch = lastSearch ?? {
      distance: currentSession?.search_distance ?? 5,
      zipCode: currentSession?.zip_code_override ?? '',
    };

    setIsLoading(true);
    try {
      await runDiscovery(search, true);
    } finally {
      setIsLoading(false);
    }
  };

  const savePreferences = (prefs: DiscoveryPreferences) => {
    setPreferences(prefs);
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
    } catch {
      // A full or disabled localStorage is not a reason to fail the search.
    }
  };

  const handleOfficeAdded = async () => {
    await loadDiscoveredOfficesFromDB();
  };

  const handleStartOver = async () => {
    if (!user) return;
    
    try {
      await supabase
        .from('discovered_offices')
        .delete()
        .eq('discovered_by', user.id);
      
      setCurrentSession(null);
      setDiscoveredOffices([]);
      setCacheMetadata(null);
      setSelectedIds([]);
      
      toast({
        title: "Cleared",
        description: "All discovered offices have been removed.",
      });
    } catch (error) {
      console.error('Error clearing discoveries:', error);
      toast({
        title: "Error",
        description: "Failed to clear discoveries",
        variant: "destructive"
      });
    }
  };

  const handleSelectionChange = (ids: string[]) => {
    setSelectedIds(ids);
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const handleBulkAdd = () => {
    setShowBulkAddDialog(true);
  };

  const handleBulkAddComplete = async () => {
    setShowBulkAddDialog(false);
    setSelectedIds([]);
    await loadDiscoveredOfficesFromDB();
  };

  const handleRemoveSelected = async () => {
    if (!user || selectedIds.length === 0) return;

    try {
      const { error } = await supabase
        .from('discovered_offices')
        .delete()
        .in('id', selectedIds)
        .eq('discovered_by', user.id);

      if (error) throw error;

      setDiscoveredOffices(prev => prev.filter(o => !selectedIds.includes(o.id)));
      setSelectedIds([]);
      
      toast({
        title: "Removed",
        description: `${selectedIds.length} office(s) removed from discoveries`,
      });
    } catch (error) {
      console.error('Error removing offices:', error);
      toast({
        title: "Error",
        description: "Failed to remove offices",
        variant: "destructive"
      });
    }
  };

  // Group handlers
  const handleSaveToGroupCreate = async (name: string) => {
    await createGroup(name, selectedIds);
    setSelectedIds([]);
  };

  const handleSaveToGroupExisting = async (groupId: string) => {
    await addToGroup(groupId, selectedIds);
    setSelectedIds([]);
  };

  const handleSelectGroup = async (groupId: string | null) => {
    setActiveGroupId(groupId);
    setSelectedIds([]);
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (activeGroupId === groupId) setActiveGroupId(null);
    await deleteGroup(groupId);
  };

  const selectedOffices = discoveredOffices.filter(o => selectedIds.includes(o.id));
  const selectedNames = selectedOffices.map(o => o.name);

  // Filter offices by active group
  const groupOffices = activeGroupId
    ? discoveredOffices.filter(o => activeGroupMemberIds.includes(o.id))
    : discoveredOffices;

  // …then by the result preferences, which is the only place they are applied.
  const displayedOffices = useMemo(
    () => groupOffices.filter(o => matchesPreferences(o, preferences)),
    [groupOffices, preferences],
  );

  const hiddenByPreferences = groupOffices.length - displayedOffices.length;

  const activePreferenceLabels = [
    preferences.officeType !== 'all' ? preferences.officeType : null,
    preferences.minRating > 0 ? `${preferences.minRating}+ stars` : null,
    preferences.requireWebsite ? 'Has website' : null,
    !preferences.includeSpecialties ? 'General dentists only' : null,
  ].filter(Boolean) as string[];

  const handleExportExcel = async () => {
    const XLSX = await import('xlsx');
    const rows = displayedOffices.map((o) => ({
      Name: o.name,
      Address: o.address ?? '',
      Phone: o.phone ?? '',
      Website: o.website ?? '',
      'Google Rating': o.google_rating ?? '',
      'Total Reviews': o.user_ratings_total ?? '',
      'Office Type': o.office_type,
      'Distance (mi)': o.distance != null ? o.distance.toFixed(2) : '',
      Latitude: o.latitude ?? '',
      Longitude: o.longitude ?? '',
      'In Network': o.imported ? 'Yes' : 'No',
      'Google Place ID': o.google_place_id,
      'Discovered At': o.fetched_at,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 32 }, { wch: 40 }, { wch: 16 }, { wch: 30 },
      { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 14 },
      { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 28 }, { wch: 22 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Discovered Offices');
    const date = new Date().toISOString().split('T')[0];
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `discovered-offices-${date}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast({
      title: 'Export complete',
      description: `Exported ${rows.length} office${rows.length === 1 ? '' : 's'} to Excel.`,
    });
  };

  // Stats from displayed offices
  const newOffices = displayedOffices.filter(o => !o.imported);
  const highRatedOffices = newOffices.filter(o => (o.google_rating || 0) >= 4.0);
  const withWebsite = newOffices.filter(o => o.website);
  const ratedOffices = newOffices.filter(o => o.google_rating);
  const avgRating = ratedOffices.length > 0
    ? (ratedOffices.reduce((sum, o) => sum + (o.google_rating || 0), 0) / ratedOffices.length).toFixed(1)
    : '—';

  if (isLoadingFromDB) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Loading Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="border-border/50">
              <CardContent className="p-4">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats Grid with Action Buttons */}
      {discoveredOffices.length > 0 ? (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
              <Card className="border-border/50 hover:border-primary/30 transition-colors group">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-950/30 group-hover:scale-105 transition-transform">
                      <Building2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Available</p>
                      <p className="text-xl font-bold text-foreground">{newOffices.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-border/50 hover:border-primary/30 transition-colors group">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 group-hover:scale-105 transition-transform">
                      <Star className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">High Rated (4+)</p>
                      <p className="text-xl font-bold text-foreground">{highRatedOffices.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-border/50 hover:border-primary/30 transition-colors group">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 group-hover:scale-105 transition-transform">
                      <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">With Website</p>
                      <p className="text-xl font-bold text-foreground">{withWebsite.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-border/50 hover:border-primary/30 transition-colors group">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 group-hover:scale-105 transition-transform">
                      <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Avg Rating</p>
                      <p className="text-xl font-bold text-foreground">{avgRating}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-2 shrink-0">
              <Button
                onClick={handleExportExcel}
                variant="outline"
                disabled={displayedOffices.length === 0}
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export Excel
              </Button>
              <Button
                onClick={handleForceRefresh}
                variant="outline"
                disabled={isLoading}
                className="flex items-center gap-2"
                title={
                  cacheMetadata?.cacheAge != null
                    ? `These results were found ${formatAge(cacheMetadata.cacheAge)} ago. Refresh asks Google again.`
                    : 'Search Google again, ignoring saved results'
                }
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Dialog open={showNewSearchDialog} onOpenChange={setShowNewSearchDialog}>
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground">
                    <Search className="w-4 h-4" />
                    New Search
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>New Discovery Search</DialogTitle>
                  </DialogHeader>
                  <DiscoveryWizard
                    onDiscover={handleDiscover}
                    isLoading={isLoading}
                    usage={usage}
                    preferences={preferences}
                    clinicName={clinicName}
                    hasClinicLocation={clinicLocation != null}
                    compact
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Active result preferences — visible, so nothing is hidden silently */}
          {activePreferenceLabels.length > 0 && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-3 flex items-center gap-3 flex-wrap">
                <SlidersHorizontal className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm text-muted-foreground">Showing only:</span>
                {activePreferenceLabels.map((label) => (
                  <Badge key={label} variant="secondary">{label}</Badge>
                ))}
                {hiddenByPreferences > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {hiddenByPreferences} office{hiddenByPreferences === 1 ? '' : 's'} hidden
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() => savePreferences(DEFAULT_PREFERENCES)}
                >
                  <X className="w-4 h-4 mr-1" />
                  Show all
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Group Selector */}
          {groups.length > 0 && (
            <DiscoveredOfficeGroups
              groups={groups}
              activeGroupId={activeGroupId}
              onSelectGroup={handleSelectGroup}
              onRenameGroup={renameGroup}
              onDeleteGroup={handleDeleteGroup}
              groupMemberIds={activeGroupMemberIds}
            />
          )}
        </>
      ) : null}

      {/* Main Content */}
      {discoveredOffices.length === 0 ? (
        <DiscoveryWizard
          onDiscover={handleDiscover}
          isLoading={isLoading}
          usage={usage}
          preferences={preferences}
          clinicName={clinicName}
          hasClinicLocation={clinicLocation != null}
        />
      ) : (
        <DiscoveryResults
          offices={displayedOffices}
          session={currentSession}
          onAddToNetwork={() => {}}
          onOfficeAdded={handleOfficeAdded}
          isLoading={isLoading}
          selectedIds={selectedIds}
          onSelectionChange={handleSelectionChange}
          onStartOver={activeGroupId ? undefined : handleStartOver}
          activeGroupName={activeGroupId ? groups.find(g => g.id === activeGroupId)?.name : undefined}
        />
      )}

      {/* Selection Action Bar */}
      {selectedIds.length > 0 && (
        <SelectionActionBar
          selectedIds={selectedIds}
          selectedNames={selectedNames}
          onClear={handleClearSelection}
          onBulkAdd={handleBulkAdd}
          onRemove={handleRemoveSelected}
          onSaveToGroup={() => setShowSaveToGroupDialog(true)}
          isDiscoveredOffices={true}
        />
      )}

      {/* Bulk Add Dialog */}
      <BulkAddToNetworkDialog
        open={showBulkAddDialog}
        onOpenChange={setShowBulkAddDialog}
        offices={selectedOffices}
        onComplete={handleBulkAddComplete}
      />

      {/* Save to Group Dialog */}
      <SaveToGroupDialog
        open={showSaveToGroupDialog}
        onOpenChange={setShowSaveToGroupDialog}
        groups={groups}
        selectedCount={selectedIds.length}
        onCreateNew={handleSaveToGroupCreate}
        onAddToExisting={handleSaveToGroupExisting}
      />
    </div>
  );
};
