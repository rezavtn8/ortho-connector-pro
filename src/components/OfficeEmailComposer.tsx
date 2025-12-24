import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useOfficeEmails, EmailType, OfficeEmail } from '@/hooks/useOfficeEmails';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Sparkles, 
  Send, 
  Save, 
  Copy, 
  Loader2,
  Mail
} from 'lucide-react';

interface OfficeContact {
  id: string;
  name: string;
  email?: string | null;
  role?: string | null;
  is_primary?: boolean | null;
}

interface OfficeEmailComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  officeId: string;
  officeName: string;
  officeEmail?: string | null;
  contacts: OfficeContact[];
  primaryContact?: OfficeContact | null;
  existingEmail?: OfficeEmail | null;
}

const EMAIL_TYPES: { value: EmailType; label: string }[] = [
  { value: 'outreach', label: 'Initial Outreach' },
  { value: 'follow_up', label: 'Follow-Up' },
  { value: 'thank_you', label: 'Thank You' },
  { value: 're_engagement', label: 'Re-engagement' },
  { value: 'holiday', label: 'Holiday Greeting' },
  { value: 'custom', label: 'Custom' },
];

const EMAIL_TEMPLATES: Record<EmailType, { subject: string; body: string }> = {
  outreach: {
    subject: 'Partnership Opportunity - [Your Practice Name]',
    body: `Dear [Contact Name],

I hope this email finds you well. I'm reaching out from [Your Practice Name] to explore a potential referral partnership between our practices.

We specialize in [your specialty] and believe our services could complement your patient care. We'd love to discuss how we can work together to better serve patients in our community.

Would you be available for a brief call or meeting to discuss this opportunity?

Best regards,
[Your Name]`,
  },
  follow_up: {
    subject: 'Following Up - [Your Practice Name]',
    body: `Dear [Contact Name],

I wanted to follow up on my previous message and check in to see if you had any questions about a potential partnership.

We remain very interested in collaborating with your practice and would be happy to provide any additional information you might need.

Please feel free to reach out at your convenience.

Best regards,
[Your Name]`,
  },
  thank_you: {
    subject: 'Thank You for the Referrals - [Your Practice Name]',
    body: `Dear [Contact Name],

I wanted to take a moment to personally thank you for the patient referrals you've sent our way recently.

Your trust in our practice means a great deal to us, and we're committed to providing the best possible care for every patient you refer.

If there's ever anything we can do to better serve you or your patients, please don't hesitate to let us know.

With gratitude,
[Your Name]`,
  },
  re_engagement: {
    subject: "Reconnecting - [Your Practice Name]",
    body: `Dear [Contact Name],

It's been a while since we've connected, and I wanted to reach out to see how things are going at your practice.

We've made some exciting updates here at [Your Practice Name] and would love to share them with you. Perhaps we could schedule a brief catch-up call?

Looking forward to reconnecting!

Best regards,
[Your Name]`,
  },
  holiday: {
    subject: 'Season\'s Greetings from [Your Practice Name]',
    body: `Dear [Contact Name],

As we approach the holiday season, I wanted to extend my warmest wishes to you and your team.

Thank you for being a valued partner throughout the year. We're grateful for the trust you've placed in us and look forward to continuing our collaboration in the coming year.

Wishing you a joyful holiday season and a prosperous new year!

Warm regards,
[Your Name]`,
  },
  custom: {
    subject: '',
    body: '',
  },
};

