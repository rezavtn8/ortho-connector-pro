import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, Send, Sparkles, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AIReplyDialog } from "./AIReplyDialog";
import { format } from "date-fns";

interface ReviewMagicCardProps {
  review: any;
  onReplyPosted: () => void;
}

export function ReviewMagicCard({ review, onReplyPosted }: ReviewMagicCardProps) {
  const { toast } = useToast();
  const [replyText, setReplyText] = useState(review.review_reply || "");
  const [posting, setPosting] = useState(false);
  const [showAIDialog, setShowAIDialog] = useState(false);

  const renderStars = (rating: number) => {
    return [...Array(5)].map((_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < rating ? "fill-yellow-500 text-yellow-500" : "text-gray-300"
        }`}
      />
    ));
  };

  const handlePostReply = async () => {
    if (!replyText.trim()) {
      toast({
        title: "Error",
        description: "Please enter a reply",
        variant: "destructive",
      });
      return;
    }

    try {
      setPosting(true);
      const { error } = await supabase.functions.invoke('post-google-business-reply', {
        body: {
          review_id: review.id,
          reply_text: replyText,
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Reply posted to Google",
      });

      onReplyPosted();
    } catch (error: any) {
      console.error('Error posting reply:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to post reply",
        variant: "destructive",
      });
    } finally {
      setPosting(false);
    }
  };

  const handleAIReply = (generatedReply: string) => {
    setReplyText(generatedReply);
    setShowAIDialog(false);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src={review.author_profile_url} />
                <AvatarFallback>{review.author_name?.[0] || '?'}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{review.author_name || 'Anonymous'}</p>
                <div className="flex items-center gap-2">
                  <div className="flex">{renderStars(review.rating)}</div>
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(review.posted_at), 'MMM d, yyyy')}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {!review.review_reply && (
                <Badge variant="outline" className="text-orange-500 border-orange-500">
                  Unreplied
                </Badge>
              )}
              {review.needs_attention && (
                <Badge variant="destructive">
                  Needs Attention
                </Badge>
              )}
              {review.review_reply && (
                <Badge variant="outline" className="text-green-500 border-green-500">
                  <Check className="h-3 w-3 mr-1" />
                  Replied
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {review.review_text && (
            <p className="text-sm">{review.review_text}</p>
          )}

          {!review.review_reply ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Your Reply</label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAIDialog(true)}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate AI Reply
                </Button>
              </div>
              <Textarea
                placeholder="Write your reply..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          ) : (
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p className="text-sm font-medium">Your Reply:</p>
              <p className="text-sm">{review.review_reply}</p>
              {review.review_reply_updated_at && (
                <p className="text-xs text-muted-foreground">
                  Replied on {format(new Date(review.review_reply_updated_at), 'MMM d, yyyy')}
                </p>
              )}
            </div>
          )}
        </CardContent>

        {!review.review_reply && (
          <CardFooter>
            <Button
              onClick={handlePostReply}
              disabled={posting || !replyText.trim()}
              className="w-full"
            >
              <Send className="h-4 w-4 mr-2" />
              {posting ? 'Posting...' : 'Post Reply to Google'}
            </Button>
          </CardFooter>
        )}
      </Card>

      <AIReplyDialog
        open={showAIDialog}
        onOpenChange={setShowAIDialog}
        review={review}
        onReplyGenerated={handleAIReply}
      />
    </>
  );
}
