import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useOffices } from '@/hooks/useOffices';
import { cn } from '@/lib/utils';
import { parseDateFromDB } from '@/utils/dateUtils';

interface MarketingVisit {
  id?: string;
  office_id: string;
  visit_date: string;
  visit_type: string;
  rep_name: string;
  visited: boolean;
  contact_person?: string;
  star_rating?: number;
  follow_up_notes?: string;
  materials_handed_out?: string[];
  group_tag?: string;
}

interface MarketingVisitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visit?: MarketingVisit;
  onSuccess: () => void;
}

export function MarketingVisitDialog({ open, onOpenChange, visit, onSuccess }: MarketingVisitDialogProps) {
  const { toast } = useToast();
  const { data: offices = [] } = useOffices();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    office_id: '',
    visit_date: new Date().toISOString().split('T')[0],
    visit_type: 'New Target',
    rep_name: '',
    visited: false,
    contact_person: '',
    star_rating: 0,
    follow_up_notes: '',
    materials_handed_out: [] as string[],
    group_tag: ''
  });

  useEffect(() => {
    if (visit) {
      // Parse the date correctly to avoid timezone issues
      const parsedDate = parseDateFromDB(visit.visit_date);
      const formattedDate = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`;
      
      setFormData({
        office_id: visit.office_id,
        visit_date: formattedDate,
        visit_type: visit.visit_type,
        rep_name: visit.rep_name,
        visited: visit.visited,
        contact_person: visit.contact_person || '',
        star_rating: visit.star_rating || 0,
        follow_up_notes: visit.follow_up_notes || '',
        materials_handed_out: visit.materials_handed_out || [],
        group_tag: visit.group_tag || ''
      });
    } else {
      setFormData({
        office_id: '',
        visit_date: new Date().toISOString().split('T')[0],
        visit_type: 'New Target',
        rep_name: '',
        visited: false,
        contact_person: '',
        star_rating: 0,
        follow_up_notes: '',
        materials_handed_out: [],
        group_tag: ''
      });
    }
  }, [visit, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.office_id || !formData.rep_name) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const visitData = {
        office_id: formData.office_id,
        visit_date: formData.visit_date,
        visit_type: formData.visit_type,
        rep_name: formData.rep_name,
        visited: formData.visited,
        contact_person: formData.contact_person || null,
        star_rating: formData.star_rating > 0 ? formData.star_rating : null,
        follow_up_notes: formData.follow_up_notes || null,
        materials_handed_out: formData.materials_handed_out.length > 0 ? formData.materials_handed_out : null,
        group_tag: formData.group_tag || null,
        user_id: user.id
      };

      if (visit?.id) {
        const { error } = await supabase
          .from('marketing_visits')
          .update(visitData)
          .eq('id', visit.id);

        if (error) throw error;

        toast({
          title: "Visit Updated",
          description: "Marketing visit has been updated successfully"
        });
      } else {
        const { error } = await supabase
          .from('marketing_visits')
          .insert([visitData]);

        if (error) throw error;

        toast({
          title: "Visit Logged",
          description: "Marketing visit has been logged successfully"
        });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving visit:', error);
      toast({
        title: "Error",
        description: "Failed to save marketing visit",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{visit ? 'Edit Visit' : 'Log Marketing Visit'}</DialogTitle>
          <DialogDescription>
            {visit ? 'Update the details of your marketing visit' : 'Record details of your marketing visit'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="office">Office *</Label>
              <Select value={formData.office_id} onValueChange={(value) => setFormData({ ...formData, office_id: value })}>
                <SelectTrigger id="office">
                  <SelectValue placeholder="Select office" />
                </SelectTrigger>
                <SelectContent>
                  {offices.map((office) => (
                    <SelectItem key={office.id} value={office.id}>
                      {office.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="visit_date">Visit Date *</Label>
              <Input
                id="visit_date"
                type="date"
                value={formData.visit_date}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setFormData({ ...formData, visit_date: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="visit_type">Visit Type *</Label>
              <Select value={formData.visit_type} onValueChange={(value) => setFormData({ ...formData, visit_type: value })}>
                <SelectTrigger id="visit_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="New Target">New Target</SelectItem>
                  <SelectItem value="Routine">Routine</SelectItem>
                  <SelectItem value="Reconnect">Reconnect</SelectItem>
                  <SelectItem value="Follow-up">Follow-up</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rep_name">Rep Name *</Label>
              <Input
                id="rep_name"
                value={formData.rep_name}
                onChange={(e) => setFormData({ ...formData, rep_name: e.target.value })}
                placeholder="Enter rep name"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact_person">Contact Person</Label>
              <Input
                id="contact_person"
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                placeholder="Who did you meet?"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="star_rating">Rating (1-5)</Label>
              <Select 
                value={formData.star_rating?.toString() || ''} 
                onValueChange={(value) => setFormData({ ...formData, star_rating: parseInt(value) })}
              >
                <SelectTrigger id="star_rating">
                  <SelectValue placeholder="Select rating" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No Rating</SelectItem>
                  <SelectItem value="1">⭐ 1 Star</SelectItem>
                  <SelectItem value="2">⭐⭐ 2 Stars</SelectItem>
                  <SelectItem value="3">⭐⭐⭐ 3 Stars</SelectItem>
                  <SelectItem value="4">⭐⭐⭐⭐ 4 Stars</SelectItem>
                  <SelectItem value="5">⭐⭐⭐⭐⭐ 5 Stars</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="group_tag">Group/Tag</Label>
            <Input
              id="group_tag"
              value={formData.group_tag}
              onChange={(e) => setFormData({ ...formData, group_tag: e.target.value })}
              placeholder="e.g., High Priority, Northwest Region"
            />
          </div>

          <div className="space-y-2">
            <Label>Materials Handed Out</Label>
            <div className="flex flex-wrap gap-2">
              {['Gift', 'Booklet', 'Referral Slips', 'Business Cards', 'Brochures', 'Samples'].map((material) => (
                <Badge
                  key={material}
                  variant={formData.materials_handed_out.includes(material) ? 'default' : 'outline'}
                  className={cn(
                    "cursor-pointer transition-all hover:scale-105",
                    formData.materials_handed_out.includes(material) && "shadow-sm"
                  )}
                  onClick={() => {
                    const isSelected = formData.materials_handed_out.includes(material);
                    setFormData(prev => ({
                      ...prev,
                      materials_handed_out: isSelected
                        ? prev.materials_handed_out.filter(m => m !== material)
                        : [...prev.materials_handed_out, material]
                    }));
                  }}
                >
                  {material}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="follow_up_notes">Notes</Label>
            <Textarea
              id="follow_up_notes"
              value={formData.follow_up_notes}
              onChange={(e) => setFormData({ ...formData, follow_up_notes: e.target.value })}
              placeholder="Any notes or follow-up items..."
              rows={4}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="visited"
              checked={formData.visited}
              onCheckedChange={(checked) => setFormData({ ...formData, visited: checked })}
            />
            <Label htmlFor="visited" className="cursor-pointer">
              Mark as completed visit
            </Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {visit ? 'Update Visit' : 'Log Visit'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
