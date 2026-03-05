import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Star, TrendingUp, TrendingDown, Minus, RefreshCw, Plus, Trash2,
  Search, Crown, Eye, ArrowUp, ArrowDown, Sparkles, MapPin, Zap, Target,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';

export function CompetitorBenchmarking() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Fetch user's clinic info
  const { data: clinic } = useQuery({
    queryKey: ['clinic-for-benchmarking'],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('clinic_id')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (!profile?.clinic_id) return null;
      const { data: clinicData } = await supabase
        .from('clinics')
        .select('*')
        .eq('id', profile.clinic_id)
        .single();
      return clinicData;
    },
    enabled: !!user,
  });

  // Fetch your clinic's Google data (add yourself to watchlist for tracking)
  const { data: myClinicData } = useQuery({
    queryKey: ['my-clinic-google-data', clinic?.google_place_id],
    queryFn: async () => {
      if (!clinic?.google_place_id) return null;
      const { data } = await supabase.functions.invoke('competitor-snapshot', {
        body: {
          action: 'add',
          watchlist_entry: {
            google_place_id: clinic.google_place_id,
            name: clinic.name,
            address: clinic.address,
            specialty: clinic?.specialty || 'dentist',
            latitude: clinic.latitude,
            longitude: clinic.longitude,
            clinic_id: clinic.id,
          },
        },
      });
      return data;
    },
    enabled: !!clinic?.google_place_id,
    staleTime: 1000 * 60 * 60,
  });

  // Fetch watchlist
  const { data: watchlist, isLoading: watchlistLoading } = useQuery({
    queryKey: ['competitor-watchlist'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('competitor_watchlist')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch latest snapshots
  const { data: snapshots, isLoading: snapshotsLoading } = useQuery({
    queryKey: ['competitor-snapshots', watchlist?.map(w => w.id)],
    queryFn: async () => {
      if (!watchlist || watchlist.length === 0) return [];
      const ids = watchlist.map(w => w.id);
      const { data, error } = await supabase
        .from('competitor_snapshots')
        .select('*')
        .in('watchlist_id', ids)
        .order('snapshot_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!watchlist && watchlist.length > 0,
  });

  // Fetch suggestions from discovered offices
  const { data: suggestions, isLoading: suggestionsLoading } = useQuery({
    queryKey: ['competitor-suggestions', clinic?.id, clinic?.specialty],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('competitor-snapshot', {
        body: {
          action: 'suggest',
          watchlist_entry: { specialty: clinic?.specialty || 'dentist' },
        },
      });
      if (error) throw error;
      return data?.results || [];
    },
    enabled: !!user && !!clinic,
    staleTime: 1000 * 60 * 5,
  });

  // Search for competitors
  const handleSearch = async () => {
    if (!clinic?.latitude || !clinic?.longitude) {
      toast({ title: 'Set your clinic address first', variant: 'destructive' });
      return;
    }
    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('competitor-snapshot', {
        body: {
          action: 'search',
          watchlist_entry: {
            latitude: clinic.latitude,
            longitude: clinic.longitude,
            specialty: searchQuery || (clinic as any)?.specialty || 'dentist',
            radius_miles: 10,
          },
        },
      });
      if (error) throw error;
      const watchedIds = new Set(watchlist?.map(w => w.google_place_id) || []);
      const filtered = (data?.results || []).filter(
        (r: any) => r.google_place_id !== clinic?.google_place_id && !watchedIds.has(r.google_place_id)
      );
      setSearchResults(filtered);
    } catch (e: any) {
      toast({ title: 'Search failed', description: e.message, variant: 'destructive' });
    } finally {
      setIsSearching(false);
    }
  };

  // Add competitor
  const addMutation = useMutation({
    mutationFn: async (entry: any) => {
      const { data, error } = await supabase.functions.invoke('competitor-snapshot', {
        body: { action: 'add', watchlist_entry: { ...entry, clinic_id: clinic?.id } },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competitor-watchlist'] });
      queryClient.invalidateQueries({ queryKey: ['competitor-snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['competitor-suggestions'] });
      toast({ title: 'Competitor added to watchlist' });
    },
  });

  // Remove competitor
  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke('competitor-snapshot', {
        body: { action: 'remove', watchlist_entry: { id } },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competitor-watchlist'] });
      queryClient.invalidateQueries({ queryKey: ['competitor-snapshots'] });
      toast({ title: 'Competitor removed' });
    },
  });

  // Refresh all snapshots
  const refreshMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('competitor-snapshot', {
        body: { action: 'refresh' },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['competitor-snapshots'] });
      toast({ title: `Refreshed ${data?.refreshed || 0} competitors` });
    },
  });

  // Build comparison data (exclude own clinic)
  const comparisonData = useMemo(() => {
    if (!watchlist || !snapshots) return [];
    const competitors = watchlist.filter(w => w.google_place_id !== clinic?.google_place_id);
    return competitors.map(w => {
      const latestSnapshot = snapshots.find(s => s.watchlist_id === w.id);
      return {
        ...w,
        rating: latestSnapshot?.google_rating,
        reviewCount: latestSnapshot?.review_count || 0,
        velocity: latestSnapshot?.review_velocity || 0,
      };
    }).sort((a, b) => (b.rating || 0) - (a.rating || 0));
  }, [watchlist, snapshots, clinic]);

  // My clinic's latest snapshot
  const mySnapshot = useMemo(() => {
    if (!watchlist || !snapshots || !clinic?.google_place_id) return null;
    const myEntry = watchlist.find(w => w.google_place_id === clinic.google_place_id);
    if (!myEntry) return null;
    return snapshots.find(s => s.watchlist_id === myEntry.id) || null;
  }, [watchlist, snapshots, clinic]);

  // Market position
  const marketPosition = useMemo(() => {
    if (!mySnapshot || !comparisonData.length) return null;
    const myRating = mySnapshot.google_rating || 0;
    const myReviews = mySnapshot.review_count || 0;
    const allRatings = [myRating, ...comparisonData.map(c => c.rating || 0)].sort((a, b) => b - a);
    const allReviews = [myReviews, ...comparisonData.map(c => c.reviewCount)].sort((a, b) => b - a);
    const ratingRank = allRatings.indexOf(myRating) + 1;
    const reviewRank = allReviews.indexOf(myReviews) + 1;
    const total = allRatings.length;
    const avgRating = allRatings.reduce((a, b) => a + b, 0) / total;
    const avgReviews = Math.round(allReviews.reduce((a, b) => a + b, 0) / total);
    return { ratingRank, reviewRank, total, avgRating: avgRating.toFixed(1), avgReviews, myRating, myReviews };
  }, [mySnapshot, comparisonData]);

  // Chart data
  const chartData = useMemo(() => {
    const items = [];
    if (mySnapshot) {
      items.push({
        name: (clinic?.name || 'You').substring(0, 18),
        rating: mySnapshot.google_rating || 0,
        reviews: mySnapshot.review_count || 0,
        fill: 'hsl(var(--primary))',
      });
    }
    comparisonData.forEach(c => {
      items.push({
        name: c.name.length > 18 ? c.name.substring(0, 16) + '…' : c.name,
        rating: c.rating || 0,
        reviews: c.reviewCount,
        fill: 'hsl(var(--muted-foreground) / 0.5)',
      });
    });
    return items;
  }, [comparisonData, mySnapshot, clinic]);

  const isLoading = watchlistLoading || snapshotsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-52 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── YOUR PRACTICE HERO ── */}
      <Card variant="glass" className="relative overflow-hidden border-primary/20">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-primary/4 pointer-events-none" />
        <div className="absolute top-4 right-4 z-10">
          <Badge className="gap-1.5 bg-primary/15 text-primary border-primary/25 backdrop-blur-sm px-3 py-1">
            <Crown className="h-3.5 w-3.5" />
            Your Practice
          </Badge>
        </div>
        <CardHeader className="pb-2 relative">
          <CardTitle className="text-2xl font-bold tracking-tight">
            {clinic?.name || 'Your Practice'}
          </CardTitle>
          <CardDescription className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {clinic?.address || 'Set your clinic address in Settings'}
          </CardDescription>
        </CardHeader>
        <CardContent className="relative">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricBox
              value={mySnapshot?.google_rating?.toFixed(1) || '—'}
              label="Google Rating"
              icon={<Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
              highlight
            />
            <MetricBox
              value={mySnapshot?.review_count?.toLocaleString() || '—'}
              label="Total Reviews"
              icon={<Zap className="h-4 w-4 text-primary" />}
            />
            {marketPosition ? (
              <>
                <MetricBox
                  value={`#${marketPosition.ratingRank}`}
                  sublabel={`of ${marketPosition.total}`}
                  label="Rating Rank"
                  icon={<Target className="h-4 w-4 text-primary" />}
                />
                <MetricBox
                  value={`#${marketPosition.reviewRank}`}
                  sublabel={`of ${marketPosition.total}`}
                  label="Review Rank"
                  icon={<TrendingUp className="h-4 w-4 text-primary" />}
                />
              </>
            ) : (
              <>
                <MetricBox value="—" label="Rating Rank" icon={<Target className="h-4 w-4 text-muted-foreground" />} />
                <MetricBox value="—" label="Review Rank" icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />} />
              </>
            )}
          </div>

          {marketPosition && (
            <div className="mt-4 p-4 rounded-xl bg-background/70 backdrop-blur-sm border border-border/50">
              <p className="text-sm leading-relaxed">
                <span className="font-semibold text-foreground">Market Summary: </span>
                {Number(marketPosition.myRating) >= Number(marketPosition.avgRating) ? (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    Rating ({marketPosition.myRating}) above market avg ({marketPosition.avgRating}) ✓
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400">
                    Rating ({marketPosition.myRating}) below market avg ({marketPosition.avgRating})
                  </span>
                )}
                {' · '}
                {marketPosition.myReviews >= marketPosition.avgReviews ? (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    More reviews than avg ({marketPosition.avgReviews}) ✓
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400">
                    Fewer reviews than avg ({marketPosition.avgReviews})
                  </span>
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── ADD COMPETITORS ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Plus className="h-4.5 w-4.5" />
                Add Competitors
              </CardTitle>
              <CardDescription className="mt-1">Track same-specialty practices to benchmark performance</CardDescription>
            </div>
            {comparisonData.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => refreshMutation.mutate()}
                disabled={refreshMutation.isPending}
                className="gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="suggested" className="w-full">
            <TabsList className="w-full mb-4">
              <TabsTrigger value="suggested" className="flex-1 gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Suggested
              </TabsTrigger>
              <TabsTrigger value="search" className="flex-1 gap-1.5">
                <Search className="h-3.5 w-3.5" />
                Search Google
              </TabsTrigger>
            </TabsList>

            <TabsContent value="suggested">
              {suggestionsLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
                </div>
              ) : (suggestions || []).length === 0 ? (
                <div className="text-center py-8">
                  <Sparkles className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No suggestions yet.</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Discover offices first, then we'll suggest same-specialty matches.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {(suggestions || []).map((s: any) => (
                    <ResultCard
                      key={s.google_place_id}
                      result={s}
                      onAdd={() => addMutation.mutate(s)}
                      isAdding={addMutation.isPending}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="search">
              <div className="flex gap-2 mb-4">
                <Input
                  placeholder="Search specialty (e.g. orthodontist, pediatric dentist)..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  className="flex-1"
                />
                <Button onClick={handleSearch} disabled={isSearching} className="gap-1.5">
                  {isSearching ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  <span className="hidden sm:inline">Search</span>
                </Button>
              </div>

              {searchResults.length > 0 ? (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {searchResults.map((result) => (
                    <ResultCard
                      key={result.google_place_id}
                      result={result}
                      onAdd={() => addMutation.mutate(result)}
                      isAdding={addMutation.isPending}
                    />
                  ))}
                </div>
              ) : !isSearching ? (
                <div className="text-center py-8">
                  <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Search for practices near your clinic</p>
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* ── BENCHMARKING CHARTS ── */}
      {chartData.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Rating Comparison</CardTitle>
              <CardDescription>Google ratings across tracked practices</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 48)}>
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => v.toFixed(1)} />
                  <Bar dataKey="rating" radius={[0, 6, 6, 0]} fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Review Volume</CardTitle>
              <CardDescription>Total review count comparison</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 48)}>
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="reviews" radius={[0, 6, 6, 0]} fill="hsl(var(--chart-2))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── COMPETITOR GRID ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Watched Competitors ({comparisonData.length})
          </h3>
        </div>

        {comparisonData.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="py-16 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
                <Eye className="h-8 w-8 text-primary/60" />
              </div>
              <h3 className="font-semibold text-lg mb-1">No competitors tracked yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Add competitors from the suggestions above or search Google to start benchmarking your practice.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {comparisonData.map(comp => (
              <CompetitorCard
                key={comp.id}
                competitor={comp}
                myRating={mySnapshot?.google_rating}
                onRemove={() => removeMutation.mutate(comp.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──

function MetricBox({ value, sublabel, label, icon, highlight }: {
  value: string; sublabel?: string; label: string; icon: React.ReactNode; highlight?: boolean;
}) {
  return (
    <div className={`text-center p-4 rounded-xl border transition-all ${
      highlight
        ? 'bg-primary/5 border-primary/20 shadow-sm'
        : 'bg-background/60 border-border/50'
    }`}>
      <div className="flex items-center justify-center gap-1.5 mb-1">
        {icon}
        <span className="text-2xl font-bold">{value}</span>
        {sublabel && <span className="text-xs text-muted-foreground self-end mb-0.5">{sublabel}</span>}
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function ResultCard({ result, onAdd, isAdding }: { result: any; onAdd: () => void; isAdding: boolean }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl border border-border/50 hover:border-border hover:bg-muted/20 transition-all group">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{result.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-muted-foreground truncate">{result.address}</p>
        </div>
        <div className="flex items-center gap-3 mt-1.5">
          {result.google_rating && (
            <span className="flex items-center gap-1 text-xs font-medium">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {result.google_rating}
            </span>
          )}
          {result.review_count > 0 && (
            <span className="text-xs text-muted-foreground">{result.review_count} reviews</span>
          )}
          {result.distance_miles && (
            <span className="text-xs text-muted-foreground">{Number(result.distance_miles).toFixed(1)} mi</span>
          )}
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={onAdd}
        disabled={isAdding}
        className="gap-1 opacity-70 group-hover:opacity-100 transition-opacity"
      >
        <Plus className="h-3.5 w-3.5" />
        Watch
      </Button>
    </div>
  );
}

function CompetitorCard({ competitor, myRating, onRemove }: {
  competitor: any; myRating?: number | null; onRemove: () => void;
}) {
  const ratingDiff = myRating != null ? (competitor.rating || 0) - myRating : null;

  const diffColor = ratingDiff !== null
    ? ratingDiff > 0.1
      ? 'text-red-600 dark:text-red-400'
      : ratingDiff < -0.1
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-muted-foreground'
    : '';

  const diffBg = ratingDiff !== null
    ? ratingDiff > 0.1
      ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50'
      : ratingDiff < -0.1
        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50'
        : 'bg-muted/30 border-border/50'
    : 'bg-muted/30 border-border/50';

  return (
    <Card className="group hover:shadow-md transition-all border-border/60 hover:border-border">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{competitor.name}</p>
            <p className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              {competitor.address}
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground/50 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2.5 rounded-lg bg-muted/30 border border-border/30">
            <div className="flex items-center justify-center gap-1">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <span className="font-bold text-sm">{competitor.rating?.toFixed(1) || '—'}</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Rating</p>
          </div>
          <div className="text-center p-2.5 rounded-lg bg-muted/30 border border-border/30">
            <div className="font-bold text-sm">{competitor.reviewCount.toLocaleString()}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Reviews</p>
          </div>
          <div className="text-center p-2.5 rounded-lg bg-muted/30 border border-border/30">
            <div className="flex items-center justify-center gap-0.5">
              {competitor.velocity > 0 ? (
                <TrendingUp className="h-3 w-3 text-emerald-600" />
              ) : competitor.velocity < 0 ? (
                <TrendingDown className="h-3 w-3 text-red-600" />
              ) : (
                <Minus className="h-3 w-3 text-muted-foreground" />
              )}
              <span className="font-bold text-sm">{competitor.velocity.toFixed(1)}</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">/week</p>
          </div>
        </div>

        {ratingDiff !== null && (
          <div className={`mt-3 px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 border ${diffBg} ${diffColor}`}>
            {ratingDiff > 0.1 ? (
              <><ArrowUp className="h-3 w-3" /> {ratingDiff.toFixed(1)} above you</>
            ) : ratingDiff < -0.1 ? (
              <><ArrowDown className="h-3 w-3" /> {Math.abs(ratingDiff).toFixed(1)} below you</>
            ) : (
              <>Same rating as you</>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
