import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Star, MessageSquare, AlertCircle } from "lucide-react";
import { ReviewMagicCard } from "@/components/ReviewMagicCard";
import { ConnectLocationDialog } from "@/components/ConnectLocationDialog";

export default function ReviewMagic() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [offices, setOffices] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    const oauthStatus = searchParams.get('oauth');
    if (oauthStatus === 'success') {
      toast({
        title: "Success",
        description: "Google Business Profile connected successfully!",
      });
      navigate('/review-magic', { replace: true });
      fetchReviews();
    } else if (oauthStatus === 'error') {
      const message = searchParams.get('message') || 'Failed to connect';
      toast({
        title: "Connection Failed",
        description: message,
        variant: "destructive",
      });
      navigate('/review-magic', { replace: true });
    }
  }, [searchParams]);

  useEffect(() => {
    fetchOffices();
    fetchReviews();
  }, []);

  const fetchOffices = async () => {
    try {
      const { data, error } = await supabase
        .from('patient_sources')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setOffices(data || []);
    } catch (error) {
      console.error('Error fetching offices:', error);
    }
  };

  const fetchReviews = async () => {
    try {
      setLoading(true);
      let query = (supabase as any)
        .from('google_reviews')
        .select('*, patient_sources(name)')
        .order('posted_at', { ascending: false });

      if (selectedLocation !== 'all') {
        query = query.eq('office_id', selectedLocation);
      }

      if (filter === 'unread') {
        query = query.eq('is_read', false);
      } else if (filter === 'needs_attention') {
        query = query.eq('needs_attention', true);
      } else if (filter === 'replied') {
        query = query.not('review_reply', 'is', null);
      } else if (filter === 'unreplied') {
        query = query.is('review_reply', null);
      }

      const { data, error } = await query;

      if (error) throw error;
      setReviews(data || []);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      toast({
        title: "Error",
        description: "Failed to load reviews",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (officeId?: string) => {
    try {
      setSyncing(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke('sync-google-business-reviews', {
        body: { 
          office_id: officeId || null,
          sync_all: !officeId 
        },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;

      toast({
        title: "Sync Complete",
        description: `Successfully synced reviews`,
      });
      
      fetchReviews();
    } catch (error) {
      console.error('Error syncing reviews:', error);
      toast({
        title: "Sync Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const stats = {
    total: reviews.length,
    unread: reviews.filter(r => !r.is_read).length,
    needsAttention: reviews.filter(r => r.needs_attention).length,
    avgRating: reviews.length > 0 
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : '0.0',
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Review Magic</h1>
          <p className="text-muted-foreground">
            Manage Google reviews across all your partner offices
          </p>
        </div>
        <div className="flex gap-2">
          <ConnectLocationDialog offices={offices} onSuccess={fetchReviews} />
          <Button
            onClick={() => handleSync()}
            disabled={syncing}
            variant="outline"
          >
            {syncing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync All
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reviews</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unread</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.unread}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Needs Attention</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.needsAttention}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Rating</CardTitle>
            <Star className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgRating}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Reviews</CardTitle>
              <CardDescription>
                Filter and manage reviews from all locations
              </CardDescription>
            </div>
            <Tabs value={filter} onValueChange={setFilter}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="unread">
                  Unread {stats.unread > 0 && <Badge variant="secondary" className="ml-2">{stats.unread}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="needs_attention">
                  Needs Attention {stats.needsAttention > 0 && <Badge variant="destructive" className="ml-2">{stats.needsAttention}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="unreplied">Unreplied</TabsTrigger>
                <TabsTrigger value="replied">Replied</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No reviews yet</h3>
              <p className="text-muted-foreground">
                Connect your Google Business locations to start syncing reviews
              </p>
              <ConnectLocationDialog offices={offices} onSuccess={fetchReviews} />
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <ReviewMagicCard
                  key={review.id}
                  review={review}
                  onUpdate={fetchReviews}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
