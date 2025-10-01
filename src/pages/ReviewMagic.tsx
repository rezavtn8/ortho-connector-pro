import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Star, RefreshCw, Search, Filter, Link as LinkIcon, TrendingUp, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ReviewMagicCard } from "@/components/ReviewMagicCard";
import { ConnectLocationDialog } from "@/components/ConnectLocationDialog";
import { Skeleton } from "@/components/ui/skeleton";

export default function ReviewMagic() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isClinicOwner, setIsClinicOwner] = useState(false);
  const [clinicData, setClinicData] = useState<any>(null);
  const [connectionStatus, setConnectionStatus] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Check if user owns a clinic
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('clinic_id, role, clinics!user_profiles_clinic_id_fkey(id, name, owner_id, google_place_id)')
        .eq('user_id', user?.id)
        .single();

      if (profileError || !profile?.clinic_id || (profile as any).clinics.owner_id !== user?.id) {
        setIsClinicOwner(false);
        return;
      }

      setIsClinicOwner(true);
      setClinicData((profile as any).clinics);

      // Check connection status
      const { data: token } = await supabase
        .from('google_business_tokens' as any)
        .select('*')
        .eq('clinic_id', profile.clinic_id)
        .maybeSingle();

      setConnectionStatus(token);

      // Load reviews if connected
      if (token) {
        await loadReviews(profile.clinic_id);
      }

    } catch (error: any) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load Reviews Magic data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadReviews = async (clinicId: string) => {
    try {
      const { data, error } = await supabase
        .from('google_reviews' as any)
        .select('*')
        .eq('clinic_id', clinicId)
        .order('posted_at', { ascending: false });

      if (error) throw error;
      setReviews(data || []);
    } catch (error: any) {
      console.error('Error loading reviews:', error);
    }
  };

  const handleSync = async () => {
    if (!clinicData?.id) return;
    
    try {
      setSyncing(true);
      const { error } = await supabase.functions.invoke('sync-google-business-reviews', {
        body: { clinic_id: clinicData.id },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Reviews synced successfully",
      });

      await loadReviews(clinicData.id);
    } catch (error: any) {
      console.error('Error syncing reviews:', error);
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync reviews",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const filteredReviews = reviews
    .filter(review => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          review.author_name?.toLowerCase().includes(query) ||
          review.review_text?.toLowerCase().includes(query)
        );
      }
      return true;
    })
    .filter(review => {
      if (filterStatus === 'unreplied') return !review.review_reply;
      if (filterStatus === 'needs_attention') return review.needs_attention;
      if (filterStatus === 'low_rating') return review.rating <= 3;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime();
      if (sortBy === 'oldest') return new Date(a.posted_at).getTime() - new Date(b.posted_at).getTime();
      if (sortBy === 'rating_high') return b.rating - a.rating;
      if (sortBy === 'rating_low') return a.rating - b.rating;
      return 0;
    });

  const stats = {
    total: reviews.length,
    average: reviews.length > 0 ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) : '0.0',
    unreplied: reviews.filter(r => !r.review_reply).length,
    needsAttention: reviews.filter(r => r.needs_attention).length,
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!isClinicOwner) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Reviews Magic</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Access Restricted</AlertTitle>
              <AlertDescription>
                Reviews Magic is only available for clinic owners to manage their own practice reviews.
                This feature cannot be used for partner or referring office reviews.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reviews Magic</h1>
          <p className="text-muted-foreground">Manage your Google Business Profile reviews</p>
        </div>
        {connectionStatus && (
          <Button onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </Button>
        )}
      </div>

      {/* Connection Status */}
      {!connectionStatus ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5" />
              Connect Google Business Profile
            </CardTitle>
            <CardDescription>
              Connect your Google Business Profile to start managing reviews
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ConnectLocationDialog clinicId={clinicData?.id} onConnected={loadData} />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Reviews</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
                <Star className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold flex items-center gap-1">
                  {stats.average}
                  <Star className="h-5 w-5 fill-yellow-500 text-yellow-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Unreplied</CardTitle>
                <AlertTriangle className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.unreplied}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Needs Attention</CardTitle>
                <TrendingUp className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.needsAttention}</div>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Search */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search reviews..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Reviews</SelectItem>
                    <SelectItem value="unreplied">Unreplied</SelectItem>
                    <SelectItem value="needs_attention">Needs Attention</SelectItem>
                    <SelectItem value="low_rating">Low Rating (≤3)</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                    <SelectItem value="rating_high">Highest Rating</SelectItem>
                    <SelectItem value="rating_low">Lowest Rating</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Reviews List */}
          <div className="space-y-4">
            {filteredReviews.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No reviews found</p>
                </CardContent>
              </Card>
            ) : (
              filteredReviews.map((review) => (
                <ReviewMagicCard 
                  key={review.id} 
                  review={review} 
                  onReplyPosted={() => loadReviews(clinicData.id)}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
