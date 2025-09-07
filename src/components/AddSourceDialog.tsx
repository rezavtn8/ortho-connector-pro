import React, { useState } from 'react';
import { Plus, Upload, X, MapPin, Phone, Mail, Globe, Clock, Building2, Star, Download, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { SourceType } from '@/lib/database.types';
import { AddressSearch } from '@/components/AddressSearch';
import { sanitizeText, sanitizeEmail, sanitizeURL, sanitizePhone } from '@/lib/sanitize';
import { useCreateSource } from '@/hooks/useQueryData';
import { useAuth } from '@/hooks/useAuth';

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

interface AddOfficeDialogProps {
  onOfficeAdded: () => void;
}

export const AddOfficeDialog: React.FC<AddOfficeDialogProps> = ({ onOfficeAdded }) => {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    office_hours: '',
    notes: '',
    source: 'Manual',
    google_rating: '',
    yelp_rating: '',
    distance_from_clinic: '',
    patient_load: '0'
  });
  const [selectedOffice, setSelectedOffice] = useState<SelectedOffice | null>(null);
  
  const { user } = useAuth();
  const createSourceMutation = useCreateSource();

  const sourceOptions = [
    { value: 'Manual', label: 'Manual Entry', icon: '✏️' },
    { value: 'Referral', label: 'Referral', icon: '🤝' },
    { value: 'Marketing Research', label: 'Marketing Research', icon: '📊' },
    { value: 'Google', label: 'Google Search', icon: '🔍' },
    { value: 'Yelp', label: 'Yelp', icon: '⭐' },
    { value: 'Medical Directory', label: 'Medical Directory', icon: '📋' },
    { value: 'Social Media', label: 'Social Media', icon: '💬' },
    { value: 'Website', label: 'Website', icon: '🌐' },
    { value: 'Other', label: 'Other', icon: '📌' }
  ];

  const resetForm = () => {
    setFormData({
      name: '',
      address: '',
      phone: '',
      email: '',
      website: '',
      office_hours: '',
      notes: '',
      source: 'Manual',
      google_rating: '',
      yelp_rating: '',
      distance_from_clinic: '',
      patient_load: '0'
    });
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Office name is required",
        variant: "destructive",
      });
      return false;
    }
    
    // Validate ratings if provided
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
    
    // Validate email if provided
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
    
    if (!validateForm() || !user) return;

    // Sanitize all form inputs
    const sanitizedName = sanitizeText(formData.name);
    const sanitizedPhone = sanitizePhone(formData.phone);
    const sanitizedEmail = formData.email ? sanitizeEmail(formData.email) : null;
    const sanitizedWebsite = formData.website ? sanitizeURL(formData.website) : null;
    const sanitizedNotes = sanitizeText(formData.notes);
    const sanitizedAddress = sanitizeText(formData.address);

    // Validate sanitized data
    if (!sanitizedName) {
      toast({
        title: "Error",
        description: "Office name is required and cannot contain invalid characters",
        variant: "destructive",
      });
      return;
    }

    if (formData.email && !sanitizedEmail) {
      toast({
        title: "Error", 
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    // Prepare source data
    const sourceData = {
      name: sanitizedName,
      source_type: 'Office' as SourceType,
      phone: sanitizedPhone || null,
      email: sanitizedEmail,
      website: sanitizedWebsite,
      notes: sanitizedNotes,
      is_active: true,
      created_by: user.id,
      address: sanitizedAddress || null,
      latitude: selectedOffice?.latitude || null,
      longitude: selectedOffice?.longitude || null,
      google_place_id: selectedOffice?.google_place_id || null,
      google_rating: selectedOffice?.google_rating || (formData.google_rating ? parseFloat(formData.google_rating) : null),
      opening_hours: formData.office_hours || selectedOffice?.opening_hours || null,
      last_updated_from_google: selectedOffice?.google_place_id ? new Date().toISOString() : null,
    };

    // Use optimistic mutation
    createSourceMutation.mutate(sourceData, {
      onSuccess: () => {
        onOfficeAdded();
        resetForm();
        setSelectedOffice(null);
        setOpen(false);
      },
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      // For now, show a message that this feature is coming soon
      toast({
        title: "Feature Coming Soon",
        description: "CSV/Excel import will be available in the next update",
        className: "bg-blue-50 border-blue-200",
      });
      
      // Reset the input
      event.target.value = '';
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Upload Failed",
        description: "Please check your file format and try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary-hover text-primary-foreground">
          <Plus className="w-4 h-4 mr-2" />
          Add Office
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-primary">Add New Referring Office</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="manual" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
            <TabsTrigger value="search">Search Places</TabsTrigger>
            <TabsTrigger value="import">Bulk Import</TabsTrigger>
          </TabsList>
          
          <TabsContent value="manual" className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  Basic Information
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Office Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter office name"
                      required
                      disabled={createSourceMutation.isPending}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="source">Source Type</Label>
                    <Select 
                      value={formData.source} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, source: value }))}
                      disabled={createSourceMutation.isPending}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select source type" />
                      </SelectTrigger>
                      <SelectContent>
                        {sourceOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <span className="flex items-center gap-2">
                              <span>{option.icon}</span>
                              {option.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Location Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  Location
                </h3>
                
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Enter office address"
                    disabled={createSourceMutation.isPending}
                  />
                </div>
              </div>

              {/* Contact Information Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Phone className="w-5 h-5 text-primary" />
                  Contact Information
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="(555) 123-4567"
                      disabled={createSourceMutation.isPending}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="office@example.com"
                      disabled={createSourceMutation.isPending}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                    placeholder="https://example.com"
                    disabled={createSourceMutation.isPending}
                  />
                </div>
              </div>

              {/* Additional Information Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Additional Information
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="google_rating">Google Rating (0-5)</Label>
                    <Input
                      id="google_rating"
                      type="number"
                      min="0"
                      max="5"
                      step="0.1"
                      value={formData.google_rating}
                      onChange={(e) => setFormData(prev => ({ ...prev, google_rating: e.target.value }))}
                      placeholder="4.5"
                      disabled={createSourceMutation.isPending}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="yelp_rating">Yelp Rating (0-5)</Label>
                    <Input
                      id="yelp_rating"
                      type="number"
                      min="0"
                      max="5"
                      step="0.1"
                      value={formData.yelp_rating}
                      onChange={(e) => setFormData(prev => ({ ...prev, yelp_rating: e.target.value }))}
                      placeholder="4.0"
                      disabled={createSourceMutation.isPending}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="office_hours">Office Hours</Label>
                  <Input
                    id="office_hours"
                    value={formData.office_hours}
                    onChange={(e) => setFormData(prev => ({ ...prev, office_hours: e.target.value }))}
                    placeholder="Mon-Fri 9AM-5PM"
                    disabled={createSourceMutation.isPending}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Additional notes about this office..."
                    rows={3}
                    disabled={createSourceMutation.isPending}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setOpen(false)}
                  disabled={createSourceMutation.isPending}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createSourceMutation.isPending}
                  className="bg-primary hover:bg-primary-hover"
                >
                  {createSourceMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Adding Office...
                    </>
                  ) : (
                    'Add Office'
                  )}
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="search" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Search Places
                </CardTitle>
                <CardDescription>
                  Search for offices using Google Places API
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <AddressSearch
                  onSelect={(office) => {
                    setSelectedOffice(office);
                    setFormData(prev => ({
                      ...prev,
                      name: office.name,
                      address: office.address || '',
                      phone: office.phone || '',
                      website: office.website || '',
                    }));
                  }}
                  placeholder="Search for medical offices, clinics, hospitals..."
                />
                
                {selectedOffice && (
                  <div className="p-4 border rounded-lg bg-gray-50">
                    <h4 className="font-semibold mb-2">Selected Office:</h4>
                    <div className="space-y-1 text-sm">
                      <p><strong>Name:</strong> {selectedOffice.name}</p>
                      {selectedOffice.address && <p><strong>Address:</strong> {selectedOffice.address}</p>}
                      {selectedOffice.phone && <p><strong>Phone:</strong> {selectedOffice.phone}</p>}
                      {selectedOffice.website && <p><strong>Website:</strong> {selectedOffice.website}</p>}
                      {selectedOffice.google_rating && (
                        <p><strong>Google Rating:</strong> {selectedOffice.google_rating} ⭐</p>
                      )}
                    </div>
                    <Button 
                      onClick={() => {
                        const sourceData = {
                          name: selectedOffice.name,
                          source_type: 'Office' as SourceType,
                          phone: selectedOffice.phone || null,
                          email: null,
                          website: selectedOffice.website || null,
                          notes: null,
                          is_active: true,
                          created_by: user?.id || '',
                          address: selectedOffice.address || null,
                          latitude: selectedOffice.latitude || null,
                          longitude: selectedOffice.longitude || null,
                          google_place_id: selectedOffice.google_place_id || null,
                          google_rating: selectedOffice.google_rating || null,
                          opening_hours: selectedOffice.opening_hours || null,
                          last_updated_from_google: selectedOffice.google_place_id ? new Date().toISOString() : null,
                        };

                        createSourceMutation.mutate(sourceData, {
                          onSuccess: () => {
                            onOfficeAdded();
                            setSelectedOffice(null);
                            setOpen(false);
                          },
                        });
                      }}
                      className="mt-3"
                      disabled={createSourceMutation.isPending}
                    >
                      {createSourceMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Adding Office...
                        </>
                      ) : (
                        'Add This Office'
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="import" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Bulk Import
                </CardTitle>
                <CardDescription>
                  Import multiple offices from CSV or Excel file
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <Label htmlFor="file-upload" className="cursor-pointer">
                    <span className="text-sm font-medium text-gray-900">Choose file to upload</span>
                    <span className="text-sm text-gray-500 block">CSV or Excel files only</span>
                  </Label>
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
                
                <Alert>
                  <Download className="w-4 h-4" />
                  <AlertDescription>
                    Download our template to ensure proper formatting for bulk imports.
                    <Button variant="link" className="p-0 h-auto ml-2 text-primary">
                      Download Template
                    </Button>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

// Export alias for backward compatibility
export const AddSourceDialog = AddOfficeDialog;