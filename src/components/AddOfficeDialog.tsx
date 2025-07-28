import React, { useState } from 'react';
import { Plus, Upload, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

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
    distance_from_clinic: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const officeData = {
        ...formData,
        google_rating: formData.google_rating ? parseFloat(formData.google_rating) : null,
        yelp_rating: formData.yelp_rating ? parseFloat(formData.yelp_rating) : null,
        distance_from_clinic: formData.distance_from_clinic ? parseFloat(formData.distance_from_clinic) : null,
      };

      const { error } = await supabase
        .from('referring_offices')
        .insert([officeData]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Office added successfully",
      });

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
        distance_from_clinic: ''
      });
      setOpen(false);
      onOfficeAdded();
    } catch (error) {
      console.error('Error adding office:', error);
      toast({
        title: "Error",
        description: "Failed to add office",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Basic CSV/Excel file validation
    const validTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV or Excel file",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      const text = await file.text();
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      // Expected headers mapping
      const headerMap = {
        'name': ['name', 'office name', 'practice name'],
        'address': ['address', 'location', 'street address'],
        'phone': ['phone', 'telephone', 'phone number'],
        'email': ['email', 'email address'],
        'website': ['website', 'web', 'url'],
        'source': ['source', 'referral source', 'ref source']
      };

      const offices = [];
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const office: any = { source: 'Import' };
        
        // Map CSV columns to our fields
        headers.forEach((header, index) => {
          for (const [field, possibleHeaders] of Object.entries(headerMap)) {
            if (possibleHeaders.includes(header)) {
              office[field] = values[index] || null;
              break;
            }
          }
        });
        
        if (office.name && office.address) {
          offices.push(office);
        }
      }
      
      if (offices.length === 0) {
        toast({
          title: "No valid data found",
          description: "Please ensure your file has Name and Address columns",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('referring_offices')
        .insert(offices);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Successfully imported ${offices.length} offices`,
      });

      setOpen(false);
      onOfficeAdded();
    } catch (error) {
      console.error('Error importing offices:', error);
      toast({
        title: "Import failed",
        description: "Failed to import offices. Please check your file format.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-primary hover:shadow-elegant transition-all">
          <Plus className="w-4 h-4 mr-2" />
          Add Office
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Add New Office
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="manual" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
            <TabsTrigger value="import">Import from Excel</TabsTrigger>
          </TabsList>
          
          <TabsContent value="manual" className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Office Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter office name"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="source">Source</Label>
                  <Select value={formData.source} onValueChange={(value) => setFormData(prev => ({ ...prev, source: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Manual">Manual Entry</SelectItem>
                      <SelectItem value="Referral">Referral</SelectItem>
                      <SelectItem value="Marketing">Marketing Research</SelectItem>
                      <SelectItem value="Google">Google Search</SelectItem>
                      <SelectItem value="Directory">Medical Directory</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="address">Address *</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Enter full address"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="(555) 123-4567"
                  />
                </div>
                
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="office@example.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={formData.website}
                    onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                    placeholder="https://example.com"
                  />
                </div>
                
                <div>
                  <Label htmlFor="distance">Distance (miles)</Label>
                  <Input
                    id="distance"
                    type="number"
                    step="0.1"
                    value={formData.distance_from_clinic}
                    onChange={(e) => setFormData(prev => ({ ...prev, distance_from_clinic: e.target.value }))}
                    placeholder="5.2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="google_rating">Google Rating</Label>
                  <Input
                    id="google_rating"
                    type="number"
                    step="0.1"
                    min="1"
                    max="5"
                    value={formData.google_rating}
                    onChange={(e) => setFormData(prev => ({ ...prev, google_rating: e.target.value }))}
                    placeholder="4.5"
                  />
                </div>
                
                <div>
                  <Label htmlFor="yelp_rating">Yelp Rating</Label>
                  <Input
                    id="yelp_rating"
                    type="number"
                    step="0.1"
                    min="1"
                    max="5"
                    value={formData.yelp_rating}
                    onChange={(e) => setFormData(prev => ({ ...prev, yelp_rating: e.target.value }))}
                    placeholder="4.0"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="office_hours">Office Hours</Label>
                <Input
                  id="office_hours"
                  value={formData.office_hours}
                  onChange={(e) => setFormData(prev => ({ ...prev, office_hours: e.target.value }))}
                  placeholder="Mon-Fri 9AM-5PM"
                />
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes about this office..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Adding...' : 'Add Office'}
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
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  <p className="mb-2">Upload a CSV or Excel file with the following columns:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Name</strong> (required) - Office name</li>
                    <li><strong>Address</strong> (required) - Full address</li>
                    <li><strong>Phone</strong> - Phone number</li>
                    <li><strong>Email</strong> - Email address</li>
                    <li><strong>Website</strong> - Website URL</li>
                    <li><strong>Source</strong> - Referral source</li>
                  </ul>
                </div>
                
                <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center">
                  <Upload className="w-8 h-8 mx-auto mb-4 text-muted-foreground" />
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Choose a file to upload</p>
                    <p className="text-xs text-muted-foreground">CSV or Excel files only</p>
                  </div>
                  <Input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileUpload}
                    disabled={loading}
                    className="mt-4"
                  />
                </div>
                
                {loading && (
                  <div className="text-center text-sm text-muted-foreground">
                    Processing file...
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};