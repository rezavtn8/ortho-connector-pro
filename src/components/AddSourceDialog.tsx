import React, { useState } from 'react';
import { Plus, Upload, X, MapPin, Phone, Mail, Globe, Clock, Building2, Star, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { SourceType } from '@/lib/database.types';

interface AddOfficeDialogProps {
  onOfficeAdded: () => void;
}

export const AddOfficeDialog: React.FC<AddOfficeDialogProps> = ({ onOfficeAdded }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
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
    if (!formData.address.trim()) {
      toast({
        title: "Validation Error",
        description: "Office address is required",
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
    
    if (!validateForm()) return;
    
    setLoading(true);

    try {
      const officeData = {
        name: formData.name.trim(),
        address: formData.address.trim(),
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        website: formData.website.trim() || null,
        office_hours: formData.office_hours.trim() || null,
        notes: formData.notes.trim() || null,
        source: formData.source,
        google_rating: formData.google_rating ? parseFloat(formData.google_rating) : null,
        yelp_rating: formData.yelp_rating ? parseFloat(formData.yelp_rating) : null,
        distance_from_clinic: formData.distance_from_clinic ? parseFloat(formData.distance_from_clinic) : null,
        patient_load: parseInt(formData.patient_load) || 0
      };

      const { data, error } = await supabase
        .from('patient_sources')
        .insert({
          name: formData.name.trim(),
          address: formData.address.trim() || null,
          phone: formData.phone.trim() || null,
          email: formData.email.trim() || null,
          website: formData.website.trim() || null,
          notes: formData.notes.trim() || null,
          source_type: 'Other' as SourceType,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success! 🎉",
        description: `${formData.name} has been added to your offices`,
        className: "bg-green-50 border-green-200",
      });

      resetForm();
      setOpen(false);
      onOfficeAdded();
    } catch (error: any) {
      console.error('Error adding office:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add office. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    
    try {
      // Create FormData and send to your backend or parse client-side
      const formData = new FormData();
      formData.append('file', file);
      
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
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200">
          <Plus className="w-4 h-4 mr-2" />
          Add Office
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Building2 className="w-6 h-6 text-blue-600" />
            Add New Office
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="manual" className="w-full mt-4">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="manual" className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Manual Entry
            </TabsTrigger>
            <TabsTrigger value="import" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Import from File
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="manual" className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Basic Information
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="flex items-center gap-1">
                      Office Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Smile Dental Care"
                      required
                      className="border-gray-300 focus:border-blue-500"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="source">Source</Label>
                    <Select value={formData.source} onValueChange={(value) => setFormData(prev => ({ ...prev, source: value }))}>
                      <SelectTrigger className="border-gray-300 focus:border-blue-500">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {sourceOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <span className="flex items-center gap-2">
                              <span>{option.icon}</span>
                              <span>{option.label}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address" className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    Address <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="123 Main Street, Suite 100&#10;City, State 12345"
                    required
                    rows={3}
                    className="border-gray-300 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Contact Information Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Phone className="w-5 h-5" />
                  Contact Information
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      Phone
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="(555) 123-4567"
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
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="office@example.com"
                      className="border-gray-300 focus:border-blue-500"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="website" className="flex items-center gap-1">
                      <Globe className="w-4 h-4" />
                      Website
                    </Label>
                    <Input
                      id="website"
                      type="url"
                      value={formData.website}
                      onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                      placeholder="https://www.example.com"
                      className="border-gray-300 focus:border-blue-500"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="office_hours" className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Office Hours
                    </Label>
                    <Input
                      id="office_hours"
                      value={formData.office_hours}
                      onChange={(e) => setFormData(prev => ({ ...prev, office_hours: e.target.value }))}
                      placeholder="Mon-Fri: 9AM-5PM"
                      className="border-gray-300 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Additional Information Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Star className="w-5 h-5" />
                  Additional Information
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="google_rating">Google Rating</Label>
                    <Input
                      id="google_rating"
                      type="number"
                      step="0.1"
                      min="0"
                      max="5"
                      value={formData.google_rating}
                      onChange={(e) => setFormData(prev => ({ ...prev, google_rating: e.target.value }))}
                      placeholder="4.5"
                      className="border-gray-300 focus:border-blue-500"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="yelp_rating">Yelp Rating</Label>
                    <Input
                      id="yelp_rating"
                      type="number"
                      step="0.1"
                      min="0"
                      max="5"
                      value={formData.yelp_rating}
                      onChange={(e) => setFormData(prev => ({ ...prev, yelp_rating: e.target.value }))}
                      placeholder="4.0"
                      className="border-gray-300 focus:border-blue-500"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="distance_from_clinic">Distance (miles)</Label>
                    <Input
                      id="distance_from_clinic"
                      type="number"
                      step="0.1"
                      min="0"
                      value={formData.distance_from_clinic}
                      onChange={(e) => setFormData(prev => ({ ...prev, distance_from_clinic: e.target.value }))}
                      placeholder="2.5"
                      className="border-gray-300 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="patient_load">Initial Patient Load</Label>
                  <Input
                    id="patient_load"
                    type="number"
                    min="0"
                    value={formData.patient_load}
                    onChange={(e) => setFormData(prev => ({ ...prev, patient_load: e.target.value }))}
                    placeholder="0"
                    className="border-gray-300 focus:border-blue-500"
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
                    className="border-gray-300 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
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
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Office
                    </>
                  )}
                </Button>
              </div>
            </form>
          </TabsContent>
          
          <TabsContent value="import" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Import from Excel/CSV
                </CardTitle>
                <CardDescription>
                  Upload a spreadsheet with office information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertDescription>
                    <p className="font-semibold mb-2">Required columns:</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <Badge variant="secondary">Name (required)</Badge>
                      <Badge variant="secondary">Address (required)</Badge>
                      <Badge variant="outline">Phone</Badge>
                      <Badge variant="outline">Email</Badge>
                      <Badge variant="outline">Website</Badge>
                      <Badge variant="outline">Office Hours</Badge>
                      <Badge variant="outline">Google Rating</Badge>
                      <Badge variant="outline">Yelp Rating</Badge>
                      <Badge variant="outline">Distance</Badge>
                      <Badge variant="outline">Patient Load</Badge>
                      <Badge variant="outline">Source</Badge>
                      <Badge variant="outline">Notes</Badge>
                    </div>
                  </AlertDescription>
                </Alert>
                
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                  <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-900">Drop your file here or click to browse</p>
                    <p className="text-xs text-gray-500">CSV or Excel files only (max 10MB)</p>
                  </div>
                  <Input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileUpload}
                    disabled={loading}
                    className="mt-4 cursor-pointer"
                  />
                </div>
                
                {loading && (
                  <div className="flex items-center justify-center gap-2 text-sm text-blue-600">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    Processing file...
                  </div>
                )}
                
                <div className="flex justify-center">
                  <Button variant="link" className="text-sm">
                    <Download className="w-4 h-4 mr-2" />
                    Download Template
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};