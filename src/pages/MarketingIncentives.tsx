import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ReferringOffice, MarketingIncentive as MarketingIncentiveType } from '@/lib/database.types';
import { supabase } from '@/integrations/supabase/client';
import { 
  Search, 
  Gift, 
  Mail, 
  Phone, 
  Calendar as CalendarIcon,
  Package, 
  Star,
  Clock,
  TrendingUp,
  Filter,
  Plus,
  Edit,
  Trash2,
  Send
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

// Using the type from database.types.ts

interface OfficeStats {
  referralCount: number;
  activityScore: 'Strong' | 'Moderate' | 'Sporadic' | 'Cold';
  lastReferralDate?: string;
  lastIncentiveDate?: string;
  lastIncentiveType?: string;
}

export function MarketingIncentives() {
  const [offices, setOffices] = useState<ReferringOffice[]>([]);
  const [selectedOffice, setSelectedOffice] = useState<ReferringOffice | null>(null);
  const [officeStats, setOfficeStats] = useState<OfficeStats | null>(null);
  const [incentives, setIncentives] = useState<MarketingIncentiveType[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDateRange, setFilterDateRange] = useState<string>('all');
  const [showSendDialog, setShowSendDialog] = useState(false);
  const { toast } = useToast();

  const [incentiveForm, setIncentiveForm] = useState<{
    incentive_type: string;
    title: string;
    description: string;
    personalized_message: string;
    assigned_staff: string;
    status: 'Planned' | 'Sent' | 'Delivered' | 'Cancelled';
    delivery_method: string;
    scheduled_date: Date | undefined;
    cost_amount: string;
    notes: string;
  }>({
    incentive_type: '',
    title: '',
    description: '',
    personalized_message: '',
    assigned_staff: '',
    status: 'Planned',
    delivery_method: '',
    scheduled_date: undefined,
    cost_amount: '',
    notes: ''
  });

  useEffect(() => {
    loadOffices();
  }, []);

  useEffect(() => {
    if (selectedOffice) {
      loadOfficeStats(selectedOffice.id);
      loadIncentives(selectedOffice.id);
    }
  }, [selectedOffice]);

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

  const loadOfficeStats = async (officeId: string) => {
    try {
      // Get referral data
      const { data: referralData, error: referralError } = await supabase
        .from('referral_data')
        .select('referral_count, month_year')
        .eq('office_id', officeId)
        .order('month_year', { ascending: false });

      if (referralError) throw referralError;

      // Calculate stats
      const totalReferrals = referralData?.reduce((sum, item) => sum + item.referral_count, 0) || 0;
      const recentReferrals = referralData?.slice(0, 3).reduce((sum, item) => sum + item.referral_count, 0) || 0;
      const lastReferralDate = referralData?.[0]?.month_year;

      // Get activity score using the database function
      const { data: scoreData, error: scoreError } = await supabase
        .rpc('calculate_office_score', { office_id_param: officeId });

      if (scoreError) throw scoreError;

      // Get last incentive
      const { data: lastIncentive, error: incentiveError } = await supabase
        .from('marketing_incentives')
        .select('actual_sent_date, incentive_type, created_at')
        .eq('office_id', officeId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (incentiveError) throw incentiveError;

      setOfficeStats({
        referralCount: totalReferrals,
        activityScore: scoreData as 'Strong' | 'Moderate' | 'Sporadic' | 'Cold',
        lastReferralDate,
        lastIncentiveDate: lastIncentive?.actual_sent_date || lastIncentive?.created_at,
        lastIncentiveType: lastIncentive?.incentive_type
      });

    } catch (error) {
      console.error('Error loading office stats:', error);
    }
  };

  const loadIncentives = async (officeId: string) => {
    try {
      const { data, error } = await supabase
        .from('marketing_incentives')
        .select('*')
        .eq('office_id', officeId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setIncentives((data || []) as MarketingIncentiveType[]);
    } catch (error) {
      console.error('Error loading incentives:', error);
    }
  };

  const handleSendIncentive = async () => {
    if (!selectedOffice) return;

    try {
      const incentiveData = {
        office_id: selectedOffice.id,
        incentive_type: incentiveForm.incentive_type,
        title: incentiveForm.title,
        description: incentiveForm.description,
        personalized_message: incentiveForm.personalized_message,
        assigned_staff: incentiveForm.assigned_staff,
        status: incentiveForm.status,
        delivery_method: incentiveForm.delivery_method,
        scheduled_date: incentiveForm.scheduled_date?.toISOString().split('T')[0],
        cost_amount: incentiveForm.cost_amount ? parseFloat(incentiveForm.cost_amount) : null,
        notes: incentiveForm.notes,
        actual_sent_date: (incentiveForm.status === 'Sent' || incentiveForm.status === 'Delivered') 
          ? new Date().toISOString().split('T')[0] 
          : null
      };

      const { error } = await supabase
        .from('marketing_incentives')
        .insert(incentiveData);

      if (error) throw error;

      // Also log in engagement logs for tracking
      const { error: engagementError } = await supabase
        .from('engagement_logs')
        .insert({
          office_id: selectedOffice.id,
          interaction_type: incentiveForm.incentive_type,
          notes: `${incentiveForm.title}: ${incentiveForm.description}`,
          interaction_date: new Date().toISOString().split('T')[0],
        });

      if (engagementError) console.warn('Failed to log engagement:', engagementError);

      toast({
        title: "Success",
        description: "Marketing incentive created successfully",
      });

      // Reset form and refresh data
      setIncentiveForm({
        incentive_type: '',
        title: '',
        description: '',
        personalized_message: '',
        assigned_staff: '',
        status: 'Planned',
        delivery_method: '',
        scheduled_date: undefined,
        cost_amount: '',
        notes: ''
      });
      setShowSendDialog(false);
      loadIncentives(selectedOffice.id);
      loadOfficeStats(selectedOffice.id);

    } catch (error) {
      console.error('Error creating incentive:', error);
      toast({
        title: "Error",
        description: "Failed to create marketing incentive",
        variant: "destructive",
      });
    }
  };

  const updateIncentiveStatus = async (incentiveId: string, newStatus: string) => {
    try {
      const updateData: any = { status: newStatus };
      if (newStatus === 'Sent' || newStatus === 'Delivered') {
        updateData.actual_sent_date = new Date().toISOString().split('T')[0];
      }

      const { error } = await supabase
        .from('marketing_incentives')
        .update(updateData)
        .eq('id', incentiveId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Status updated successfully",
      });

      if (selectedOffice) {
        loadIncentives(selectedOffice.id);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    }
  };

  const incentiveTypes = [
    { value: 'Mug', label: 'Coffee Mug', icon: Gift },
    { value: 'Gift Card', label: 'Gift Card', icon: Package },
    { value: 'Custom Letter', label: 'Custom Letter', icon: Mail },
    { value: 'CE Invite', label: 'CE Invitation', icon: CalendarIcon },
    { value: 'Seasonal Gift', label: 'Seasonal Gift', icon: Gift },
    { value: 'Lunch & Learn', label: 'Lunch & Learn', icon: TrendingUp },
    { value: 'Other', label: 'Other', icon: Package },
  ];

  const staffMembers = [
    'Dr. Smith',
    'Dr. Johnson', 
    'Marketing Team',
    'Office Manager',
    'Business Development'
  ];

  const filteredOffices = offices.filter(office =>
    office.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    office.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredIncentives = incentives.filter(incentive => {
    if (filterStatus !== 'all' && incentive.status !== filterStatus) return false;
    if (filterDateRange !== 'all') {
      const createdDate = new Date(incentive.created_at);
      const now = new Date();
      const daysAgo = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
      
      switch (filterDateRange) {
        case '7': return daysAgo <= 7;
        case '30': return daysAgo <= 30;
        case '90': return daysAgo <= 90;
        default: return true;
      }
    }
    return true;
  });

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
            Manage and track marketing materials sent to referring offices
          </p>
        </div>
        <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
          <DialogTrigger asChild>
            <Button variant="medical" className="gap-2" disabled={!selectedOffice}>
              <Send className="w-4 h-4" />
              Send Incentive
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Send Marketing Incentive</DialogTitle>
              <DialogDescription>
                Create and send a marketing incentive to {selectedOffice?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="incentive_type">Incentive Type *</Label>
                  <Select value={incentiveForm.incentive_type} onValueChange={(value) => setIncentiveForm({ ...incentiveForm, incentive_type: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
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
                  <Label htmlFor="status">Status *</Label>
                  <Select value={incentiveForm.status} onValueChange={(value: any) => setIncentiveForm({ ...incentiveForm, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Planned">Planned</SelectItem>
                      <SelectItem value="Sent">Sent</SelectItem>
                      <SelectItem value="Delivered">Delivered</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Holiday Gift Package"
                  value={incentiveForm.title}
                  onChange={(e) => setIncentiveForm({ ...incentiveForm, title: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe the incentive being sent..."
                  value={incentiveForm.description}
                  onChange={(e) => setIncentiveForm({ ...incentiveForm, description: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="personalized_message">Personalized Message</Label>
                <Textarea
                  id="personalized_message"
                  placeholder="Add a personal touch to this incentive..."
                  value={incentiveForm.personalized_message}
                  onChange={(e) => setIncentiveForm({ ...incentiveForm, personalized_message: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="assigned_staff">Assigned Staff</Label>
                  <Select value={incentiveForm.assigned_staff} onValueChange={(value) => setIncentiveForm({ ...incentiveForm, assigned_staff: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select staff member" />
                    </SelectTrigger>
                    <SelectContent>
                      {staffMembers.map((staff) => (
                        <SelectItem key={staff} value={staff}>
                          {staff}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="delivery_method">Delivery Method</Label>
                  <Select value={incentiveForm.delivery_method} onValueChange={(value) => setIncentiveForm({ ...incentiveForm, delivery_method: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="In-person">In-person</SelectItem>
                      <SelectItem value="Mail">Mail</SelectItem>
                      <SelectItem value="Email">Email</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Scheduled Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !incentiveForm.scheduled_date && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {incentiveForm.scheduled_date ? format(incentiveForm.scheduled_date, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={incentiveForm.scheduled_date}
                        onSelect={(date) => setIncentiveForm({ ...incentiveForm, scheduled_date: date })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cost_amount">Cost Amount ($)</Label>
                  <Input
                    id="cost_amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={incentiveForm.cost_amount}
                    onChange={(e) => setIncentiveForm({ ...incentiveForm, cost_amount: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Any additional notes or tracking information..."
                  value={incentiveForm.notes}
                  onChange={(e) => setIncentiveForm({ ...incentiveForm, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowSendDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  variant="medical" 
                  onClick={handleSendIncentive}
                  disabled={!incentiveForm.incentive_type || !incentiveForm.title}
                >
                  Create Incentive
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Office Selector */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Select Office</CardTitle>
              <CardDescription>Choose an office to manage incentives</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search offices..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="max-h-96 overflow-y-auto space-y-2">
                {filteredOffices.map((office) => (
                  <Card
                    key={office.id}
                    className={cn(
                      "cursor-pointer transition-all hover:shadow-md",
                      selectedOffice?.id === office.id && "ring-2 ring-primary bg-primary/5"
                    )}
                    onClick={() => setSelectedOffice(office)}
                  >
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">{office.name}</h4>
                        <p className="text-xs text-muted-foreground">{office.address}</p>
                        {office.phone && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="w-3 h-3" />
                            {office.phone}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {selectedOffice ? (
            <>
              {/* Office Profile Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{selectedOffice.name}</span>
                    <Badge variant={
                      officeStats?.activityScore === 'Strong' ? 'default' :
                      officeStats?.activityScore === 'Moderate' ? 'secondary' :
                      officeStats?.activityScore === 'Sporadic' ? 'outline' : 'destructive'
                    }>
                      {officeStats?.activityScore || 'Unknown'}
                    </Badge>
                  </CardTitle>
                  <CardDescription>{selectedOffice.address}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">{officeStats?.referralCount || 0}</div>
                      <div className="text-sm text-muted-foreground">Total Referrals</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-secondary">{officeStats?.lastReferralDate ? format(new Date(officeStats.lastReferralDate), 'MMM yyyy') : 'None'}</div>
                      <div className="text-sm text-muted-foreground">Last Referral</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-accent">{officeStats?.lastIncentiveDate ? format(new Date(officeStats.lastIncentiveDate), 'MMM dd') : 'None'}</div>
                      <div className="text-sm text-muted-foreground">Last Incentive</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-medium text-muted-foreground">{officeStats?.lastIncentiveType || 'None'}</div>
                      <div className="text-sm text-muted-foreground">Last Type</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Incentive History */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Incentive History</CardTitle>
                      <CardDescription>Track all marketing materials sent to this office</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="Planned">Planned</SelectItem>
                          <SelectItem value="Sent">Sent</SelectItem>
                          <SelectItem value="Delivered">Delivered</SelectItem>
                          <SelectItem value="Cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={filterDateRange} onValueChange={setFilterDateRange}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Time</SelectItem>
                          <SelectItem value="7">Last 7 days</SelectItem>
                          <SelectItem value="30">Last 30 days</SelectItem>
                          <SelectItem value="90">Last 90 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {filteredIncentives.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Staff</TableHead>
                          <TableHead>Cost</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredIncentives.map((incentive) => (
                          <TableRow key={incentive.id}>
                            <TableCell>
                              {format(new Date(incentive.created_at), 'MMM dd, yyyy')}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{incentive.incentive_type}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">{incentive.title}</TableCell>
                            <TableCell>
                              <Badge variant={
                                incentive.status === 'Delivered' ? 'default' :
                                incentive.status === 'Sent' ? 'secondary' :
                                incentive.status === 'Planned' ? 'outline' : 'destructive'
                              }>
                                {incentive.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{incentive.delivery_method || '-'}</TableCell>
                            <TableCell>{incentive.assigned_staff || '-'}</TableCell>
                            <TableCell>{incentive.cost_amount ? `$${incentive.cost_amount}` : '-'}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {incentive.status === 'Planned' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateIncentiveStatus(incentive.id, 'Sent')}
                                  >
                                    Mark Sent
                                  </Button>
                                )}
                                {incentive.status === 'Sent' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateIncentiveStatus(incentive.id, 'Delivered')}
                                  >
                                    Mark Delivered
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No incentives found for this office</p>
                      <p className="text-sm">Start by sending your first marketing incentive</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Gift className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium mb-2">Select an Office</h3>
                <p className="text-muted-foreground">
                  Choose an office from the list to view and manage their marketing incentives
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}