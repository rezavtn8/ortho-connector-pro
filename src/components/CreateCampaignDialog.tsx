import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EnhancedDatePicker } from '@/components/EnhancedDatePicker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { CalendarIcon, X, Users } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { sanitizeText } from '@/lib/sanitize';

interface Office {
  id: string;
  name: string;
  address?: string;
  source_type: string;
}

interface CreateCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCampaignCreated: () => void;
}

const CAMPAIGN_TYPES = [
  'Intro Package',
  'Mug Drop', 
  'Lunch Drop',
  'CE Invite Pack',
  'Monthly Promo Pack',
  'Holiday Card Drop',
  'Educational Material Drop'
];

const DELIVERY_METHODS = [
  'In-Person',
  'USPS',
  'Courier'
];

const DEFAULT_MATERIALS: Record<string, string[]> = {
  'Intro Package': ['Welcome folder', 'Referral pads', 'Business cards', 'Clinic brochure'],
  'Mug Drop': ['Branded mugs', 'Thank you notes', 'Business cards'],
  'Lunch Drop': ['Catered lunch', 'Presentation materials', 'Thank you cards'],
  'CE Invite Pack': ['CE course flyers', 'Registration forms', 'Clinic information'],
  'Monthly Promo Pack': ['Promotional items', 'Referral incentive cards', 'Contact information'],
  'Holiday Card Drop': ['Holiday cards', 'Small gift items', 'Business cards'],
  'Educational Material Drop': ['Educational posters', 'Post-procedure flyers', 'Contact cards']
};

