/**
 * Adding practices to the watchlist.
 *
 * Suggestions come from offices already discovered, so they cost nothing;
 * search bills Google and is therefore a deliberate act behind its own tab.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, RefreshCw, Search, Sparkles, Star } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { ClinicRow } from '@/hooks/useCompetitorIntel';

export interface CandidateResult {
  google_place_id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  google_rating: number | null;
  review_count: number | null;
  specialty?: string | null;
  distance_miles?: number | null;
}

interface Props {
  clinic: ClinicRow | null;
  watchedPlaceIds: Set<string>;
  onAdd: (entry: CandidateResult & { clinic_id?: string }) => void;
  isAdding: boolean;
}

export function AddCompetitorPanel({ clinic, watchedPlaceIds, onAdd, isAdding }: Props) {
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<CandidateResult[]>([]);
  const [searched, setSearched] = useState(false);

  const suggestions = useQuery({
    queryKey: ['competitor-suggestions', clinic?.id, clinic?.specialty],
    queryFn: async (): Promise<CandidateResult[]> => {
      const { data, error } = await supabase.functions.invoke('competitor-snapshot', {
        body: { action: 'suggest', watchlist_entry: { specialty: clinic?.specialty ?? 'dentist' } },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data?.results ?? [];
    },
    enabled: !!clinic,
    staleTime: 1000 * 60 * 5,
  });

  const handleSearch = async () => {
    if (!clinic?.latitude || !clinic?.longitude) {
      toast({ title: 'Set your practice address first', variant: 'destructive' });
      return;
    }
    setSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('competitor-snapshot', {
        body: {
          action: 'search',
          watchlist_entry: {
            specialty: query.trim() || clinic.specialty || 'dentist',
            radius_miles: 10,
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResults(data?.results ?? []);
      setSearched(true);
    } catch (e) {
      toast({
        title: 'Search failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSearching(false);
    }
  };

  const visible = (list: CandidateResult[]) =>
    list.filter((r) => !watchedPlaceIds.has(r.google_place_id));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Plus className="h-4 w-4" />
          Add competitors
        </CardTitle>
        <CardDescription>
          Track the practices competing for the same referrals you are
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="suggested">
          <TabsList className="mb-4 w-full">
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
            {suggestions.isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
              </div>
            ) : visible(suggestions.data ?? []).length === 0 ? (
              <Empty
                icon={<Sparkles className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />}
                title="No suggestions available"
                body="Suggestions are drawn from practices you have already discovered. Run a discovery search and they will appear here at no extra cost."
              />
            ) : (
              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {visible(suggestions.data ?? []).map((result) => (
                  <ResultRow
                    key={result.google_place_id}
                    result={result}
                    onAdd={() => onAdd({ ...result, clinic_id: clinic?.id })}
                    isAdding={isAdding}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="search">
            <div className="mb-4 flex gap-2">
              <Input
                placeholder="orthodontist, pediatric dentist, oral surgeon…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />
              <Button onClick={handleSearch} disabled={searching} className="gap-1.5">
                {searching ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">Search</span>
              </Button>
            </div>

            {searching ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
              </div>
            ) : visible(results).length > 0 ? (
              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {visible(results).map((result) => (
                  <ResultRow
                    key={result.google_place_id}
                    result={result}
                    onAdd={() => onAdd({ ...result, clinic_id: clinic?.id })}
                    isAdding={isAdding}
                  />
                ))}
              </div>
            ) : (
              <Empty
                icon={<Search className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />}
                title={searched ? 'Nothing new found' : 'Search practices near you'}
                body={
                  searched
                    ? 'Every match within 10 miles is either already on your watchlist or is your own practice.'
                    : 'Searches run within 10 miles of your practice address.'
                }
              />
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function ResultRow({
  result,
  onAdd,
  isAdding,
}: {
  result: CandidateResult;
  onAdd: () => void;
  isAdding: boolean;
}) {
  return (
    <div className="group flex items-center justify-between gap-3 rounded-xl border border-border/50 p-3 transition-all hover:border-border hover:bg-muted/20">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{result.name}</p>
        <p className="truncate text-xs text-muted-foreground">{result.address}</p>
        <div className="mt-1.5 flex items-center gap-3 text-xs">
          {result.google_rating != null && (
            <span className="flex items-center gap-1 font-medium">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {result.google_rating}
            </span>
          )}
          {result.review_count != null && result.review_count > 0 && (
            <span className="text-muted-foreground">
              {result.review_count.toLocaleString()} reviews
            </span>
          )}
          {result.distance_miles != null && (
            <span className="text-muted-foreground">
              {Number(result.distance_miles).toFixed(1)} mi
            </span>
          )}
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={onAdd}
        disabled={isAdding}
        className="shrink-0 gap-1 opacity-70 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Plus className="h-3.5 w-3.5" />
        Watch
      </Button>
    </div>
  );
}

function Empty({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="py-8 text-center">
      {icon}
      <p className="text-sm font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">{body}</p>
    </div>
  );
}
