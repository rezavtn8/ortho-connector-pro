import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ReviewReplyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  review: {
    google_review_id: string;
    author_name: string;
    text: string;
    rating: number;
  };
  locationId?: string;
  onReplySuccess: () => void;
}

export function ReviewReplyDialog({
  open,
  onOpenChange,
  review,
  locationId,
  onReplySuccess
}: ReviewReplyDialogProps) {
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!replyText.trim()) {
      toast({
        title: 'Reply Required',
        description: 'Please enter a reply before submitting.',
        variant: 'destructive',
      });
      return;
    }

    if (!locationId) {
      toast({
        title: 'Setup Required',
        description: 'Google My Business integration is not yet configured. Please complete OAuth setup first.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Get stored access token (in a real implementation, this would be securely stored per user)
      const accessToken = localStorage.getItem('google_business_access_token');
      
      if (!accessToken) {
        toast({
          title: 'Authentication Required',
          description: 'Please authenticate with Google My Business first.',
          variant: 'destructive',
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('google-business-profile/reply', {
        body: {
          location_id: locationId,
          review_id: review.google_review_id,
          reply_text: replyText
        },
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to post reply');
      }

      toast({
        title: 'Reply Posted',
        description: 'Your reply has been posted to Google successfully.',
      });

      setReplyText('');
      onOpenChange(false);
      onReplySuccess();

    } catch (error: any) {
      console.error('Error posting reply:', error);
      toast({
        title: 'Reply Failed',
        description: error.message || 'Failed to post reply. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Reply to Review</DialogTitle>
          <DialogDescription>
            Reply to {review.author_name}'s review. Your response will be posted publicly on Google.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Original Review */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-medium">{review.author_name}</span>
              <div className="flex">
                {Array.from({ length: 5 }, (_, i) => (
                  <span
                    key={i}
                    className={`text-sm ${
                      i < review.rating ? 'text-yellow-400' : 'text-gray-300'
                    }`}
                  >
                    ★
                  </span>
                ))}
              </div>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-3">
              {review.text}
            </p>
          </div>

          {/* Reply Form */}
          <div className="space-y-2">
            <Label htmlFor="reply">Your Reply</Label>
            <Textarea
              id="reply"
              placeholder="Thank you for your review! We appreciate your feedback..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="min-h-[120px]"
              maxLength={4096}
            />
            <div className="text-xs text-muted-foreground text-right">
              {replyText.length}/4096 characters
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              <strong>Note:</strong> This feature requires Google My Business API integration with OAuth2 authentication. 
              The reply will be posted publicly and cannot be deleted once submitted.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !replyText.trim()}
          >
            {isSubmitting ? 'Posting Reply...' : 'Post Reply'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}