export function CreateCampaignDialog({ open, onOpenChange, onCampaignCreated }: CreateCampaignDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const createCampaignMutation = useCreateCampaign();
  
  const [formData, setFormData] = useState({
    name: '',
    campaign_type: '',
    delivery_method: '',
    assigned_rep_id: '',
    planned_delivery_date: null as Date | null,
    notes: ''
  });
  
  const [materials, setMaterials] = useState<string[]>([]);
  const [newMaterial, setNewMaterial] = useState('');
  const [offices, setOffices] = useState<Office[]>([]);
  const [selectedOffices, setSelectedOffices] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingOffices, setLoadingOffices] = useState(true);

  // Fetch offices
  useEffect(() => {
    let isMounted = true;
    
    const fetchOffices = async () => {
      if (!user) return;

      try {
        setLoadingOffices(true);
        const { data, error } = await supabase
          .from('patient_sources')
          .select('id, name, address, source_type')
          .eq('created_by', user.id)
          .eq('is_active', true)
          .order('name');

        if (error) throw error;
        
        if (isMounted) {
          setOffices(data || []);
        }
      } catch (error) {
        console.error('Error fetching offices:', error);
        if (isMounted) {
          toast({
            title: "Error",
            description: "Failed to load offices.",
            variant: "destructive",
          });
        }
      } finally {
        if (isMounted) {
          setLoadingOffices(false);
        }
      }
    };

    if (open) {
      fetchOffices();
    }
    
    return () => {
      isMounted = false;
    };
  }, [open, user, toast]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setFormData({
        name: '',
        campaign_type: '',
        delivery_method: '',
        assigned_rep_id: '',
        planned_delivery_date: null,
        notes: ''
      });
      setMaterials([]);
      setSelectedOffices([]);
    }
  }, [open]);

  // Update materials when campaign type changes
  useEffect(() => {
    if (formData.campaign_type && DEFAULT_MATERIALS[formData.campaign_type]) {
      setMaterials(DEFAULT_MATERIALS[formData.campaign_type]);
    }
  }, [formData.campaign_type]);

  const handleInputChange = (field: string, value: string | Date | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddMaterial = () => {
    if (newMaterial.trim() && !materials.includes(newMaterial.trim())) {
      setMaterials(prev => [...prev, newMaterial.trim()]);
      setNewMaterial('');
    }
  };

  const handleRemoveMaterial = (index: number) => {
    setMaterials(prev => prev.filter((_, i) => i !== index));
  };

  const handleOfficeSelection = (officeId: string, checked: boolean) => {
    if (checked) {
      setSelectedOffices(prev => [...prev, officeId]);
    } else {
      setSelectedOffices(prev => prev.filter(id => id !== officeId));
    }
  };

  const handleSubmit = async () => {
    if (!user) return;

    // Sanitize form inputs
    const sanitizedName = sanitizeText(formData.name);
    const sanitizedNotes = sanitizeText(formData.notes);

    if (!sanitizedName || !formData.campaign_type || !formData.delivery_method || selectedOffices.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields and select at least one office.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // Create campaign
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .insert({
          name: sanitizedName,
          campaign_type: formData.campaign_type,
          delivery_method: formData.delivery_method,
          assigned_rep_id: formData.assigned_rep_id || null,
          materials_checklist: materials,
          planned_delivery_date: formData.planned_delivery_date?.toISOString().split('T')[0] || null,
          notes: sanitizedNotes,
          created_by: user.id
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Create campaign deliveries for selected offices
      const deliveries = selectedOffices.map(officeId => ({
        campaign_id: campaign.id,
        office_id: officeId,
        created_by: user.id
      }));

      const { error: deliveriesError } = await supabase
        .from('campaign_deliveries')
        .insert(deliveries);

      if (deliveriesError) throw deliveriesError;

      onCampaignCreated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating campaign:', error);
      toast({
        title: "Error",
        description: "Failed to create campaign.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Campaign</DialogTitle>
          <DialogDescription>
            Plan a new outreach campaign to dental offices in your network.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-4">
            {/* Campaign Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Campaign Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="e.g., Q1 Intro Package Campaign"
              />
            </div>

            {/* Campaign Type */}
            <div className="space-y-2">
              <Label htmlFor="campaign_type">Campaign Type *</Label>
              <Select value={formData.campaign_type} onValueChange={(value) => handleInputChange('campaign_type', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select campaign type" />
                </SelectTrigger>
                <SelectContent>
                  {CAMPAIGN_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Delivery Method */}
            <div className="space-y-2">
              <Label htmlFor="delivery_method">Delivery Method *</Label>
              <Select value={formData.delivery_method} onValueChange={(value) => handleInputChange('delivery_method', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select delivery method" />
                </SelectTrigger>
                <SelectContent>
                  {DELIVERY_METHODS.map((method) => (
                    <SelectItem key={method} value={method}>{method}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Planned Delivery Date */}
            <div className="space-y-2">
              <Label>Planned Delivery Date</Label>
              <EnhancedDatePicker
                value={formData.planned_delivery_date}
                onChange={(date) => handleInputChange('planned_delivery_date', date)}
                placeholder="Select delivery date"
                minDate={new Date()}
                withTime={false}
                presets={true}
              />
            </div>

            {/* Materials Checklist */}
            <div className="space-y-2">
              <Label>Materials Checklist</Label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={newMaterial}
                    onChange={(e) => setNewMaterial(e.target.value)}
                    placeholder="Add material item..."
                    onKeyPress={(e) => e.key === 'Enter' && handleAddMaterial()}
                  />
                  <Button type="button" onClick={handleAddMaterial} variant="outline">
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {materials.map((material, index) => (
                    <div key={index} className="flex items-center gap-1 bg-secondary px-2 py-1 rounded text-sm">
                      <span>{material}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveMaterial(index)}
                        className="h-4 w-4 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Additional instructions or notes..."
                rows={3}
              />
            </div>
          </div>

          {/* Right Column - Target Offices */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              <Label>Target Offices * ({selectedOffices.length} selected)</Label>
            </div>
            
            {loadingOffices ? (
              <div className="text-center py-8">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">Loading offices...</p>
              </div>
            ) : (
              <div className="border rounded-md max-h-96 overflow-y-auto">
                {offices.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No offices found. Create some offices first.</p>
                  </div>
                ) : (
                  <div className="space-y-2 p-4">
                    {offices.map((office) => (
                      <div key={office.id} className="flex items-start space-x-3">
                        <Checkbox
                          id={office.id}
                          checked={selectedOffices.includes(office.id)}
                          onCheckedChange={(checked) => handleOfficeSelection(office.id, checked as boolean)}
                        />
                        <div className="flex-1 min-w-0">
                          <Label htmlFor={office.id} className="cursor-pointer">
                            <div className="font-medium">{office.name}</div>
                            {office.address && (
                              <div className="text-sm text-muted-foreground truncate">{office.address}</div>
                            )}
                            <div className="text-xs text-muted-foreground">{office.source_type}</div>
                          </Label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={createCampaignMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createCampaignMutation.isPending}>
            {createCampaignMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Campaign'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}