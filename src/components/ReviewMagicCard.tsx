import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, Send, Sparkles, Check, Edit2, Bot } from "lucide-react";
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
  const [isEditing, setIsEditing] = useState(false);
  
  // Track AI generation
  const [isAIGenerated, setIsAIGenerated] = useState(false);
  const [aiContentId, setAiContentId] = useState<string | null>(null);

  const renderStars = (rating: number) => {
    return [...Array(5)].map((_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < rating ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground/30"
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
      
      const { data, error } = await supabase.functions.invoke('post-google-business-reply', {
        body: {
          review_id: review.id,
          reply_text: replyText,
          is_ai_generated: isAIGenerated,
          ai_content_id: aiContentId,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to post reply');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Reply Posted",
        description: isAIGenerated 
          ? "AI-generated reply posted to Google successfully" 
          : "Reply posted to Google successfully",
      });

      // Reset state
      setIsEditing(false);
      setIsAIGenerated(false);
      setAiContentId(null);
      onReplyPosted();
      
    } catch (error: any) {
      console.error('Error posting reply:', error);
      toast({
        title: "Failed to Post Reply",
        description: error.message || "Failed to post reply to Google. Please try again.",
        variant: "destructive",
      });
    } finally {
      setPosting(false);
    }
  };

  const handleAIReply = (generatedReply: string, contentId?: string) => {
    setReplyText(generatedReply);
    setIsAIGenerated(true);
    setAiContentId(contentId || null);
    setShowAIDialog(false);
    
    toast({
      title: "AI Reply Generated",
      description: "Review and edit if needed, then click Post to send to Google.",
    });
  };

  const handleEditReply = () => {
    setIsEditing(true);
    setReplyText(review.review_reply || "");
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setReplyText(review.review_reply || "");
    setIsAIGenerated(false);
    setAiContentId(null);
  };

  const hasExistingReply = !!review.review_reply && !isEditing;
  const showReplyForm = !hasExistingReply || isEditing;

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={review.author_profile_url} />
                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                  {review.author_name?.[0]?.toUpperCase() || '?'}
                </AvatarFallback>
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
            <div className="flex flex-wrap gap-2 justify-end">
              {!review.review_reply && (
                <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50">
                  Unreplied
                </Badge>
              )}
              {review.needs_attention && (
                <Badge variant="destructive">
                  Needs Attention
                </Badge>
              )}
              {review.review_reply && !isEditing && (
                <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
                  <Check className="h-3 w-3 mr-1" />
                  Replied
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Review Text */}
          {review.review_text ? (
            <p className="text-sm leading-relaxed">{review.review_text}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No review text (rating only)
            </p>
          )}

          {/* Reply Form or Existing Reply */}
          {showReplyForm ? (
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Your Reply</label>
                  {isAIGenerated && (
                    <Badge variant="secondary" className="text-xs">
                      <Bot className="h-3 w-3 mr-1" />
                      AI Generated
                    </Badge>
                  )}
                </div>
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
                onChange={(e) => {
                  setReplyText(e.target.value);
                  // If user edits AI reply, mark as not pure AI
                  if (isAIGenerated && e.target.value !== replyText) {
                    // Keep tracking but note it was edited
                  }
                }}
                className="min-h-[100px] resize-none"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{replyText.length} / 4096 characters</span>
                {replyText.length > 4000 && (
                  <span className="text-orange-600">Approaching limit</span>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-muted/50 p-4 rounded-lg space-y-2 border">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Your Reply:</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleEditReply}
                  className="h-8"
                >
                  <Edit2 className="h-3 w-3 mr-1" />
                  Edit
                </Button>
              </div>
              <p className="text-sm">{review.review_reply}</p>
              {review.review_reply_updated_at && (
                <p className="text-xs text-muted-foreground">
                  Replied on {format(new Date(review.review_reply_updated_at), 'MMM d, yyyy')}
                </p>
              )}
            </div>
          )}
        </CardContent>

        {/* Action Buttons */}
        {showReplyForm && (
          <CardFooter className="flex gap-2 pt-0">
            {isEditing && (
              <Button
                variant="outline"
                onClick={handleCancelEdit}
                className="flex-1"
              >
                Cancel
              </Button>
            )}
            <Button
              onClick={handlePostReply}
              disabled={posting || !replyText.trim()}
              className={isEditing ? "flex-1" : "w-full"}
            >
              <Send className="h-4 w-4 mr-2" />
              {posting ? 'Posting...' : isEditing ? 'Update Reply' : 'Post Reply to Google'}
            </Button>
          </CardFooter>
        )}
      </Card>

      <AIReplyDialog
        open={showAIDialog}
        onOpenChange={(open) => {
          setShowAIDialog(open);
          // Don't clear state when closing - user might have generated something
        }}
        review={review}
        onReplyGenerated={handleAIReply}
      />
    </>
  );
}
