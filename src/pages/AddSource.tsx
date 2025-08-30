// src/pages/AddSource.tsx
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Plus, Upload, FileSpreadsheet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { SOURCE_TYPE_CONFIG, SourceType } from '@/lib/database.types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface AddSourceProps {
  onSuccess?: () => void;
}

export function AddSource({ onSuccess }: AddSourceProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { userProfile } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    source_type: 'Other' as SourceType,
    address: '',
    phone: '',
    email: '',
    website: '',
    notes: '',
  });

  const [bulkData, setBulkData] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) {
      toast({
        title: "Error",
        description: "Source name is required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('patient_sources')
        .insert({
          clinic_id: userProfile?.clinic_id || '',
          name: formData.name,
          source_type: formData.source_type,
          address: formData.address || null,
          phone: formData.phone || null,
          email: formData.email || null,
          website: formData.website || null,
          notes: formData.notes || null,
          is_active: true,
          created_by: (await supabase.auth.getUser()).data.user?.id
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: `${formData.name} has been added successfully`,
      });

      // Reset form
      setFormData({
        name: '',
        source_type: 'Other',
        address: '',
        phone: '',
        email: '',
        website: '',
        notes: '',
      });

      onSuccess?.();
    } catch (error) {
      console.error('Error adding source:', error);
      toast({
        title: "Error",
        description: "Failed to add source. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBulkImport = async () => {
    if (!bulkData.trim()) {
      toast({
        title: "Error",
        description: "Please enter data to import",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Parse CSV data
      const lines = bulkData.trim().split('\n');
      const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
      
      const userId = (await supabase.auth.getUser()).data.user?.id;
      
      const sources = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const source: any = { 
          clinic_id: userProfile?.clinic_id || '',
          is_active: true, 
          created_by: userId 
        };
        
        headers.forEach((header, index) => {
          const value = values[index];
          if (header === 'name') source.name = value;
          else if (header === 'type') source.source_type = value || 'Other';
          else if (header === 'address') source.address = value;
          else if (header === 'phone') source.phone = value;
          else if (header === 'email') source.email = value;
          else if (header === 'website') source.website = value;
          else if (header === 'notes') source.notes = value;
        });
        
        return source;
      }).filter(s => s.name); // Only include sources with names

      if (sources.length === 0) {
        throw new Error('No valid sources found in the data');
      }

      const { error } = await supabase
        .from('patient_sources')
        .insert(sources);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${sources.length} sources imported successfully`,
      });

      setBulkData('');
      onSuccess?.();
    } catch (error) {
      console.error('Error importing sources:', error);
      toast({
        title: "Error",
        description: "Failed to import sources. Please check your data format.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setBulkData(text);
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Add Patient Source</h1>
          <p className="text-muted-foreground">
            Add new sources of patient referrals to track
          </p>
        </div>
      </div>

      <Tabs defaultValue="single" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="single">Single Source</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Import</TabsTrigger>
        </TabsList>

        <TabsContent value="single">
          <Card>
            <CardHeader>
              <CardTitle>Add New Source</CardTitle>
              <CardDescription>
                Enter the details of the patient source you want to track
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid gap-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Source Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Dr. Smith's Dental Office"
                        required
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="source_type">Source Type *</Label>
                      <Select
                        value={formData.source_type}
                        onValueChange={(value: SourceType) => 
                          setFormData({ ...formData, source_type: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(SOURCE_TYPE_CONFIG).map(([key, config]) => (
                            <SelectItem key={key} value={key}>
                              <span className="flex items-center gap-2">
                                <span>{config.icon}</span>
                                {config.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="123 Main St, City, State ZIP"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="(555) 123-4567"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="contact@example.com"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="website">Website</Label>
                      <Input
                        id="website"
                        type="url"
                        value={formData.website}
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                        placeholder="https://example.com"
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Any additional information about this source..."
                      rows={4}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <Button type="submit" disabled={loading} size="lg">
                    {loading ? 'Adding...' : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Source
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bulk">
          <Card>
            <CardHeader>
              <CardTitle>Bulk Import Sources</CardTitle>
              <CardDescription>
                Import multiple sources at once from CSV data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">CSV Format</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Your CSV should have the following columns (first row as headers):
                  </p>
                  <code className="block bg-background p-3 rounded text-xs">
                    Name,Type,Address,Phone,Email,Website,Notes<br/>
                    Dr. Smith's Office,dental_office,123 Main St,(555) 123-4567,smith@dental.com,https://smithdental.com,Great partner<br/>
                    City Medical Center,medical_office,456 Oak Ave,(555) 987-6543,info@citymed.com,,Large practice
                  </code>
                </div>

                <div className="space-y-2">
                  <Label>Upload CSV File</Label>
                  <div className="flex gap-2">
                    <Input
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleFileUpload}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bulkData">Or Paste CSV Data</Label>
                  <Textarea
                    id="bulkData"
                    value={bulkData}
                    onChange={(e) => setBulkData(e.target.value)}
                    placeholder="Paste your CSV data here..."
                    rows={10}
                    className="font-mono text-sm"
                  />
                </div>

                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Available Source Types</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {Object.entries(SOURCE_TYPE_CONFIG).map(([key, config]) => (
                      <div key={key} className="text-sm">
                        <span className="mr-2">{config.icon}</span>
                        <code className="text-xs bg-white px-1 py-0.5 rounded">{key}</code>
                        <span className="ml-1 text-muted-foreground">{config.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  onClick={handleBulkImport}
                  disabled={loading || !bulkData.trim()}
                  size="lg"
                >
                  {loading ? 'Importing...' : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Import Sources
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}