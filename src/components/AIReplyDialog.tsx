import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, RefreshCw, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Star } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AIReplyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  review: any;
  onReplyGenerated: (reply: string, contentId?: string) => void;
}

export function AIReplyDialog({ open, onOpenChange, review, onReplyGenerated }: AIReplyDialogProps) {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [generatedReply, setGeneratedReply] = useState("");
  const [aiContentId, setAiContentId] = useState<string | null>(null);
  const [tone, setTone] = useState("professional");
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setGeneratedReply("");
      setAiContentId(null);
      setError(null);
      // Set default tone based on rating
      if (review.rating <= 2) {
        setTone("apologetic");
      } else if (review.rating === 5) {
        setTone("enthusiastic");
      } else {
        setTone("professional");
      }
    }
  }, [open, review.rating]);

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

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      setError(null);

      // Fetch AI settings
      const { data: aiSettings } = await supabase
        .from('ai_business_profiles')
        .select('*')
        .maybeSingle();

      // Fetch user profile with clinic info
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('clinic_id, first_name, last_name, job_title, clinics(name)')
        .eq('user_id', user.id)
        .single();

      const clinicName = (userProfile as any)?.clinics?.name || 'Our Practice';
      const responderName = userProfile?.first_name 
        ? `${userProfile.first_name}${userProfile.last_name ? ' ' + userProfile.last_name : ''}`
        : null;

      // Build context for AI
      const context = {
        review_text: review.review_text || '',
        reviewer_name: review.author_name || 'Valued Patient',
        rating: review.rating,
        practice_name: clinicName,
        responder_name: responderName,
        responder_title: userProfile?.job_title,
      };

      // Call AI assistant
      const { data, error: aiError } = await supabase.functions.invoke('ai-assistant', {
        body: {
          task_type: 'review_response',
          ai_settings: aiSettings,
          context,
          parameters: {
            tone,
            rating: review.rating,
          },
        },
      });

      if (aiError) {
        throw new Error(aiError.message || 'AI generation failed');
      }

      const reply = data?.content || data?.response || '';
      
      if (!reply) {
        throw new Error('No reply generated. Please try again.');
      }

      setGeneratedReply(reply);

      // Store generated content and get ID
      const { data: contentData, error: insertError } = await supabase
        .from('ai_generated_content')
        .insert({
          user_id: user.id,
          content_type: 'review_response',
          reference_id: review.id,
          generated_text: reply,
          status: 'generated',
          metadata: { 
            tone, 
            rating: review.rating,
            reviewer_name: review.author_name,
            clinic_name: clinicName,
          },
        })
        .select('id')
        .single();

      if (!insertError && contentData) {
        setAiContentId(contentData.id);
      }

    } catch (error: any) {
      console.error('Error generating reply:', error);
      setError(error.message || 'Failed to generate AI reply');
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate AI reply. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleUseReply = () => {
    if (generatedReply.trim()) {
      onReplyGenerated(generatedReply, aiContentId || undefined);
      onOpenChange(false);
    }
  };

  const getToneDescription = (toneValue: string) => {
    const descriptions: Record<string, string> = {
      professional: "Formal and business-like",
      friendly: "Warm and personable",
      apologetic: "Understanding and empathetic (recommended for low ratings)",
      enthusiastic: "Upbeat and grateful (great for 5-star reviews)",
    };
    return descriptions[toneValue] || "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Reply Generator
          </DialogTitle>
          <DialogDescription>
            Generate a personalized reply to this review using AI
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Review Preview */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-2 border">
            <div className="flex items-center justify-between">
              <p className="font-medium">{review.author_name || 'Anonymous'}</p>
              <div className="flex">{renderStars(review.rating)}</div>
            </div>
            {review.review_text ? (
              <p className="text-sm text-muted-foreground">{review.review_text}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">No review text (rating only)</p>
            )}
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Tone Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Reply Tone</label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">
                  <div className="flex flex-col items-start">
                    <span>Professional</span>
                  </div>
                </SelectItem>
                <SelectItem value="friendly">
                  <div className="flex flex-col items-start">
                    <span>Friendly</span>
                  </div>
                </SelectItem>
                <SelectItem value="apologetic">
                  <div className="flex flex-col items-start">
                    <span>Apologetic</span>
                  </div>
                </SelectItem>
                <SelectItem value="enthusiastic">
                  <div className="flex flex-col items-start">
                    <span>Enthusiastic</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{getToneDescription(tone)}</p>
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
                className="min-h-[150px] resize-none"
                placeholder="Generated reply will appear here..."
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{generatedReply.length} / 4096 characters</span>
                {generatedReply.length > 4000 && (
                  <span className="text-orange-600">Approaching limit</span>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {generatedReply && (
            <div className="flex gap-2 pt-2">
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
                disabled={!generatedReply.trim()}
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
