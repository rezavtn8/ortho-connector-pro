import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useOfficeEmails, exportEmailsToCSV, OfficeEmail } from '@/hooks/useOfficeEmails';
import { useOfficeContacts } from '@/hooks/useOfficeContacts';
import { OfficeEmailComposer } from '@/components/OfficeEmailComposer';
import { 
  Mail, 
  Plus, 
  Download, 
  Sparkles, 
  Eye, 
  Trash2, 
  Copy, 
  CheckCircle2,
  Clock,
  Send,
  Edit
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface OfficeEmailsSectionProps {
  officeId: string;
  officeName: string;
  officeEmail?: string | null;
}

const EMAIL_TYPE_LABELS: Record<string, string> = {
  outreach: 'Outreach',
  follow_up: 'Follow-Up',
  thank_you: 'Thank You',
  re_engagement: 'Re-engagement',
  holiday: 'Holiday',
  custom: 'Custom',
};

export function OfficeEmailsSection({ officeId, officeName, officeEmail }: OfficeEmailsSectionProps) {
  const { emails, isLoading, deleteEmail, markAsSent } = useOfficeEmails(officeId);
  const { contacts, primaryContact } = useOfficeContacts(officeId);
  const { toast } = useToast();

  const [showComposer, setShowComposer] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<OfficeEmail | null>(null);
  const [viewingEmail, setViewingEmail] = useState<OfficeEmail | null>(null);
  const [emailToDelete, setEmailToDelete] = useState<string | null>(null);

  const handleCopyToClipboard = async (email: OfficeEmail) => {
    const content = `Subject: ${email.subject}\n\n${email.body}`;
    await navigator.clipboard.writeText(content);
    toast({
      title: 'Copied to clipboard',
      description: 'Email content has been copied.',
    });
  };

  const handleOpenInEmail = (email: OfficeEmail) => {
    const recipientEmail = email.recipient_email || primaryContact?.email || officeEmail || '';
    const subject = encodeURIComponent(email.subject);
    const body = encodeURIComponent(email.body);
    window.open(`mailto:${recipientEmail}?subject=${subject}&body=${body}`, '_blank');
  };

  const handleExport = () => {
    if (emails.length === 0) {
      toast({
        title: 'No emails to export',
        description: 'There are no emails to export yet.',
        variant: 'destructive',
      });
      return;
    }
    exportEmailsToCSV(emails, officeName);
    toast({
      title: 'Export complete',
      description: `Exported ${emails.length} emails to CSV.`,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Sent</Badge>;
      case 'replied':
        return <Badge variant="default" className="bg-blue-500"><Mail className="w-3 h-3 mr-1" />Replied</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Draft</Badge>;
    }
  };

  const handleConfirmDelete = () => {
    if (emailToDelete) {
      deleteEmail(emailToDelete);
      setEmailToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <div className="animate-pulse">Loading emails...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Email History</h3>
          <Badge variant="outline">{emails.length}</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={emails.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button size="sm" onClick={() => { setSelectedEmail(null); setShowComposer(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Compose
          </Button>
        </div>
      </div>

      {/* Email List */}
      {emails.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground mb-4">No emails yet</p>
            <Button onClick={() => { setSelectedEmail(null); setShowComposer(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Compose First Email
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {emails.map((email) => (
            <Card key={email.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(email.created_at), 'MMM d, yyyy')}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {EMAIL_TYPE_LABELS[email.email_type] || email.email_type}
                      </Badge>
                      {getStatusBadge(email.status)}
                      {email.is_ai_generated && (
                        <Badge variant="secondary" className="text-xs">
                          <Sparkles className="w-3 h-3 mr-1" />
                          AI
                        </Badge>
                      )}
                    </div>
                    <h4 className="font-medium truncate">{email.subject}</h4>
                    {email.recipient_email && (
                      <p className="text-sm text-muted-foreground">To: {email.recipient_email}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setViewingEmail(email)}
                      title="View"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCopyToClipboard(email)}
                      title="Copy"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    {email.status === 'draft' && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setSelectedEmail(email); setShowComposer(true); }}
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenInEmail(email)}
                          title="Open in email app"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEmailToDelete(email.id)}
                          title="Delete"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {email.status === 'draft' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => markAsSent(email.id)}
                      >
                        Mark Sent
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Email Composer Dialog */}
      <OfficeEmailComposer
        open={showComposer}
        onOpenChange={setShowComposer}
        officeId={officeId}
        officeName={officeName}
        officeEmail={officeEmail}
        contacts={contacts}
        primaryContact={primaryContact}
        existingEmail={selectedEmail}
      />

      {/* View Email Dialog */}
      {viewingEmail && (
        <AlertDialog open={!!viewingEmail} onOpenChange={() => setViewingEmail(null)}>
          <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                {viewingEmail.subject}
                {viewingEmail.is_ai_generated && (
                  <Badge variant="secondary" className="text-xs">
                    <Sparkles className="w-3 h-3 mr-1" />AI Generated
                  </Badge>
                )}
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-4 text-left">
                  <div className="flex items-center gap-4 text-sm">
                    <span>Date: {format(new Date(viewingEmail.created_at), 'PPP')}</span>
                    {getStatusBadge(viewingEmail.status)}
                    <Badge variant="outline">{EMAIL_TYPE_LABELS[viewingEmail.email_type]}</Badge>
                  </div>
                  {viewingEmail.recipient_email && (
                    <p className="text-sm">To: {viewingEmail.recipient_email}</p>
                  )}
                  <div className="border rounded-lg p-4 bg-muted/30 whitespace-pre-wrap text-foreground">
                    {viewingEmail.body}
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => handleCopyToClipboard(viewingEmail)}>
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </AlertDialogAction>
              <AlertDialogAction onClick={() => handleOpenInEmail(viewingEmail)}>
                <Send className="h-4 w-4 mr-2" />
                Open in Email App
              </AlertDialogAction>
              <AlertDialogCancel>Close</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!emailToDelete} onOpenChange={() => setEmailToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Email?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the email draft.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
