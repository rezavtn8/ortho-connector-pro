import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, Clock, MapPin, Phone, Mail, Globe, Edit, Trash2, Star, Plus, Save, X, ArrowLeft, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ReferringOffice, OfficeTag, ReferralData, OfficeScore } from '@/lib/database.types';

interface MarketingVisit {
  id: string;
  office_id: string;
  visit_date: string;
  visit_time?: string;
  visit_group?: string;
  visited: boolean;
  visited_by?: string;
  approach_used?: string[];
  rating?: number;
  notes?: string;
  created_at: string;
}

interface NewVisit {
  visit_date: string;
  visit_time: string;
  visit_group: string;
  visited_by: string;
  approach_used: string[];
  rating: number;
  notes: string;
}

export default function OfficeProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [office, setOffice] = useState<ReferringOffice | null>(null);
  const [tags, setTags] = useState<OfficeTag[]>([]);
  const [referralData, setReferralData] = useState<ReferralData[]>([]);
  const [visits, setVisits] = useState<MarketingVisit[]>([]);
  const [score, setScore] = useState<OfficeScore>('Cold');
  const [loading, setLoading] = useState(true);
  const [editingReferrals, setEditingReferrals] = useState<{ [key: string]: number }>({});
  const [showAddVisit, setShowAddVisit] = useState(false);
  const [visitFilter, setVisitFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date-desc');
  const [newVisit, setNewVisit] = useState<NewVisit>({
    visit_date: new Date().toISOString().split('T')[0],
    visit_time: '',
    visit_group: 'New Target',
    visited_by: '',
    approach_used: [],
    rating: 5,
    notes: ''
  });

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const teamMembers = ['Dr. Smith', 'Dr. Jones', 'Sarah (Front Desk)', 'Mike (Marketing)'];
  const approachOptions = ['Booklet', 'Referral Slips', 'Gift', 'Lunch Meeting', 'Phone Call', 'Email'];

  useEffect(() => {
    if (id) {
      fetchOfficeData();
    }
  }, [id]);

  const fetchOfficeData = async () => {
    try {
      setLoading(true);

      // Fetch office data
      const { data: officeData, error: officeError } = await supabase
        .from('referring_offices')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (officeError) throw officeError;
      
      if (!officeData) {
        toast({
          title: "Office not found",
          description: "The requested office could not be found.",
          variant: "destructive",
        });
        navigate('/offices');
        return;
      }
      
      setOffice(officeData);

      // Fetch tags
      const { data: tagsData } = await supabase
        .from('office_tags')
        .select('*')
        .eq('office_id', id);
      setTags(tagsData || []);

      // Fetch referral data
      const { data: referralDataRes } = await supabase
        .from('referral_data')
        .select('*')
        .eq('office_id', id)
        .order('month_year', { ascending: false });
      setReferralData(referralDataRes || []);

      // Fetch marketing visits
      const { data: visitsData } = await supabase
        .from('marketing_visits')
        .select('*')
        .eq('office_id', id)
        .order('visit_date', { ascending: false });
      setVisits(visitsData || []);

      // Calculate score
      const { data: scoreData } = await supabase.rpc('calculate_office_score', {
        office_id_param: id
      });
      setScore((scoreData as OfficeScore) || 'Cold');

    } catch (error) {
      console.error('Error fetching office data:', error);
      toast({
        title: "Error",
        description: "Failed to load office data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReferralEdit = async (monthYear: string, newCount: number) => {
    try {
      const { error } = await supabase
        .from('referral_data')
        .upsert({
          office_id: id,
          month_year: monthYear,
          referral_count: newCount
        });

      if (error) throw error;

      await fetchOfficeData();
      setEditingReferrals({});
      toast({
        title: "Success",
        description: "Referral count updated",
      });
    } catch (error) {
      console.error('Error updating referral:', error);
      toast({
        title: "Error",
        description: "Failed to update referral count",
        variant: "destructive",
      });
    }
  };

  const addNewVisit = async (visitData: Partial<MarketingVisit>) => {
    try {
      const { error } = await supabase
        .from('marketing_visits')
        .insert({
          office_id: id,
          ...visitData
        });

      if (error) throw error;

      await fetchOfficeData();
      setShowAddVisit(false);
      toast({
        title: "Success",
        description: "Visit added successfully",
      });
    } catch (error) {
      console.error('Error adding visit:', error);
      toast({
        title: "Error",
        description: "Failed to add visit",
        variant: "destructive",
      });
    }
  };

  const getScoreBadgeVariant = (score: OfficeScore) => {
    switch (score) {
      case 'Strong': return 'success';
      case 'Moderate': return 'warning';
      case 'Sporadic': return 'info';
      case 'Cold': return 'destructive';
      default: return 'outline';
    }
  };

  const openInGoogleMaps = () => {
    if (office?.address) {
      const encodedAddress = encodeURIComponent(office.address);
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
    }
  };

  const getReferralCountForMonth = (year: number, month: number) => {
    const monthYear = `${year}-${month.toString().padStart(2, '0')}-01`;
    const data = referralData.find(r => r.month_year.startsWith(monthYear));
    return data?.referral_count || 0;
  };

  const getTotalReferrals = () => {
    return referralData.reduce((sum, data) => sum + data.referral_count, 0);
  };

  const getLastReferralDate = () => {
    const lastReferral = referralData.find(r => r.referral_count > 0);
    return lastReferral ? new Date(lastReferral.month_year).toLocaleDateString() : 'Never';
  };

  const filteredAndSortedVisits = visits
    .filter(visit => {
      if (visitFilter === 'visited') return visit.visited;
      if (visitFilter === 'not-visited') return !visit.visited;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'date-asc':
          return new Date(a.visit_date).getTime() - new Date(b.visit_date).getTime();
        case 'date-desc':
          return new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime();
        case 'rating-desc':
          return (b.rating || 0) - (a.rating || 0);
        case 'rating-asc':
          return (a.rating || 0) - (b.rating || 0);
        default:
          return new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime();
      }
    });

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!office) {
    return <div className="p-6">Office not found</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header with back button */}
      <div className="bg-card border-b sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate(-1)}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{office.name}</h1>
              <p className="text-muted-foreground">Office Profile & Management</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-6 space-y-6">
        {/* SECTION 1: Office Info Header */}
        <Card>
        <CardHeader className="pb-4">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <CardTitle className="text-2xl">{office.name}</CardTitle>
                <Badge variant={getScoreBadgeVariant(score)}>{score} Partner</Badge>
              </div>
              <p className="text-muted-foreground">Source: {office.source}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={openInGoogleMaps}>
                <MapPin className="h-4 w-4 mr-2" />
                Maps
              </Button>
              <Button variant="outline" size="sm">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.open(`mailto:${office.email}`, '_blank')}>
                <Mail className="h-4 w-4 mr-2" />
                Email
              </Button>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Contact Information</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Address</p>
                    <p className="text-sm text-muted-foreground">{office.address}</p>
                  </div>
                </div>
                {office.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Phone</p>
                      <a href={`tel:${office.phone}`} className="text-sm text-primary hover:underline">{office.phone}</a>
                    </div>
                  </div>
                )}
                {office.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Email</p>
                      <a href={`mailto:${office.email}`} className="text-sm text-primary hover:underline">{office.email}</a>
                    </div>
                  </div>
                )}
                {office.website && (
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Website</p>
                      <a href={office.website} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
                        {office.website}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Office Details */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Office Details</h3>
              <div className="space-y-3">
                {office.distance_from_clinic && (
                  <div>
                    <p className="text-sm font-medium">Distance from Clinic</p>
                    <p className="text-sm text-muted-foreground">{office.distance_from_clinic} miles</p>
                  </div>
                )}
                {office.office_hours && (
                  <div>
                    <p className="text-sm font-medium">Office Hours</p>
                    <p className="text-sm text-muted-foreground">{office.office_hours}</p>
                  </div>
                )}
                {(office.google_rating || office.yelp_rating) && (
                  <div>
                    <p className="text-sm font-medium">Ratings</p>
                    <div className="flex gap-3 text-sm">
                      {office.google_rating && (
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          Google: {office.google_rating}
                        </span>
                      )}
                      {office.yelp_rating && (
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          Yelp: {office.yelp_rating}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Partnership Info & Tags */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Partnership Status</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium">Group Classification</p>
                  <Badge variant={getScoreBadgeVariant(score)} className="mt-1">{score} Partner</Badge>
                </div>
                <div>
                  <p className="text-sm font-medium">Referral Source</p>
                  <p className="text-sm text-muted-foreground">{office.source}</p>
                </div>
                {tags.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Tags</p>
                    <div className="flex flex-wrap gap-1">
                      {tags.map((tag) => (
                        <Badge key={tag.id} variant="outline" className="text-xs">
                          {tag.tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for different sections */}
      <Tabs defaultValue="referrals" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="referrals">Referral Stats</TabsTrigger>
          <TabsTrigger value="visits">Marketing Visits</TabsTrigger>
          <TabsTrigger value="notes">Notes & History</TabsTrigger>
        </TabsList>

        {/* SECTION 2: Referral Stats */}
        <TabsContent value="referrals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Referral Statistics</CardTitle>
              <div className="flex gap-4 text-sm">
                <span>Total Referrals: <strong>{getTotalReferrals()}</strong></span>
                <span>Last Referral: <strong>{getLastReferralDate()}</strong></span>
                <Badge variant={getScoreBadgeVariant(score)}>{score}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Year</TableHead>
                      {months.map(month => (
                        <TableHead key={month} className="text-center">{month}</TableHead>
                      ))}
                      <TableHead className="text-center">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[2024, 2023].map(year => (
                      <TableRow key={year}>
                        <TableCell className="font-medium">{year}</TableCell>
                        {months.map((month, index) => {
                          const monthKey = `${year}-${index + 1}`;
                          const count = getReferralCountForMonth(year, index + 1);
                          const isEditing = editingReferrals[monthKey] !== undefined;
                          
                          return (
                            <TableCell key={month} className="text-center">
                              {isEditing ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    value={editingReferrals[monthKey]}
                                    onChange={(e) => setEditingReferrals({
                                      ...editingReferrals,
                                      [monthKey]: parseInt(e.target.value) || 0
                                    })}
                                    className="w-16 h-8"
                                    min="0"
                                  />
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleReferralEdit(`${year}-${(index + 1).toString().padStart(2, '0')}-01`, editingReferrals[monthKey])}
                                  >
                                    <Save className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setEditingReferrals(prev => {
                                      const { [monthKey]: _, ...rest } = prev;
                                      return rest;
                                    })}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <span
                                  className="cursor-pointer hover:bg-muted px-2 py-1 rounded"
                                  onClick={() => setEditingReferrals({ ...editingReferrals, [monthKey]: count })}
                                >
                                  {count}
                                </span>
                              )}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center font-medium">
                          {Array.from({ length: 12 }, (_, i) => getReferralCountForMonth(year, i + 1)).reduce((a, b) => a + b, 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SECTION 3: Marketing Visits */}
        <TabsContent value="visits" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Marketing Visits & Engagement</CardTitle>
                <Button onClick={() => setShowAddVisit(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Visit
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-4">
                <Select value={visitFilter} onValueChange={setVisitFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Visits</SelectItem>
                    <SelectItem value="visited">Visited Only</SelectItem>
                    <SelectItem value="not-visited">Not Visited</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date-desc">Date (Newest First)</SelectItem>
                    <SelectItem value="date-asc">Date (Oldest First)</SelectItem>
                    <SelectItem value="rating-desc">Rating (High to Low)</SelectItem>
                    <SelectItem value="rating-asc">Rating (Low to High)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Group</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Visited</TableHead>
                      <TableHead>By</TableHead>
                      <TableHead>Approach</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedVisits.map((visit) => (
                      <TableRow key={visit.id}>
                        <TableCell>{new Date(visit.visit_date).toLocaleDateString()}</TableCell>
                        <TableCell>{visit.visit_time || '-'}</TableCell>
                        <TableCell>{visit.visit_group || '-'}</TableCell>
                        <TableCell className="max-w-32 truncate">{office?.address}</TableCell>
                        <TableCell>{office?.phone || '-'}</TableCell>
                        <TableCell>
                          <Checkbox checked={visit.visited} disabled />
                        </TableCell>
                        <TableCell>{visit.visited_by || '-'}</TableCell>
                        <TableCell className="max-w-32 truncate">
                          {visit.approach_used?.join(', ') || '-'}
                        </TableCell>
                        <TableCell>
                          {visit.rating ? (
                            <div className="flex">
                              {Array.from({ length: 5 }, (_, i) => (
                                <Star
                                  key={i}
                                  className={`h-4 w-4 ${
                                    i < visit.rating! ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                                  }`}
                                />
                              ))}
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{visit.notes || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SECTION 4: Notes & History */}
        <TabsContent value="notes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Office Notes & History</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Add notes about this office..."
                value={office.notes || ''}
                className="min-h-[200px]"
                readOnly
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

        {/* Add Visit Dialog */}
        {showAddVisit && <AddVisitDialog onAdd={addNewVisit} onCancel={() => setShowAddVisit(false)} />}
      </div>
    </div>
  );
}

// Add Visit Dialog Component
function AddVisitDialog({ onAdd, onCancel }: { onAdd: (data: any) => void; onCancel: () => void }) {
  const [formData, setFormData] = useState({
    visit_date: new Date().toISOString().split('T')[0],
    visit_time: '',
    visit_group: '',
    visited: false,
    visited_by: '',
    approach_used: [] as string[],
    rating: 0,
    notes: ''
  });

  const teamMembers = ['Dr. Smith', 'Dr. Jones', 'Sarah (Front Desk)', 'Mike (Marketing)'];
  const approachOptions = ['Booklet', 'Referral Slips', 'Gift', 'Lunch Meeting', 'Phone Call', 'Email'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle>Add New Visit</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Date</label>
                <Input
                  type="date"
                  value={formData.visit_date}
                  onChange={(e) => setFormData({...formData, visit_date: e.target.value})}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Time</label>
                <Input
                  type="time"
                  value={formData.visit_time}
                  onChange={(e) => setFormData({...formData, visit_time: e.target.value})}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Group</label>
              <Input
                value={formData.visit_group}
                onChange={(e) => setFormData({...formData, visit_group: e.target.value})}
                placeholder="e.g., New Target, Active"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                checked={formData.visited}
                onCheckedChange={(checked) => setFormData({...formData, visited: !!checked})}
              />
              <label className="text-sm font-medium">Visited?</label>
            </div>

            <div>
              <label className="text-sm font-medium">Visited By</label>
              <Select value={formData.visited_by} onValueChange={(value) => setFormData({...formData, visited_by: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map(member => (
                    <SelectItem key={member} value={member}>{member}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Approach Used</label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {approachOptions.map(approach => (
                  <div key={approach} className="flex items-center space-x-2">
                    <Checkbox
                      checked={formData.approach_used.includes(approach)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData({
                            ...formData,
                            approach_used: [...formData.approach_used, approach]
                          });
                        } else {
                          setFormData({
                            ...formData,
                            approach_used: formData.approach_used.filter(a => a !== approach)
                          });
                        }
                      }}
                    />
                    <label className="text-xs">{approach}</label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Rating</label>
              <div className="flex gap-1 mt-1">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    className={`h-6 w-6 cursor-pointer ${
                      i < formData.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                    }`}
                    onClick={() => setFormData({...formData, rating: i + 1})}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="Visit notes..."
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" className="flex-1">Add Visit</Button>
              <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}