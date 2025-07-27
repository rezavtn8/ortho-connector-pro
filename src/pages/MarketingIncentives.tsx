import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ReferringOffice } from '@/lib/database.types';
import { supabase } from '@/integrations/supabase/client';
import { Search, Gift, Mail, Phone, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function MarketingIncentives() {
  const [offices, setOffices] = useState<ReferringOffice[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOffices, setSelectedOffices] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [campaignData, setCampaignData] = useState({
    type: '',
    title: '',
    description: '',
    notes: ''
  });

  useEffect(() => {
    loadOffices();
  }, []);

  const loadOffices = async () => {
    try {
      const { data, error } = await supabase
        .from('referring_offices')
        .select('*')
        .order('name');

      if (error) throw error;
      setOffices(data || []);
    } catch (error) {
      console.error('Error loading offices:', error);
      toast({
        title: "Error",
        description: "Failed to load offices",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredOffices = offices.filter(office =>
    office.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    office.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOfficeSelect = (officeId: string) => {
    setSelectedOffices(prev => 
      prev.includes(officeId) 
        ? prev.filter(id => id !== officeId)
        : [...prev, officeId]
    );
  };

  const handleSendIncentive = async () => {
    if (selectedOffices.length === 0) {
      toast({
        title: "No offices selected",
        description: "Please select at least one office",
        variant: "destructive",
      });
      return;
    }

    try {
      // Log the marketing campaign to engagement logs
      const engagementEntries = selectedOffices.map(officeId => ({
        office_id: officeId,
        interaction_type: campaignData.type,
        notes: `${campaignData.title}: ${campaignData.description}`,
        interaction_date: new Date().toISOString().split('T')[0],
      }));

      const { error } = await supabase
        .from('engagement_logs')
        .insert(engagementEntries);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Marketing incentive sent to ${selectedOffices.length} office(s)`,
      });

      // Reset form
      setCampaignData({ type: '', title: '', description: '', notes: '' });
      setSelectedOffices([]);
    } catch (error) {
      console.error('Error sending incentive:', error);
      toast({
        title: "Error",
        description: "Failed to send marketing incentive",
        variant: "destructive",
      });
    }
  };

  const incentiveTypes = [
    { value: 'Promo/gift drop', label: 'Gift Drop', icon: Gift },
    { value: 'Email', label: 'Email Campaign', icon: Mail },
    { value: 'Call', label: 'Phone Call', icon: Phone },
    { value: 'CE invite', label: 'CE Invitation', icon: Calendar },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Marketing Incentives</h1>
          <p className="text-muted-foreground">
            Send gifts, promotions, and marketing materials to referring offices
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="medical" className="gap-2">
              <Gift className="w-4 h-4" />
              Create Campaign
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Create Marketing Campaign</DialogTitle>
              <DialogDescription>
                Set up a new marketing incentive to send to selected offices.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="type">Campaign Type</Label>
                <Select value={campaignData.type} onValueChange={(value) => setCampaignData({ ...campaignData, type: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select campaign type" />
                  </SelectTrigger>
                  <SelectContent>
                    {incentiveTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Campaign Title</Label>
                <Input
                  id="title"
                  placeholder="e.g., Holiday Gift Package"
                  value={campaignData.title}
                  onChange={(e) => setCampaignData({ ...campaignData, title: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe the marketing material or incentive being sent..."
                  value={campaignData.description}
                  onChange={(e) => setCampaignData({ ...campaignData, description: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Any tracking information or special instructions..."
                  value={campaignData.notes}
                  onChange={(e) => setCampaignData({ ...campaignData, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setCampaignData({ type: '', title: '', description: '', notes: '' })}>
                  Cancel
                </Button>
                <Button variant="medical" onClick={handleSendIncentive}>
                  Send to Selected Offices ({selectedOffices.length})
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search offices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Selected Offices Summary */}
      {selectedOffices.length > 0 && (
        <Card variant="medical">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Selected Offices: {selectedOffices.length}</p>
                <p className="text-sm text-muted-foreground">
                  Ready to send marketing materials
                </p>
              </div>
              <Button 
                variant="outline" 
                onClick={() => setSelectedOffices([])}
                size="sm"
              >
                Clear Selection
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Offices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredOffices.map((office) => (
          <Card 
            key={office.id} 
            className={`cursor-pointer transition-all ${
              selectedOffices.includes(office.id) 
                ? 'ring-2 ring-primary bg-primary/5' 
                : 'hover:shadow-lg'
            }`}
            onClick={() => handleOfficeSelect(office.id)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{office.name}</CardTitle>
                  <CardDescription className="mt-1">
                    {office.address}
                  </CardDescription>
                </div>
                {selectedOffices.includes(office.id) && (
                  <Badge variant="default">Selected</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {office.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{office.phone}</span>
                  </div>
                )}
                {office.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{office.email}</span>
                  </div>
                )}
                <Badge variant="outline" className="mt-2">
                  {office.source}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredOffices.length === 0 && !loading && (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="text-muted-foreground">
              {searchTerm ? 'No offices found matching your search.' : 'No offices available.'}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}