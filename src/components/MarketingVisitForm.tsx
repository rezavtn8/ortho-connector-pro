import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { X, CalendarIcon, Star } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { MarketingVisit, VisitType, MarketingMaterial, VISIT_TYPE_OPTIONS, MARKETING_MATERIALS } from '@/lib/database.types';

interface MarketingVisitFormProps {
  visit?: MarketingVisit | null;
  officeId: string;
  officeName: string;
  onSubmit: (visitData: Partial<MarketingVisit>) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function MarketingVisitForm({ 
  visit, 
  officeId, 
  officeName, 
  onSubmit, 
  onCancel, 
  isLoading = false 
}: MarketingVisitFormProps) {
  const [formData, setFormData] = useState<Partial<MarketingVisit>>({
    office_id: officeId,
    visit_date: visit?.visit_date || new Date().toISOString().split('T')[0],
    visit_type: visit?.visit_type || 'New Target',
    group_tag: visit?.group_tag || '',
    contact_person: visit?.contact_person || '',
    visited: visit?.visited || false,
    rep_name: visit?.rep_name || '',
    materials_handed_out: visit?.materials_handed_out || [],
    star_rating: visit?.star_rating || undefined,
    follow_up_notes: visit?.follow_up_notes || '',
  });

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    visit?.visit_date ? new Date(visit.visit_date) : new Date()
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      ...formData,
      visit_date: selectedDate?.toISOString().split('T')[0] || formData.visit_date,
    });
  };

  const toggleMaterial = (material: MarketingMaterial) => {
    const currentMaterials = formData.materials_handed_out || [];
    const newMaterials = currentMaterials.includes(material)
      ? currentMaterials.filter(m => m !== material)
      : [...currentMaterials, material];
    
    setFormData({ ...formData, materials_handed_out: newMaterials });
  };

  const StarRating = ({ rating, onChange }: { rating?: number; onChange: (rating: number) => void }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className="focus:outline-none"
        >
          <Star
            className={cn(
              "w-6 h-6 transition-colors",
              rating && star <= rating
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground hover:text-yellow-400"
            )}
          />
        </button>
      ))}
    </div>
  );

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>{visit ? 'Edit' : 'Add'} Marketing Visit</CardTitle>
        <CardDescription>
          {visit ? 'Update' : 'Record'} visit details for {officeName}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Visit Date */}
          <div className="space-y-2">
            <Label htmlFor="visit_date">Visit Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-background border z-50" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Visit Type */}
          <div className="space-y-2">
            <Label htmlFor="visit_type">Visit Type</Label>
            <Select value={formData.visit_type} onValueChange={(value: VisitType) => setFormData({ ...formData, visit_type: value })}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Select visit type" />
              </SelectTrigger>
              <SelectContent className="bg-background border z-50">
                {VISIT_TYPE_OPTIONS.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Group Tag & Contact Person */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="group_tag">Group Tag (Optional)</Label>
              <Input
                id="group_tag"
                placeholder="e.g., Q1 2025, Specialty Group"
                value={formData.group_tag || ''}
                onChange={(e) => setFormData({ ...formData, group_tag: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_person">Contact Person</Label>
              <Input
                id="contact_person"
                placeholder="Name of person met"
                value={formData.contact_person || ''}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
              />
            </div>
          </div>

          {/* Rep Name & Visited Checkbox */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rep_name">Rep Name</Label>
              <Input
                id="rep_name"
                placeholder="Your name"
                value={formData.rep_name}
                onChange={(e) => setFormData({ ...formData, rep_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Visit Status
              </Label>
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="visited"
                  checked={formData.visited}
                  onCheckedChange={(checked) => setFormData({ ...formData, visited: !!checked })}
                />
                <Label htmlFor="visited" className="text-sm">
                  Visit Completed
                </Label>
              </div>
            </div>
          </div>

          {/* Materials Handed Out */}
          <div className="space-y-2">
            <Label>Materials Handed Out</Label>
            <div className="flex flex-wrap gap-2">
              {MARKETING_MATERIALS.map((material) => {
                const isSelected = formData.materials_handed_out?.includes(material);
                return (
                  <Badge
                    key={material}
                    variant={isSelected ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer transition-colors",
                      isSelected && "bg-primary text-primary-foreground"
                    )}
                    onClick={() => toggleMaterial(material)}
                  >
                    {material}
                    {isSelected && <X className="w-3 h-3 ml-1" />}
                  </Badge>
                );
              })}
            </div>
          </div>

          {/* Star Rating */}
          <div className="space-y-2">
            <Label>Star Rating</Label>
            <StarRating
              rating={formData.star_rating || undefined}
              onChange={(rating) => setFormData({ ...formData, star_rating: rating })}
            />
          </div>

          {/* Follow-up Notes */}
          <div className="space-y-2">
            <Label htmlFor="follow_up_notes">Follow-up Notes</Label>
            <Textarea
              id="follow_up_notes"
              placeholder="Key points discussed, next steps, concerns..."
              rows={3}
              value={formData.follow_up_notes || ''}
              onChange={(e) => setFormData({ ...formData, follow_up_notes: e.target.value })}
            />
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? 'Saving...' : (visit ? 'Update Visit' : 'Save Visit')}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}