export function OfficeEmailComposer({
  open,
  onOpenChange,
  officeId,
  officeName,
  officeEmail,
  contacts,
  primaryContact,
  existingEmail,
}: OfficeEmailComposerProps) {
  const { addEmail, updateEmail, isAdding, isUpdating } = useOfficeEmails(officeId);
  const { toast } = useToast();

  const [emailType, setEmailType] = useState<EmailType>(existingEmail?.email_type || 'outreach');
  const [recipientEmail, setRecipientEmail] = useState(existingEmail?.recipient_email || primaryContact?.email || officeEmail || '');
  const [subject, setSubject] = useState(existingEmail?.subject || '');
  const [body, setBody] = useState(existingEmail?.body || '');
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [isAIGenerated, setIsAIGenerated] = useState(existingEmail?.is_ai_generated || false);

  // Reset form when dialog opens/closes or email changes
  useEffect(() => {
    if (open) {
      if (existingEmail) {
        setEmailType(existingEmail.email_type);
        setRecipientEmail(existingEmail.recipient_email || '');
        setSubject(existingEmail.subject);
        setBody(existingEmail.body);
        setIsAIGenerated(existingEmail.is_ai_generated);
      } else {
        setEmailType('outreach');
        setRecipientEmail(primaryContact?.email || officeEmail || '');
        setSubject('');
        setBody('');
        setIsAIGenerated(false);
      }
    }
  }, [open, existingEmail, primaryContact, officeEmail]);

  const handleTypeChange = (type: EmailType) => {
    setEmailType(type);
    if (!existingEmail && type !== 'custom') {
      const template = EMAIL_TEMPLATES[type];
      setSubject(template.subject);
      setBody(template.body);
      setIsAIGenerated(false);
    }
  };

  const handleAIGenerate = async () => {
    setIsAIGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const contactName = primaryContact?.name || 'Team';
      
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          task_type: 'email_generation',
          context: {
            office_name: officeName,
            contact_name: contactName,
            email_type: emailType,
          },
          parameters: {
            tone: 'professional',
            length: 'medium',
          },
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.content) {
        // Parse the AI response - expect subject and body
        const lines = data.content.split('\n');
        let newSubject = '';
        let newBody = '';
        let foundSubject = false;
        
        for (const line of lines) {
          if (line.toLowerCase().startsWith('subject:')) {
            newSubject = line.replace(/^subject:\s*/i, '').trim();
            foundSubject = true;
          } else if (foundSubject) {
            newBody += (newBody ? '\n' : '') + line;
          }
        }

        if (newSubject) setSubject(newSubject);
        if (newBody.trim()) setBody(newBody.trim());
        setIsAIGenerated(true);

        toast({
          title: 'Email generated',
          description: 'AI has drafted your email. Feel free to edit it.',
        });
      }
    } catch (error: any) {
      console.error('AI generation error:', error);
      toast({
        title: 'Generation failed',
        description: error.message || 'Failed to generate email with AI',
        variant: 'destructive',
      });
    } finally {
      setIsAIGenerating(false);
    }
  };

  const handleSave = (status: 'draft' | 'sent' = 'draft') => {
    if (!subject.trim() || !body.trim()) {
      toast({
        title: 'Missing fields',
        description: 'Please enter both subject and body.',
        variant: 'destructive',
      });
      return;
    }

    if (existingEmail) {
      updateEmail({
        id: existingEmail.id,
        subject: subject.trim(),
        body: body.trim(),
        email_type: emailType,
        recipient_email: recipientEmail || null,
        status,
        sent_at: status === 'sent' ? new Date().toISOString() : null,
      });
    } else {
      addEmail({
        office_id: officeId,
        subject: subject.trim(),
        body: body.trim(),
        email_type: emailType,
        recipient_email: recipientEmail || null,
        status,
        is_ai_generated: isAIGenerated,
      });
    }

    onOpenChange(false);
  };

  const handleCopyAndOpen = () => {
    const content = `Subject: ${subject}\n\n${body}`;
    navigator.clipboard.writeText(content);
    
    const mailtoLink = `mailto:${recipientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink, '_blank');
    
    toast({
      title: 'Copied & opened',
      description: 'Email copied and mail app opened.',
    });
  };

  const isLoading = isAdding || isUpdating || isAIGenerating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {existingEmail ? 'Edit Email' : 'Compose Email'}
            {isAIGenerated && (
              <Badge variant="secondary" className="ml-2">
                <Sparkles className="w-3 h-3 mr-1" />AI Generated
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Email Type */}
          <div className="space-y-2">
            <Label>Email Type</Label>
            <Select value={emailType} onValueChange={(v) => handleTypeChange(v as EmailType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EMAIL_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Recipient */}
          <div className="space-y-2">
            <Label>To</Label>
            <div className="flex gap-2">
              <Input
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="recipient@email.com"
                type="email"
                className="flex-1"
              />
              {contacts.length > 0 && (
                <Select
                  value=""
                  onValueChange={(email) => setRecipientEmail(email)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select contact" />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.filter(c => c.email).map((contact) => (
                      <SelectItem key={contact.id} value={contact.email!}>
                        {contact.name} {contact.is_primary && '(Primary)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label>Subject</Label>
            <Input
              value={subject}
              onChange={(e) => { setSubject(e.target.value); setIsAIGenerated(false); }}
              placeholder="Email subject..."
            />
          </div>

          {/* Body */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Body</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAIGenerate}
                disabled={isAIGenerating}
              >
                {isAIGenerating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                AI Generate
              </Button>
            </div>
            <Textarea
              value={body}
              onChange={(e) => { setBody(e.target.value); setIsAIGenerated(false); }}
              placeholder="Write your email..."
              className="min-h-[250px] resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">
              {body.length} characters
            </p>
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="outline" onClick={handleCopyAndOpen} disabled={isLoading || !subject || !body}>
            <Copy className="h-4 w-4 mr-2" />
            Copy & Open Mail
          </Button>
          <Button variant="secondary" onClick={() => handleSave('draft')} disabled={isLoading}>
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
          <Button onClick={() => handleSave('sent')} disabled={isLoading}>
            <Send className="h-4 w-4 mr-2" />
            Save as Sent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
