import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, MessageSquare, Send, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { AIReplyDialog } from "@/components/AIReplyDialog";

interface ReviewMagicCardProps {
  review: any;
  onUpdate: () => void;
}

export function ReviewMagicCard({ review, onUpdate }: ReviewMagicCardProps) {
  const { toast } = useToast();
  const [markingRead, setMarkingRead] = useState(false);

  const handleMarkRead = async () => {
    try {
      setMarkingRead(true);
      const { error } = await (supabase as any)
        .from('google_reviews')
        .update({ is_read: true })
        .eq('id', review.id);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Review marked as read",
      });
      
      onUpdate();
    } catch (error) {
      console.error('Error marking review as read:', error);
      toast({
        title: "Error",
        description: "Failed to mark review as read",
        variant: "destructive",
      });
    } finally {
      setMarkingRead(false);
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating
                ? "fill-yellow-500 text-yellow-500"
                : "text-muted-foreground"
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <Card className={!review.is_read ? "border-primary" : ""}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={review.author_profile_url} />
              <AvatarFallback>
                {review.author_name?.charAt(0) || "?"}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold">{review.author_name || "Anonymous"}</p>
                {!review.is_read && (
                  <Badge variant="secondary">Unread</Badge>
                )}
                {review.needs_attention && (
                  <Badge variant="destructive">Needs Attention</Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {renderStars(review.rating)}
                <span>•</span>
                <span>{formatDistanceToNow(new Date(review.posted_at))} ago</span>
              </div>
              {review.patient_sources?.name && (
                <p className="text-xs text-muted-foreground mt-1">
                  {review.patient_sources.name}
                </p>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {review.review_text && (
          <p className="text-sm">{review.review_text}</p>
        )}

        {review.review_reply && (
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <MessageSquare className="h-4 w-4" />
              Your Reply
            </div>
            <p className="text-sm">{review.review_reply}</p>
            <p className="text-xs text-muted-foreground">
              Replied {formatDistanceToNow(new Date(review.review_reply_updated_at))} ago
            </p>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex gap-2">
        {!review.is_read && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkRead}
            disabled={markingRead}
          >
            {markingRead ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Mark as Read"
            )}
          </Button>
        )}
        
        {!review.review_reply && (
          <AIReplyDialog review={review} onSuccess={onUpdate} />
        )}
      </CardFooter>
    </Card>
  );
}
