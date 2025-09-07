import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { SourceType } from '@/lib/database.types';
import { Loader2 } from 'lucide-react';
import { useCreateSource } from '@/hooks/useQueryData';
import { sanitizeText, sanitizeEmail, sanitizePhone, sanitizeURL } from '@/lib/sanitize';

interface ImportDiscoveredOfficeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSourceAdded: () => void;
  prefillData: {
    name: string;
    address: string;
    phone: string;
    website: string;
    latitude: number | null;
    longitude: number | null;
    google_place_id: string;
    google_rating: number | null;
  };
}

export const ImportDiscoveredOfficeDialog: React.FC<ImportDiscoveredOfficeDialogProps> = ({
  open,
  onOpenChange,
  onSourceAdded,
  prefillData
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const createSourceMutation = useCreateSource();
  const [formData, setFormData] = useState({
    name: prefillData.name,
    address: prefillData.address,
    phone: prefillData.phone,
    email: '',
    website: prefillData.website,
    source_type: 'Office' as SourceType,
    notes: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Sanitize all inputs before submission
    const sanitizedName = sanitizeText(formData.name);
    const sanitizedAddress = sanitizeText(formData.address);
    const sanitizedPhone = sanitizePhone(formData.phone);
    const sanitizedEmail = formData.email ? sanitizeEmail(formData.email) : '';
    const sanitizedWebsite = formData.website ? sanitizeURL(formData.website) : '';
    const sanitizedNotes = sanitizeText(formData.notes);

    // Validate sanitized inputs
    if (!sanitizedName) {
      toast({
        title: "Error",
        description: "Office name is required and cannot contain invalid characters",
        variant: "destructive"
      });
      return;
    }

    if (formData.email && !sanitizedEmail) {
      toast({
        title: "Error", 
        description: "Please enter a valid email address",
        variant: "destructive"
      });
      return;
    }

    // Prepare source data
    const sourceData = {
      name: sanitizedName,
      address: sanitizedAddress,
      phone: sanitizedPhone || null,
      email: sanitizedEmail || null,
      website: sanitizedWebsite || null,
      source_type: formData.source_type,
      notes: sanitizedNotes || null,
      latitude: prefillData.latitude,
      longitude: prefillData.longitude,
      google_place_id: prefillData.google_place_id,
      google_rating: prefillData.google_rating,
      created_by: user.id,
      is_active: true
    };

    // Use optimistic mutation
    createSourceMutation.mutate(sourceData, {
      onSuccess: () => {
        toast({
          title: "Success",
          description: `${formData.name} has been added to your referring sources!`
        });
        onSourceAdded();
        onOpenChange(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add to Referring Sources</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Office Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              type="url"
              value={formData.website}
              onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="source_type">Source Type</Label>
            <Select 
              value={formData.source_type} 
              onValueChange={(value: SourceType) => setFormData(prev => ({ ...prev, source_type: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Office">Dental Office</SelectItem>
                <SelectItem value="Specialist">Specialist</SelectItem>
                <SelectItem value="Insurance">Insurance Provider</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Any additional notes about this office..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createSourceMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createSourceMutation.isPending}>
              {createSourceMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add to Sources'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};