import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Link as LinkIcon, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ConnectLocationDialogProps {
  clinicId: string;
  onConnected: () => void;
}

export function ConnectLocationDialog({ clinicId, onConnected }: ConnectLocationDialogProps) {
  const { toast } = useToast();
  const [connecting, setConnecting] = useState(false);
  const [open, setOpen] = useState(false);

  const handleConnect = async () => {
    try {
      setConnecting(true);

      // Initiate OAuth flow - uses direct Supabase callback for simplicity
      const { data, error } = await supabase.functions.invoke('google-business-oauth-init', {
        body: {
          // Pass site_origin so callback knows where to redirect on success
          site_origin: window.location.origin,
        },
      });

      if (error) throw error;

      if (data?.authorization_url) {
        // Redirect to Google OAuth
        window.location.href = data.authorization_url;
      }
    } catch (error: any) {
      console.error('Error connecting Google Business:', error);
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to start Google Business connection",
        variant: "destructive",
      });
      setConnecting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg">
          <LinkIcon className="mr-2 h-5 w-5" />
          Connect Google Business Profile
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect Google Business Profile</DialogTitle>
          <DialogDescription>
            Connect your Google Business Profile to sync and manage reviews directly from Nexora
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You'll be redirected to Google to authorize access to your Business Profile.
              Make sure you're signed in with the Google account that manages your business.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <h4 className="font-medium">What you'll be able to do:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>View all your Google reviews in one place</li>
              <li>Respond to reviews directly from Nexora</li>
              <li>Generate AI-powered reply suggestions</li>
              <li>Track review analytics and trends</li>
              <li>Automatic review syncing</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Permissions requested:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>View and manage your Google Business Profile</li>
              <li>Read and respond to reviews</li>
              <li>Basic profile information</li>
            </ul>
          </div>

          <Button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full"
            size="lg"
          >
            {connecting ? 'Connecting...' : 'Continue to Google'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
