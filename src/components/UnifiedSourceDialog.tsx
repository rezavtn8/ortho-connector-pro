import React, { useState, useEffect } from 'react';
import { Plus, Building2, MapPin, Phone, Mail, Globe, Clock, Star } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { SourceType, SOURCE_TYPE_CONFIG } from '@/lib/database.types';
import { AddressSearch } from '@/components/AddressSearch';
import { sanitizeText, sanitizeEmail, sanitizeURL, sanitizePhone } from '@/lib/sanitize';
import { nowISO } from '@/lib/dateSync';

interface SelectedOffice {
  id?: string;
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  website?: string | null;
  google_place_id?: string | null;
  google_rating?: number | null;
  opening_hours?: string | null;
}

interface PrefillData {
  name?: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  google_place_id?: string | null;
  google_rating?: number | null;
  office_type?: string;
  notes?: string;
}

interface UnifiedSourceDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSourceAdded: () => void;
  mode?: 'create' | 'import-discovered';
  prefillData?: PrefillData;
  defaultSourceType?: SourceType;
  triggerButton?: React.ReactNode;
}

export const UnifiedSourceDialog: React.FC<UnifiedSourceDialogProps> = ({
  open: controlledOpen,
  onOpenChange,
  onSourceAdded,
  mode = 'create',
  prefillData,
  defaultSourceType = 'Office',
  triggerButton
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    source_type: defaultSourceType,
    address: '',
    phone: '',
    email: '',
    website: '',
    notes: '',
    google_rating: '',
    yelp_rating: ''
  });
  const [selectedOffice, setSelectedOffice] = useState<SelectedOffice | null>(null);

  // Apply prefill data when provided
  useEffect(() => {
    if (prefillData && open) {
      setFormData(prev => ({
        ...prev,
        name: prefillData.name || prev.name,
        address: prefillData.address || prev.address,
        phone: prefillData.phone || prev.phone,
        email: prefillData.email || prev.email,
        website: prefillData.website || prev.website,
        notes: prefillData.notes || prev.notes,
        google_rating: prefillData.google_rating?.toString() || prev.google_rating
      }));

      if (prefillData.google_place_id) {
        setSelectedOffice({
          name: prefillData.name || '',
          address: prefillData.address,
          phone: prefillData.phone,
          website: prefillData.website,
          google_place_id: prefillData.google_place_id,
          google_rating: prefillData.google_rating
        });
      }
    }
  }, [prefillData, open]);

  const resetForm = () => {
    setFormData({
      name: '',
      source_type: defaultSourceType,
      address: '',
      phone: '',
      email: '',
      website: '',
      notes: '',
      google_rating: '',
      yelp_rating: ''
    });
    setSelectedOffice(null);
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Source name is required",
        variant: "destructive",
      });
      return false;
    }

    if (formData.google_rating && (parseFloat(formData.google_rating) < 0 || parseFloat(formData.google_rating) > 5)) {
      toast({
        title: "Validation Error",
        description: "Google rating must be between 0 and 5",
        variant: "destructive",
      });
      return false;
    }

    if (formData.yelp_rating && (parseFloat(formData.yelp_rating) < 0 || parseFloat(formData.yelp_rating) > 5)) {
      toast({
        title: "Validation Error",
        description: "Yelp rating must be between 0 and 5",
        variant: "destructive",
      });
      return false;
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    try {
      const sanitizedName = sanitizeText(formData.name);
      const sanitizedPhone = sanitizePhone(formData.phone);
      const sanitizedEmail = formData.email ? sanitizeEmail(formData.email) : null;
      const sanitizedWebsite = formData.website ? sanitizeURL(formData.website) : null;
      const sanitizedNotes = sanitizeText(formData.notes);
      const sanitizedAddress = sanitizeText(formData.address);

      if (!sanitizedName) {
        toast({
          title: "Error",
          description: "Source name is required and cannot contain invalid characters",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (formData.email && !sanitizedEmail) {
        toast({
          title: "Error",
          description: "Please enter a valid email address",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      interface SourceData {
        name: string;
        source_type: SourceType;
        phone?: string | null;
        email?: string | null;
        website?: string | null;
        notes?: string | null;
        is_active: boolean;
        created_by: string;
        address?: string | null;
        latitude?: number | null;
        longitude?: number | null;
        google_place_id?: string | null;
        google_rating?: number | null;
        yelp_rating?: number | null;
        opening_hours?: string | null;
        last_updated_from_google?: string | null;
      }

      const sourceData: SourceData = {
        name: sanitizedName,
        source_type: formData.source_type,
        phone: sanitizedPhone || null,
        email: sanitizedEmail,
        website: sanitizedWebsite,
        notes: sanitizedNotes,
        is_active: true,
        created_by: userId
      };

      // Add ratings if provided
      if (formData.google_rating) {
        sourceData.google_rating = parseFloat(formData.google_rating);
      }
      if (formData.yelp_rating) {
        sourceData.yelp_rating = parseFloat(formData.yelp_rating);
      }

      // Add address and coordinates from selected office or manual entry
      if (selectedOffice) {
        sourceData.address = selectedOffice.address;
        sourceData.latitude = selectedOffice.latitude;
        sourceData.longitude = selectedOffice.longitude;

        if (selectedOffice.google_rating) {
          sourceData.google_rating = selectedOffice.google_rating;
        }
        if (selectedOffice.google_place_id) {
          sourceData.google_place_id = selectedOffice.google_place_id;
          sourceData.last_updated_from_google = nowISO();
        }
        if (selectedOffice.opening_hours) {
          sourceData.opening_hours = selectedOffice.opening_hours;
        }
        if (selectedOffice.phone && !formData.phone.trim()) {
          sourceData.phone = selectedOffice.phone;
        }
        if (selectedOffice.website && !formData.website.trim()) {
          sourceData.website = selectedOffice.website;
        }
      } else if (sanitizedAddress) {
        sourceData.address = sanitizedAddress;
      }

      // Check for duplicate if Google Place ID exists
      if (selectedOffice?.google_place_id) {
        const { data: existingOffice, error: checkError } = await supabase
          .from('patient_sources')
          .select('id, name')
          .eq('google_place_id', selectedOffice.google_place_id)
          .eq('created_by', userId)
          .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') {
          throw checkError;
        }

        if (existingOffice) {
          toast({
            title: "Duplicate Source",
            description: `${existingOffice.name} already exists in your sources.`,
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }

      const { data, error } = await supabase
        .from('patient_sources')
        .insert(sourceData)
        .select()
        .single();

      if (error) throw error;

      // Log activity
      try {
        await supabase.rpc('log_activity', {
          p_action_type: 'source_added',
          p_resource_type: 'source',
          p_resource_id: data.id,
          p_resource_name: sanitizedName,
          p_details: {
            source_type: formData.source_type,
            method: mode === 'import-discovered' ? 'discovered' : 'manual',
            has_google_data: !!selectedOffice?.google_place_id
          }
        });
      } catch (logError) {
        console.error('Failed to log activity:', logError);
      }

      toast({
        title: "Success! 🎉",
        description: `${sanitizedName} has been added to your sources`,
        className: "bg-green-50 border-green-200",
      });

      resetForm();
      setOpen(false);
      onSourceAdded();
    } catch (error: unknown) {
      console.error('Error adding source:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to add source. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isOfficeType = formData.source_type === 'Office';

  const dialogContent = (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Source Type Selector */}
      <div className="space-y-2">
        <Label htmlFor="source_type">Source Type</Label>
        <Select 
          value={formData.source_type} 
          onValueChange={(value: SourceType) => setFormData(prev => ({ ...prev, source_type: value }))}
        >
          <SelectTrigger className="border-gray-300 focus:border-blue-500">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SOURCE_TYPE_CONFIG).map(([key, config]) => (
              <SelectItem key={key} value={key}>
                <span className="flex items-center gap-2">
                  <span>{config.icon}</span>
                  <span>{config.label}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Conditional Fields Based on Source Type */}
      {isOfficeType && (
        <div className="space-y-2">
          <Label htmlFor="address-search">Search for Office</Label>
          <AddressSearch
            onSelect={(office) => {
              setSelectedOffice(office);
              if (office) {
                setFormData(prev => ({
                  ...prev,
                  name: office.name,
                  address: office.address || '',
                  phone: office.phone && !prev.phone ? office.phone : prev.phone,
                  website: office.website && !prev.website ? office.website : prev.website,
                }));
              }
            }}
            placeholder="Search for office address..."
          />
          {selectedOffice && (
            <div className="p-3 bg-muted/50 rounded-md border">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-medium flex items-center gap-2">
                    {selectedOffice.name}
                    {selectedOffice.google_rating && (
                      <div className="flex items-center gap-1 text-amber-600">
                        <Star className="w-4 h-4 fill-current" />
                        <span className="text-sm font-medium">{selectedOffice.google_rating}</span>
                      </div>
                    )}
                  </div>
                  {selectedOffice.address && (
                    <div className="text-muted-foreground text-sm mt-1">{selectedOffice.address}</div>
                  )}
                  {selectedOffice.phone && (
                    <div className="text-muted-foreground text-sm flex items-center gap-1 mt-1">
                      <Phone className="w-3 h-3" />
                      {selectedOffice.phone}
                    </div>
                  )}
                  {selectedOffice.website && (
                    <div className="text-muted-foreground text-sm flex items-center gap-1 mt-1">
                      <Globe className="w-3 h-3" />
                      <span className="truncate">{selectedOffice.website}</span>
                    </div>
                  )}
                </div>
                {selectedOffice.google_place_id && (
                  <Badge variant="secondary" className="text-xs">
                    Google
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Name Field */}
      <div className="space-y-2">
        <Label htmlFor="name" className="flex items-center gap-1">
          {isOfficeType ? 'Office' : 'Source'} Name <span className="text-red-500">*</span>
        </Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder={isOfficeType ? "e.g., Smile Dental Care" : "e.g., Patient Referral"}
          required
          className="border-gray-300 focus:border-blue-500"
        />
      </div>

      {/* Address Field (for offices or manual entry) */}
      {isOfficeType && (
        <div className="space-y-2">
          <Label htmlFor="address" className="flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            Address (Manual Entry)
          </Label>
          <Textarea
            id="address"
            value={formData.address}
            onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
            placeholder="Or enter address manually..."
            rows={2}
            className="border-gray-300 focus:border-blue-500"
          />
        </div>
      )}

      {/* Contact Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="phone" className="flex items-center gap-1">
            <Phone className="w-4 h-4" />
            Phone
          </Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
            placeholder="(555) 123-4567"
            type="tel"
            className="border-gray-300 focus:border-blue-500"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="flex items-center gap-1">
            <Mail className="w-4 h-4" />
            Email
          </Label>
          <Input
            id="email"
            value={formData.email}
            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            placeholder="contact@example.com"
            type="email"
            className="border-gray-300 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Website */}
      <div className="space-y-2">
        <Label htmlFor="website" className="flex items-center gap-1">
          <Globe className="w-4 h-4" />
          Website
        </Label>
        <Input
          id="website"
          value={formData.website}
          onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
          placeholder="https://www.example.com"
          type="url"
          className="border-gray-300 focus:border-blue-500"
        />
      </div>

      {/* Ratings (for offices) */}
      {isOfficeType && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="google_rating" className="flex items-center gap-1">
              <Star className="w-4 h-4" />
              Google Rating
            </Label>
            <Input
              id="google_rating"
              value={formData.google_rating}
              onChange={(e) => setFormData(prev => ({ ...prev, google_rating: e.target.value }))}
              placeholder="4.5"
              type="number"
              step="0.1"
              min="0"
              max="5"
              className="border-gray-300 focus:border-blue-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="yelp_rating" className="flex items-center gap-1">
              <Star className="w-4 h-4" />
              Yelp Rating
            </Label>
            <Input
              id="yelp_rating"
              value={formData.yelp_rating}
              onChange={(e) => setFormData(prev => ({ ...prev, yelp_rating: e.target.value }))}
              placeholder="4.0"
              type="number"
              step="0.5"
              min="0"
              max="5"
              className="border-gray-300 focus:border-blue-500"
            />
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          placeholder="Any additional information..."
          rows={3}
          className="border-gray-300 focus:border-blue-500"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            resetForm();
            setOpen(false);
          }}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={loading}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
        >
          {loading ? 'Adding...' : mode === 'import-discovered' ? 'Add to Sources' : 'Add Source'}
        </Button>
      </div>
    </form>
  );

  // If custom trigger button provided, use controlled dialog
  if (triggerButton) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {triggerButton}
        </DialogTrigger>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <Building2 className="w-6 h-6 text-blue-600" />
              {mode === 'import-discovered' ? 'Add Discovered Office' : 'Add New Source'}
            </DialogTitle>
          </DialogHeader>
          {dialogContent}
        </DialogContent>
      </Dialog>
    );
  }

  // Default trigger button
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200">
          <Plus className="w-4 h-4 mr-2" />
          Add {defaultSourceType === 'Office' ? 'Office' : 'Source'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Building2 className="w-6 h-6 text-blue-600" />
            {mode === 'import-discovered' ? 'Add Discovered Office' : 'Add New Source'}
          </DialogTitle>
        </DialogHeader>
        {dialogContent}
      </DialogContent>
    </Dialog>
  );
};
