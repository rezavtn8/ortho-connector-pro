import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Star } from "lucide-react";

interface AIReplyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  review: any;
  onReplyGenerated: (reply: string) => void;
}

export function AIReplyDialog({ open, onOpenChange, review, onReplyGenerated }: AIReplyDialogProps) {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [generatedReply, setGeneratedReply] = useState("");
  const [tone, setTone] = useState("professional");

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

  const handleGenerate = async () => {
    try {
      setGenerating(true);

      // Fetch AI settings
      const { data: aiSettings } = await supabase
        .from('ai_business_profiles')
        .select('*')
        .maybeSingle();

      // Fetch user profile
      const { data: { user } } = await supabase.auth.getUser();
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('clinic_id, clinics(name)')
        .eq('user_id', user?.id)
        .single();

      // Call AI assistant
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          task_type: 'review_response',
          ai_settings: aiSettings,
          context: {
            review_text: review.review_text || '',
            reviewer_name: review.author_name || 'Valued Patient',
            rating: review.rating,
            practice_name: (userProfile as any)?.clinics?.name || 'Our Practice',
          },
          parameters: {
            tone,
          },
        },
      });

      if (error) throw error;

      const reply = data?.content || data?.response || '';
      setGeneratedReply(reply);

      // Store generated content
      await (supabase as any)
        .from('ai_generated_content')
        .insert({
          content_type: 'review_response',
          reference_id: review.id,
          generated_text: reply,
          status: 'generated',
          metadata: { tone, rating: review.rating },
        });

    } catch (error: any) {
      console.error('Error generating reply:', error);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate AI reply",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleUseReply = () => {
    if (generatedReply.trim()) {
      onReplyGenerated(generatedReply);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Reply Generator
          </DialogTitle>
          <DialogDescription>
            Generate a professional reply to this review using AI
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Review Preview */}
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-medium">{review.author_name || 'Anonymous'}</p>
              <div className="flex">{renderStars(review.rating)}</div>
            </div>
            {review.review_text && (
              <p className="text-sm text-muted-foreground">{review.review_text}</p>
            )}
          </div>

          {/* Tone Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Reply Tone</label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="friendly">Friendly</SelectItem>
                <SelectItem value="apologetic">Apologetic</SelectItem>
                <SelectItem value="enthusiastic">Enthusiastic</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Generate Button */}
          {!generatedReply && (
            <Button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full"
              size="lg"
            >
              {generating ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Reply
                </>
              )}
            </Button>
          )}

          {/* Generated Reply */}
          {generatedReply && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Generated Reply</label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleGenerate}
                  disabled={generating}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${generating ? 'animate-spin' : ''}`} />
                  Regenerate
                </Button>
              </div>
              <Textarea
                value={generatedReply}
                onChange={(e) => setGeneratedReply(e.target.value)}
                className="min-h-[150px]"
              />
              <p className="text-xs text-muted-foreground">
                {generatedReply.length} / 4096 characters
              </p>
            </div>
          )}

          {/* Action Buttons */}
          {generatedReply && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUseReply}
                className="flex-1"
              >
                Use This Reply
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
