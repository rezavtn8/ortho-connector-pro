import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
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
  Calendar,
  User
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
  const [reviews, setReviews] = useState<ReviewWithStatus[]>([]);
  const [filteredReviews, setFilteredReviews] = useState<ReviewWithStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [placeId, setPlaceId] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    needsAttention: 0,
    averageRating: 0
  });

  useEffect(() => {
    loadUserPlaceId();
  }, [user]);

  useEffect(() => {
    filterAndSortReviews();
  }, [reviews, searchQuery, filterStatus, sortBy]);

  const loadUserPlaceId = async () => {
    if (!user?.id) return;

    try {
      const { data: sources } = await supabase
        .from('patient_sources')
        .select('google_place_id')
        .eq('created_by', user.id)
        .not('google_place_id', 'is', null)
        .limit(1)
        .single();

      if (sources?.google_place_id) {
        setPlaceId(sources.google_place_id);
        await fetchReviews(sources.google_place_id);
      }
    } catch (error) {
      console.error('Error loading place ID:', error);
    }
  };

  const fetchReviews = async (targetPlaceId?: string) => {
    const currentPlaceId = targetPlaceId || placeId;
    if (!currentPlaceId) {
      toast({
        title: 'No Place ID Found',
        description: 'Please add a Google Place ID to one of your patient sources first.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Fetch Google reviews
      const response = await supabase.functions.invoke('get-google-reviews', {
        body: { place_id: currentPlaceId }
      });

      if (response.error) throw response.error;
      
      const googleReviews: GoogleReview[] = response.data.reviews || [];

      // Fetch existing review statuses
      const { data: reviewStatuses } = await supabase
        .from('review_status')
        .select('*')
        .eq('place_id', currentPlaceId)
        .eq('user_id', user?.id);

      // Merge Google reviews with status data
      const reviewsWithStatus: ReviewWithStatus[] = googleReviews.map(review => {
        const statusData = reviewStatuses?.find(
          status => status.google_review_id === review.google_review_id
        );

        return {
          ...review,
          status_data: statusData
        };
      });

      setReviews(reviewsWithStatus);

      // Calculate stats
      const needsAttention = reviewsWithStatus.filter(review => 
        review.rating <= 3 || review.status_data?.needs_attention || 
        review.status_data?.status === 'unreplied'
      ).length;

      const averageRating = reviewsWithStatus.reduce((sum, review) => sum + review.rating, 0) / reviewsWithStatus.length;

      setStats({
        total: reviewsWithStatus.length,
        needsAttention,
        averageRating: averageRating || 0
      });

    } catch (error) {
      console.error('Error fetching reviews:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch reviews. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
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
        .upsert(updateData);

      if (error) throw error;

      // Update local state
      setReviews(prev => prev.map(r => 
        r.google_review_id === reviewId 
          ? { ...r, status_data: { ...updateData, id: r.status_data?.id || '' } as ReviewStatus }
          : r
      ));

      toast({
        title: 'Success',
        description: 'Review status updated successfully',
      });
    } catch (error) {
      console.error('Error updating review status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update review status',
        variant: 'destructive',
      });
    }
  };

  const filterAndSortReviews = () => {
    let filtered = [...reviews];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(review => 
        review.author_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        review.text.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply status filter
    if (filterStatus === 'needs-attention') {
      filtered = filtered.filter(review => 
        review.rating <= 3 || review.status_data?.needs_attention || 
        review.status_data?.status === 'unreplied'
      );
    } else if (filterStatus !== 'all') {
      filtered = filtered.filter(review => review.status_data?.status === filterStatus);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return a.time - b.time;
        case 'rating-high':
          return b.rating - a.rating;
        case 'rating-low':
          return a.rating - b.rating;
        case 'newest':
        default:
          return b.time - a.time;
      }
    });

    setFilteredReviews(filtered);
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
        }`}
      />
    ));
  };

  const getStatusIcon = (review: ReviewWithStatus) => {
    const status = review.status_data?.status;
    const needsAttention = review.rating <= 3 || review.status_data?.needs_attention;

    if (needsAttention) {
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }

    switch (status) {
      case 'handled':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'follow-up':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <MessageSquare className="h-4 w-4 text-blue-500" />;
    }
  };

  const getStatusBadge = (review: ReviewWithStatus) => {
    const status = review.status_data?.status || 'new';
    const needsAttention = review.rating <= 3 || review.status_data?.needs_attention;

    if (needsAttention) {
      return <Badge variant="destructive">Needs Attention</Badge>;
    }

    switch (status) {
      case 'handled':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Handled</Badge>;
      case 'follow-up':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Follow-up</Badge>;
      case 'unreplied':
        return <Badge variant="destructive">Unreplied</Badge>;
      default:
        return <Badge variant="outline">New</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Reviews</h2>
          <p className="text-muted-foreground">Manage and respond to Google reviews</p>
        </div>
        <Button onClick={() => fetchReviews()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh Reviews
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <MessageSquare className="h-8 w-8 text-blue-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Reviews</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-red-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Needs Attention</p>
                <p className="text-2xl font-bold">{stats.needsAttention}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-green-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Average Rating</p>
                <div className="flex items-center">
                  <p className="text-2xl font-bold mr-2">{stats.averageRating.toFixed(1)}</p>
                  <div className="flex">{renderStars(Math.round(stats.averageRating))}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search reviews by reviewer name or content..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full md:w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
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
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="rating-high">Highest Rating</SelectItem>
                <SelectItem value="rating-low">Lowest Rating</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Reviews List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin" />
        </div>
      ) : filteredReviews.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Reviews Found</h3>
            <p className="text-muted-foreground">
              {reviews.length === 0 
                ? "No reviews available. Make sure you have a Google Place ID configured."
                : "No reviews match your current filters."
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredReviews.map((review) => (
            <Card key={review.google_review_id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={review.profile_photo_url} alt={review.author_name} />
                      <AvatarFallback>
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{review.author_name}</p>
                        {getStatusIcon(review)}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex">{renderStars(review.rating)}</div>
                        <span className="text-sm text-muted-foreground">•</span>
                        <span className="text-sm text-muted-foreground">
                          {review.relative_time_description}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {getStatusBadge(review)}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`https://search.google.com/local/reviews?placeid=${placeId}`, '_blank')}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Reply on Google
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <p className="text-sm mb-4 leading-relaxed">{review.text}</p>
                
                <Separator className="my-4" />
                
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={review.status_data?.status === 'handled' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateReviewStatus(review.google_review_id, 'handled')}
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Mark as Handled
                  </Button>
                  
                  <Button
                    variant={review.status_data?.status === 'follow-up' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateReviewStatus(review.google_review_id, 'follow-up')}
                  >
                    <Clock className="h-3 w-3 mr-1" />
                    Follow-up Needed
                  </Button>
                  
                  <Button
                    variant={review.status_data?.status === 'unreplied' ? 'destructive' : 'outline'}
                    size="sm"
                    onClick={() => updateReviewStatus(review.google_review_id, 'unreplied', true)}
                  >
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Mark as Unreplied
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}