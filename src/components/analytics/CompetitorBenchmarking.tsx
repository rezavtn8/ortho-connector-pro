import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Star, TrendingUp, TrendingDown, Minus, RefreshCw, Plus, Trash2,
  Search, Crown, Shield, Eye, MessageSquare, ArrowUp, ArrowDown,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, Legend,
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

  // Fetch your clinic's Google data
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
            specialty: 'dentist',
            latitude: clinic.latitude,
            longitude: clinic.longitude,
            clinic_id: clinic.id,
          },
        },
      });
      return data;
    },
    enabled: !!clinic?.google_place_id,
    staleTime: 1000 * 60 * 60, // 1 hour
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
            specialty: searchQuery || 'dentist',
            radius_miles: 10,
          },
        },
      });
      if (error) throw error;
      // Filter out own clinic and already-watched
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

  // Build comparison data
  const comparisonData = useMemo(() => {
    if (!watchlist || !snapshots) return [];

    // Filter out own clinic from competitor list
    const competitors = watchlist.filter(w => w.google_place_id !== clinic?.google_place_id);

    return competitors.map(w => {
      const latestSnapshot = snapshots.find(s => s.watchlist_id === w.id);
      const allSnapshots = snapshots
        .filter(s => s.watchlist_id === w.id)
        .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));

      return {
        ...w,
        rating: latestSnapshot?.google_rating,
        reviewCount: latestSnapshot?.review_count || 0,
        velocity: latestSnapshot?.review_velocity || 0,
        history: allSnapshots,
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

  // Chart data for comparison
  const chartData = useMemo(() => {
    if (!comparisonData.length && !mySnapshot) return [];

    const items = [];
    if (mySnapshot) {
      items.push({
        name: clinic?.name || 'Your Practice',
        rating: mySnapshot.google_rating || 0,
        reviews: mySnapshot.review_count || 0,
        isYou: true,
      });
    }
    comparisonData.forEach(c => {
      items.push({
        name: c.name.length > 20 ? c.name.substring(0, 18) + '…' : c.name,
        rating: c.rating || 0,
        reviews: c.reviewCount,
        isYou: false,
      });
    });
    return items;
  }, [comparisonData, mySnapshot, clinic]);

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

  const isLoading = watchlistLoading || snapshotsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Your Practice Hero Card */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 relative overflow-hidden">
        <div className="absolute top-3 right-3">
          <Badge variant="secondary" className="gap-1">
            <Crown className="h-3 w-3" />
            Your Practice
          </Badge>
        </div>
        <CardHeader className="pb-3">
          <CardTitle className="text-xl flex items-center gap-2">
            {clinic?.name || 'Your Practice'}
          </CardTitle>
          <CardDescription>{clinic?.address || 'Set your clinic address in Settings'}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-lg bg-background/60 border border-border/50">
              <div className="flex items-center justify-center gap-1 text-2xl font-bold text-primary">
                <Star className="h-5 w-5 fill-primary" />
                {mySnapshot?.google_rating?.toFixed(1) || '—'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Google Rating</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-background/60 border border-border/50">
              <div className="text-2xl font-bold">{mySnapshot?.review_count?.toLocaleString() || '—'}</div>
              <p className="text-xs text-muted-foreground mt-1">Total Reviews</p>
            </div>
            {marketPosition && (
              <>
                <div className="text-center p-3 rounded-lg bg-background/60 border border-border/50">
                  <div className="text-2xl font-bold">
                    #{marketPosition.ratingRank}
                    <span className="text-sm font-normal text-muted-foreground"> / {marketPosition.total}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Rating Rank</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-background/60 border border-border/50">
                  <div className="text-2xl font-bold">
                    #{marketPosition.reviewRank}
                    <span className="text-sm font-normal text-muted-foreground"> / {marketPosition.total}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Review Rank</p>
                </div>
              </>
            )}
          </div>

          {marketPosition && (
            <div className="mt-4 p-3 rounded-lg bg-background/60 border border-border/50">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Market Position:</strong>{' '}
                {Number(marketPosition.myRating) >= Number(marketPosition.avgRating)
                  ? <span className="text-green-600">Your rating ({marketPosition.myRating}) is above the market average ({marketPosition.avgRating})</span>
                  : <span className="text-amber-600">Your rating ({marketPosition.myRating}) is below the market average ({marketPosition.avgRating}). Consider strategies to improve reviews.</span>
                }
                {' · '}
                {marketPosition.myReviews >= marketPosition.avgReviews
                  ? <span className="text-green-600">You have more reviews than average ({marketPosition.avgReviews})</span>
                  : <span className="text-amber-600">You have fewer reviews than average ({marketPosition.avgReviews})</span>
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search & Add Competitors */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4" />
            Find Competitors
          </CardTitle>
          <CardDescription>Search for same-specialty practices near your clinic</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Search specialty (e.g. orthodontist, pediatric dentist)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={isSearching}>
              {isSearching ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-1.5 hidden sm:inline">Search</span>
            </Button>
          </div>

          {searchResults.length > 0 && (
            <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
              {searchResults.map((result) => (
                <div key={result.google_place_id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{result.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{result.address}</p>
                    <div className="flex items-center gap-3 mt-1">
                      {result.google_rating && (
                        <span className="flex items-center gap-1 text-xs">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          {result.google_rating}
                        </span>
                      )}
                      {result.review_count > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {result.review_count} reviews
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addMutation.mutate(result)}
                    disabled={addMutation.isPending}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span className="ml-1">Watch</span>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comparison Chart */}
      {chartData.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Rating Comparison</CardTitle>
              <CardDescription>Google ratings across competitors</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => v.toFixed(1)} />
                  <Bar
                    dataKey="rating"
                    radius={[0, 4, 4, 0]}
                    fill="hsl(var(--primary))"
                  />
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
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar
                    dataKey="reviews"
                    radius={[0, 4, 4, 0]}
                    fill="hsl(var(--chart-2))"
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Competitor Cards */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Watched Competitors ({comparisonData.length})
        </h3>
        {comparisonData.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
            Refresh All
          </Button>
        )}
      </div>

      {comparisonData.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Eye className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">No competitors being tracked yet.</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Search above to find and watch same-specialty practices near you.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {comparisonData.map(comp => {
            const ratingDiff = mySnapshot?.google_rating
              ? (comp.rating || 0) - mySnapshot.google_rating
              : null;

            return (
              <Card key={comp.id} className="border-border/50 hover:border-border transition-colors">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{comp.name}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{comp.address}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeMutation.mutate(comp.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-md bg-muted/30">
                      <div className="flex items-center justify-center gap-1">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        <span className="font-bold text-sm">{comp.rating?.toFixed(1) || '—'}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Rating</p>
                    </div>
                    <div className="p-2 rounded-md bg-muted/30">
                      <div className="font-bold text-sm">{comp.reviewCount.toLocaleString()}</div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Reviews</p>
                    </div>
                    <div className="p-2 rounded-md bg-muted/30">
                      <div className="flex items-center justify-center gap-0.5">
                        {comp.velocity > 0 ? (
                          <TrendingUp className="h-3 w-3 text-green-600" />
                        ) : comp.velocity < 0 ? (
                          <TrendingDown className="h-3 w-3 text-red-600" />
                        ) : (
                          <Minus className="h-3 w-3 text-muted-foreground" />
                        )}
                        <span className="font-bold text-sm">{comp.velocity.toFixed(1)}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">/week</p>
                    </div>
                  </div>

                  {ratingDiff !== null && (
                    <div className={`mt-3 text-xs font-medium flex items-center gap-1 ${
                      ratingDiff > 0 ? 'text-red-600' : ratingDiff < 0 ? 'text-green-600' : 'text-muted-foreground'
                    }`}>
                      {ratingDiff > 0 ? (
                        <><ArrowUp className="h-3 w-3" /> {ratingDiff.toFixed(1)} above you</>
                      ) : ratingDiff < 0 ? (
                        <><ArrowDown className="h-3 w-3" /> {Math.abs(ratingDiff).toFixed(1)} below you</>
                      ) : (
                        <>Same rating as you</>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
