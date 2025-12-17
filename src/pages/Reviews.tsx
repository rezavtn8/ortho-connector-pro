import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useOptimizedArray } from '@/hooks/useOptimizedState';
import { useGoogleReviews } from '@/hooks/useGoogleMapsApi';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Star,
  Search,
  Filter,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  MessageSquare,
  TrendingUp,
  User,
  Bot,
  Sparkles,
  Copy,
  AlertCircle,
  Info
} from 'lucide-react';

interface GoogleReview {
  google_review_id: string;
  place_id: string;
  author_name: string;
  author_url?: string;
  profile_photo_url?: string;
  rating: number;
  relative_time_description: string;
  text: string;
  time: number;
  language?: string;
}

interface ReviewStatus {
  id: string;
  google_review_id: string;
  status: string;
  needs_attention: boolean;
  notes?: string;
}

interface ReviewWithStatus extends GoogleReview {
  status_data?: ReviewStatus;
}

export function Reviews() {
  const { user } = useAuth();
  const { 
    array: reviews, 
    replaceArray: setReviews 
  } = useOptimizedArray<ReviewWithStatus>();
  
  const [filteredReviews, setFilteredReviews] = useState<ReviewWithStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [placeId, setPlaceId] = useState('');
  const [aiResponseDialog, setAiResponseDialog] = useState<{
    isOpen: boolean;
    content: string;
    reviewId: string;
    loading: boolean;
  }>({ isOpen: false, content: '', reviewId: '', loading: false });

  const { fetchReviews: fetchGoogleReviews } = useGoogleReviews();

  useEffect(() => {
    loadUserPlaceId();
  }, [user]);

  useEffect(() => {
    filterAndSortReviews();
  }, [reviews, searchQuery, filterStatus, sortBy]);

  const reviewStats = useMemo(() => {
    if (reviews.length === 0) {
      return { total: 0, needsAttention: 0, averageRating: 0, handled: 0 };
    }

    const needsAttention = reviews.filter(review => 
      review.rating <= 3 || review.status_data?.needs_attention || 
      review.status_data?.status === 'unreplied'
    ).length;

    const handled = reviews.filter(review => review.status_data?.status === 'handled').length;
    const averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;

    return {
      total: reviews.length,
      needsAttention,
      handled,
      averageRating: averageRating || 0
    };
  }, [reviews]);

  const loadUserPlaceId = async () => {
    if (!user?.id) return;

    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('clinic_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.clinic_id) {
        toast({
          title: 'No Clinic Found',
          description: 'Please set up your clinic information in Settings first.',
          variant: 'destructive',
        });
        return;
      }

      const { data: clinic } = await supabase
        .from('clinics')
        .select('google_place_id, name')
        .eq('id', profile.clinic_id)
        .single();

      if (!clinic?.google_place_id) {
        toast({
          title: 'Google Place ID Required',
          description: 'Please add your clinic\'s Google Place ID in Settings to view reviews.',
          variant: 'destructive',
        });
        return;
      }

      setPlaceId(clinic.google_place_id);
      await fetchReviews(clinic.google_place_id);
    } catch (error) {
      console.error('Error loading clinic info:', error);
      toast({
        title: 'Setup Required',
        description: 'Please complete your clinic setup in Settings to view reviews.',
        variant: 'destructive',
      });
    }
  };

  const fetchReviews = async (targetPlaceId?: string) => {
    const currentPlaceId = targetPlaceId || placeId;
    if (!currentPlaceId) {
      toast({
        title: 'No Place ID Found',
        description: 'Please add a Google Place ID to view reviews.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const reviewData = await fetchGoogleReviews(currentPlaceId);
      const googleReviews: GoogleReview[] = reviewData.reviews || [];

      const { data: reviewStatuses } = await supabase
        .from('review_status')
        .select('*')
        .eq('place_id', currentPlaceId)
        .eq('user_id', user?.id);

      const reviewsWithStatus: ReviewWithStatus[] = googleReviews.map(review => {
        const statusData = reviewStatuses?.find(
          status => status.google_review_id === review.google_review_id
        );
        return { ...review, status_data: statusData };
      });

      setReviews(reviewsWithStatus);
    } catch (error: any) {
      console.error('Reviews: Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateAIResponse = async (reviewId: string) => {
    if (!user?.id) return;

    const review = reviews.find(r => r.google_review_id === reviewId);
    if (!review) return;

    setAiResponseDialog({ isOpen: true, content: '', reviewId, loading: true });

    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          task_type: 'review_response',
          context: {
            google_review_id: reviewId,
            reviewer_name: review.author_name,
            rating: review.rating,
            review_text: review.text,
            review_date: review.relative_time_description,
          },
          parameters: { tone: 'professional and appreciative' }
        },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;

      setAiResponseDialog(prev => ({ ...prev, content: data.content, loading: false }));

      toast({
        title: 'AI Response Generated',
        description: 'Review response has been generated successfully.',
      });

      return data.content;
    } catch (error: any) {
      console.error('Error generating AI response:', error);
      setAiResponseDialog(prev => ({ ...prev, loading: false }));
      toast({
        title: 'Error',
        description: 'Failed to generate AI response',
        variant: 'destructive',
      });
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copied!', description: 'Response copied to clipboard' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to copy to clipboard', variant: 'destructive' });
    }
  };

  const updateReviewStatus = async (reviewId: string, status: string, needsAttention?: boolean, notes?: string) => {
    if (!user?.id) return;

    const review = reviews.find(r => r.google_review_id === reviewId);
    if (!review) return;

    try {
      const updateData = {
        google_review_id: reviewId,
        place_id: review.place_id,
        user_id: user.id,
        status,
        needs_attention: needsAttention !== undefined ? needsAttention : review.rating <= 3,
        notes
      };

      const { error } = await supabase
        .from('review_status')
        .upsert(updateData, { onConflict: 'google_review_id,user_id' });

      if (error) throw error;

      setReviews(reviews.map(r => 
        r.google_review_id === reviewId 
          ? { ...r, status_data: { ...updateData, id: r.status_data?.id || '' } as ReviewStatus }
          : r
      ));

      toast({ title: 'Success', description: 'Review status updated successfully' });
    } catch (error) {
      console.error('Error updating review status:', error);
      toast({ title: 'Error', description: 'Failed to update review status', variant: 'destructive' });
    }
  };

  const filterAndSortReviews = useCallback(() => {
    let filtered = [...reviews];

    if (searchQuery) {
      filtered = filtered.filter(review => 
        review.author_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        review.text.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (filterStatus === 'needs-attention') {
      filtered = filtered.filter(review => 
        review.rating <= 3 || review.status_data?.needs_attention || 
        review.status_data?.status === 'unreplied'
      );
    } else if (filterStatus !== 'all') {
      filtered = filtered.filter(review => review.status_data?.status === filterStatus);
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'oldest': return a.time - b.time;
        case 'rating-high': return b.rating - a.rating;
        case 'rating-low': return a.rating - b.rating;
        default: return b.time - a.time;
      }
    });

    setFilteredReviews(filtered);
  }, [reviews, searchQuery, filterStatus, sortBy]);

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i < rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`}
        />
      ))}
    </div>
  );

  const getStatusBadge = (review: ReviewWithStatus) => {
    const status = review.status_data?.status || 'new';
    const needsAttention = review.rating <= 3 || review.status_data?.needs_attention;

    if (needsAttention) {
      return <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" />Needs Attention</Badge>;
    }

    switch (status) {
      case 'handled':
        return <Badge className="gap-1 bg-success/10 text-success border-success/20"><CheckCircle className="w-3 h-3" />Handled</Badge>;
      case 'follow-up':
        return <Badge className="gap-1 bg-warning/10 text-warning border-warning/20"><Clock className="w-3 h-3" />Follow-up</Badge>;
      case 'unreplied':
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="w-3 h-3" />Unreplied</Badge>;
      default:
        return <Badge variant="outline" className="gap-1"><MessageSquare className="w-3 h-3" />New</Badge>;
    }
  };

  if (loading && reviews.length === 0) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-16 w-full rounded-lg" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-32 mb-2" />
                    <Skeleton className="h-4 w-24 mb-3" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Reviews</p>
                <p className="text-2xl font-bold mt-1">{reviewStats.total}</p>
              </div>
              <div className="p-2 bg-primary/10 rounded-lg">
                <MessageSquare className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Needs Attention</p>
                <p className="text-2xl font-bold mt-1">{reviewStats.needsAttention}</p>
              </div>
              <div className="p-2 bg-destructive/10 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Handled</p>
                <p className="text-2xl font-bold mt-1">{reviewStats.handled}</p>
              </div>
              <div className="p-2 bg-success/10 rounded-lg">
                <CheckCircle className="w-5 h-5 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Avg Rating</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-2xl font-bold">{reviewStats.averageRating.toFixed(1)}</p>
                  <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                </div>
              </div>
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <TrendingUp className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* API Notice */}
      <Card className="border-warning/30 bg-warning/5">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-warning">Limited Review Data</p>
            <p className="text-xs text-muted-foreground mt-1">
              Google Places API returns only the 5 most helpful reviews. Full review management with Google My Business API integration coming soon.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Filters Section */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search reviews..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full md:w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">All Reviews</SelectItem>
                <SelectItem value="needs-attention">Needs Attention</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="handled">Handled</SelectItem>
                <SelectItem value="follow-up">Follow-up</SelectItem>
                <SelectItem value="unreplied">Unreplied</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="rating-high">Highest Rating</SelectItem>
                <SelectItem value="rating-low">Lowest Rating</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={() => fetchReviews()} disabled={loading || !placeId} variant="outline" className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reviews List */}
      {!placeId ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <MessageSquare className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="font-medium mb-1">Clinic Setup Required</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add your Google Place ID in Settings to view reviews.
            </p>
            <Button onClick={() => window.location.hash = 'settings'}>Go to Settings</Button>
          </CardContent>
        </Card>
      ) : filteredReviews.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <MessageSquare className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="font-medium mb-1">No Reviews Found</h3>
            <p className="text-sm text-muted-foreground">
              {reviews.length === 0 
                ? "No reviews available for this location."
                : "No reviews match your current filters."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredReviews.map((review) => (
            <Card key={review.google_review_id} className="group hover:shadow-lg transition-all duration-200 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-4 sm:p-6 relative">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={review.profile_photo_url} alt={review.author_name} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div>
                        <p className="font-semibold">{review.author_name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {renderStars(review.rating)}
                          <span className="text-sm text-muted-foreground">•</span>
                          <span className="text-sm text-muted-foreground">{review.relative_time_description}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(review)}
                      </div>
                    </div>
                    
                    <p className="text-sm leading-relaxed mb-4">{review.text}</p>
                    
                    <Separator className="my-4" />
                    
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => generateAIResponse(review.google_review_id)}
                        className="gap-1.5 bg-gradient-to-r from-primary to-primary/80"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        AI Response
                      </Button>

                      <Button
                        variant={review.status_data?.status === 'handled' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => updateReviewStatus(review.google_review_id, 'handled')}
                        className="gap-1.5"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        Handled
                      </Button>
                      
                      <Button
                        variant={review.status_data?.status === 'follow-up' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => updateReviewStatus(review.google_review_id, 'follow-up')}
                        className="gap-1.5"
                      >
                        <Clock className="h-3.5 w-3.5" />
                        Follow-up
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`https://search.google.com/local/reviews?placeid=${placeId}`, '_blank')}
                        className="gap-1.5 ml-auto"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Reply on Google
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* AI Response Dialog */}
      <Dialog open={aiResponseDialog.isOpen} onOpenChange={(open) => setAiResponseDialog(prev => ({ ...prev, isOpen: open }))}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              AI-Generated Review Response
            </DialogTitle>
            <DialogDescription>
              Copy this response to use on Google My Business or use it as inspiration.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {aiResponseDialog.loading ? (
              <div className="flex items-center justify-center py-8">
                <Bot className="h-8 w-8 animate-pulse text-primary mr-2" />
                <p className="text-muted-foreground">Generating AI response...</p>
              </div>
            ) : (
              <>
                <div className="border rounded-lg p-4 bg-muted/50">
                  <Textarea
                    value={aiResponseDialog.content}
                    readOnly
                    className="min-h-[120px] resize-none border-0 bg-transparent focus:ring-0"
                    placeholder="AI response will appear here..."
                  />
                </div>
                
                {aiResponseDialog.content && (
                  <div className="flex gap-2">
                    <Button onClick={() => copyToClipboard(aiResponseDialog.content)} className="flex-1 gap-2">
                      <Copy className="h-4 w-4" />
                      Copy Response
                    </Button>
                    <Button variant="outline" onClick={() => generateAIResponse(aiResponseDialog.reviewId)} className="gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Regenerate
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
