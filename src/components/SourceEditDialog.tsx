import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { PatientSource } from '@/lib/database.types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AddressSearch } from '@/components/AddressSearch';
import { Edit, Save, X } from 'lucide-react';

interface SourceEditDialogProps {
  source: PatientSource;
  onUpdate: () => void;
  trigger?: React.ReactNode;
}

export function SourceEditDialog({ source, onUpdate, trigger }: SourceEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    notes: '',
    latitude: null as number | null,
    longitude: null as number | null
  });
  const { toast } = useToast();

  useEffect(() => {
    if (source) {
      setEditForm({
        name: source.name || '',
        address: source.address || '',
        phone: source.phone || '',
        email: source.email || '',
        website: source.website || '',
        notes: source.notes || '',
        latitude: source.latitude,
        longitude: source.longitude
      });
    }
  }, [source]);

  const handleSave = async () => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('patient_sources')
        .update({
          name: editForm.name,
          address: editForm.address,
          phone: editForm.phone,
          email: editForm.email,
          website: editForm.website,
          notes: editForm.notes,
          latitude: editForm.latitude,
          longitude: editForm.longitude
        })
        .eq('id', source.id);

      if (error) throw error;

      // Log the activity
      await supabase.rpc('log_activity', {
        p_action_type: 'source_updated',
        p_resource_type: 'source',
        p_resource_id: source.id,
        p_resource_name: editForm.name,
        p_details: {
          updated_fields: {
            name: editForm.name !== source?.name,
            address: editForm.address !== source?.address,
            phone: editForm.phone !== source?.phone,
            email: editForm.email !== source?.email,
            website: editForm.website !== source?.website,
            notes: editForm.notes !== source?.notes
          }
        }
      });

      setOpen(false);
      await onUpdate();

      toast({
        title: "Source Updated",
        description: "Source details have been updated successfully",
      });
    } catch (error) {
      console.error('Error updating source:', error);
      toast({
        title: "Error",
        description: "Failed to update source details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    // Reset form to original source data
    if (source) {
      setEditForm({
        name: source.name || '',
        address: source.address || '',
        phone: source.phone || '',
        email: source.email || '',
        website: source.website || '',
        notes: source.notes || '',
        latitude: source.latitude,
        longitude: source.longitude
      });
    }
    setOpen(false);
  };

  const handleAddressSelect = (office: any) => {
    if (office) {
      setEditForm(prev => ({
        ...prev,
        name: office.name,
        address: office.address || '',
        latitude: office.latitude,
        longitude: office.longitude
      }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Edit className="w-4 h-4 mr-2" />
            Edit Details
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Source Details</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Source Name</Label>
              <Input
                id="name"
                value={editForm.name}
                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter source name"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={editForm.address}
                onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Enter address manually"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={editForm.phone}
                  onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="Phone number"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Email address"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={editForm.website}
                onChange={(e) => setEditForm(prev => ({ ...prev, website: e.target.value }))}
                placeholder="Website URL"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={editForm.notes}
                onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes"
                rows={3}
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading || !editForm.name.trim()}
            >
              <Save className="w-4 h-4 mr-2" />
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}