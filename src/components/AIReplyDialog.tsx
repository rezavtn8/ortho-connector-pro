import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Send, Loader2, RefreshCw } from "lucide-react";

interface AIReplyDialogProps {
  review: any;
  onSuccess: () => void;
}

export function AIReplyDialog({ review, onSuccess }: AIReplyDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [tone, setTone] = useState("professional");
  const [aiContentId, setAiContentId] = useState<string | null>(null);

  const handleGenerateReply = async () => {
    try {
      setGenerating(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          task_type: 'review_response',
          context: {
            review_text: review.review_text,
            rating: review.rating,
            reviewer_name: review.author_name,
            office_name: review.patient_sources?.name,
          },
          parameters: {
            tone: tone,
          },
        },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;

      const generatedContent = data.content;
      setReplyText(generatedContent);
      
      // Store in ai_generated_content table
      const { data: contentRecord, error: contentError } = await (supabase as any)
        .from('ai_generated_content')
        .insert({
          user_id: session?.user?.id,
          content_type: 'review_response',
          generated_text: generatedContent,
          reference_id: review.id,
          metadata: {
            review_rating: review.rating,
            tone: tone,
            tokens_used: data.usage?.tokens_used || 0,
          },
        })
        .select()
        .single();

      if (!contentError && contentRecord) {
        setAiContentId(contentRecord.id);
      }
      
      toast({
        title: "Reply Generated",
        description: "AI has generated a reply for this review",
      });
    } catch (error) {
      console.error('Error generating reply:', error);
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim()) {
      toast({
        title: "Error",
        description: "Reply text cannot be empty",
        variant: "destructive",
      });
      return;
    }

    try {
      setSending(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      const { error } = await supabase.functions.invoke('post-google-business-reply', {
        body: {
          review_id: review.id,
          reply_text: replyText,
          ai_content_id: aiContentId,
        },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;

      toast({
        title: "Reply Sent",
        description: "Your reply has been posted to Google",
      });
      
      setOpen(false);
      onSuccess();
    } catch (error) {
      console.error('Error sending reply:', error);
      toast({
        title: "Failed to Send",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Sparkles className="mr-2 h-4 w-4" />
          Reply with AI
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>AI-Assisted Reply</DialogTitle>
          <DialogDescription>
            Generate a professional reply to this review using AI
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm font-semibold mb-2">{review.author_name}</p>
            <p className="text-sm">{review.review_text || "No review text"}</p>
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              Rating: {review.rating}/5
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tone</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="friendly">Friendly</SelectItem>
                <SelectItem value="apologetic">Apologetic</SelectItem>
                <SelectItem value="grateful">Grateful</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Reply</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateReply}
                disabled={generating}
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {replyText ? "Regenerate" : "Generate"}
                  </>
                )}
              </Button>
            </div>
            <Textarea
              placeholder="Click 'Generate' to create an AI reply, or write your own..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={6}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSendReply} disabled={sending || !replyText.trim()}>
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send to Google
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
