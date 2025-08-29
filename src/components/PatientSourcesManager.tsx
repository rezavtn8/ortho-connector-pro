// src/components/PatientSourceManagement.tsx
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Building2, Users, MapPin, Trash2, Edit } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { SourceType } from '@/lib/database.types';

interface PatientSource {
  id: string;
  name: string;
  type: 'clinic' | 'google' | 'yelp' | 'word_of_mouth' | 'referral' | 'facebook' | 'instagram';
  color: string;
  contact_info?: any;
  notes?: string;
  is_active: boolean;
}

interface PatientSourceManagementProps {
  sources: PatientSource[];
  onSourcesChange: () => void;
}

const SOURCE_TYPES = [
  { value: 'clinic', label: 'Clinic/Practice', icon: Building2 },
  { value: 'google', label: 'Google Ads', icon: 'G' },
  { value: 'yelp', label: 'Yelp Reviews', icon: 'Y' },
  { value: 'word_of_mouth', label: 'Word of Mouth', icon: Users },
  { value: 'facebook', label: 'Facebook', icon: 'F' },
  { value: 'instagram', label: 'Instagram', icon: 'IG' },
  { value: 'referral', label: 'Other Referral', icon: MapPin }
];

const COLOR_OPTIONS = [
  '#3B82F6', '#10B981', '#EF4444', '#8B5CF6', '#F97316', 
  '#1D4ED8', '#EC4899', '#06B6D4', '#84CC16', '#F59E0B'
];

export const PatientSourceManagement: React.FC<PatientSourceManagementProps> = ({ 
  sources, 
  onSourcesChange 
}) => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<PatientSource | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: '' as any,
    color: COLOR_OPTIONS[0],
    phone: '',
    email: '',
    website: '',
    notes: ''
  });
  const { toast } = useToast();

  const resetForm = () => {
    setFormData({
      name: '',
      type: '' as any,
      color: COLOR_OPTIONS[0],
      phone: '',
      email: '',
      website: '',
      notes: ''
    });
  };

  const handleAddSource = async () => {
    try {
      if (!formData.name || !formData.type) {
        toast({
          title: "Validation Error",
          description: "Please fill in required fields",
          variant: "destructive",
        });
        return;
      }

      const contactInfo = {
        phone: formData.phone || null,
        email: formData.email || null,
        website: formData.website || null
      };

      const { error } = await supabase
        .from('patient_sources')
        .insert({
          name: formData.name,
          source_type: 'Other' as SourceType,
          notes: formData.notes || null
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Patient source added successfully",
      });

      setIsAddDialogOpen(false);
      resetForm();
      onSourcesChange();

    } catch (error) {
      console.error('Error adding source:', error);
      toast({
        title: "Error",
        description: "Failed to add patient source",
        variant: "destructive",
      });
    }
  };

  const handleEditSource = async () => {
    try {
      if (!editingSource || !formData.name || !formData.type) {
        toast({
          title: "Validation Error",
          description: "Please fill in required fields",
          variant: "destructive",
        });
        return;
      }

      const contactInfo = {
        phone: formData.phone || null,
        email: formData.email || null,
        website: formData.website || null
      };

      const { error } = await supabase
        .from('patient_sources')
        .update({
          name: formData.name,
          type: formData.type,
          color: formData.color,
          contact_info: contactInfo,
          notes: formData.notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingSource.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Patient source updated successfully",
      });

      setEditingSource(null);
      resetForm();
      onSourcesChange();

    } catch (error) {
      console.error('Error updating source:', error);
      toast({
        title: "Error",
        description: "Failed to update patient source",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSource = async (sourceId: string) => {
    try {
      if (!confirm('Are you sure you want to delete this patient source? This will also delete all associated data.')) {
        return;
      }

      const { error } = await supabase
        .from('patient_sources')
        .delete()
        .eq('id', sourceId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Patient source deleted successfully",
      });

      onSourcesChange();

    } catch (error) {
      console.error('Error deleting source:', error);
      toast({
        title: "Error",
        description: "Failed to delete patient source",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (source: PatientSource) => {
    setEditingSource(source);
    setFormData({
      name: source.name,
      type: source.type,
      color: source.color,
      phone: source.contact_info?.phone || '',
      email: source.contact_info?.email || '',
      website: source.contact_info?.website || '',
      notes: source.notes || ''
    });
  };

  const getSourceIcon = (type: string) => {
    const sourceType = SOURCE_TYPES.find(st => st.value === type);
    if (!sourceType) return <MapPin className="w-4 h-4" />;
    
    if (typeof sourceType.icon === 'string') {
      return <span className="w-4 h-4 text-xs font-bold">{sourceType.icon}</span>;
    }
    
    const IconComponent = sourceType.icon;
    return <IconComponent className="w-4 h-4" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Patient Source Management</h2>
          <p className="text-muted-foreground">Manage your patient referral sources</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-teal-600 hover:bg-teal-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Source
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New Patient Source</DialogTitle>
              <DialogDescription>
                Create a new patient referral source to track in your system.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Source Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Downtown Dental"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="type">Type *</Label>
                  <Select value={formData.type} onValueChange={(value) => setFormData(prev => ({ ...prev, type: value as any }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCE_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex gap-2">
                  {COLOR_OPTIONS.map(color => (
                    <button
                      key={color}
                      className={`w-8 h-8 rounded-full border-2 ${
                        formData.color === color ? 'border-gray-900' : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setFormData(prev => ({ ...prev, color }))}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="(555) 123-4567"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="contact@example.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={formData.website}
                  onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                  placeholder="https://example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes about this source..."
                  rows={3}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddSource} className="bg-teal-600 hover:bg-teal-700">
                Add Source
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Sources List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sources.map(source => (
          <Card key={source.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
                    style={{ backgroundColor: source.color }}
                  >
                    {getSourceIcon(source.type)}
                  </div>
                  <div>
                    <CardTitle className="text-base">{source.name}</CardTitle>
                    <Badge variant="outline" className="text-xs mt-1">
                      {SOURCE_TYPES.find(t => t.value === source.type)?.label}
                    </Badge>
                  </div>
                </div>
                
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEditDialog(source)}
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteSource(source.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="pt-0">
              {source.contact_info && (
                <div className="space-y-1 text-sm text-muted-foreground">
                  {source.contact_info.phone && (
                    <p>📞 {source.contact_info.phone}</p>
                  )}
                  {source.contact_info.email && (
                    <p>✉️ {source.contact_info.email}</p>
                  )}
                  {source.contact_info.website && (
                    <p>🌐 {source.contact_info.website}</p>
                  )}
                </div>
              )}
              {source.notes && (
                <p className="text-sm text-muted-foreground mt-2 italic">
                  {source.notes}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingSource} onOpenChange={(open) => !open && setEditingSource(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Patient Source</DialogTitle>
            <DialogDescription>
              Update the details for this patient referral source.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Source Name *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Downtown Dental"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-type">Type *</Label>
                <Select value={formData.type} onValueChange={(value) => setFormData(prev => ({ ...prev, type: value as any }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {COLOR_OPTIONS.map(color => (
                  <button
                    key={color}
                    className={`w-8 h-8 rounded-full border-2 ${
                      formData.color === color ? 'border-gray-900' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData(prev => ({ ...prev, color }))}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="(555) 123-4567"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="contact@example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-website">Website</Label>
              <Input
                id="edit-website"
                value={formData.website}
                onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                placeholder="https://example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes about this source..."
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setEditingSource(null)}>
              Cancel
            </Button>
            <Button onClick={handleEditSource} className="bg-teal-600 hover:bg-teal-700">
              Update Source
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};