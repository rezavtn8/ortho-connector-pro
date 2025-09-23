import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EnhancedDatePicker } from '@/components/EnhancedDatePicker';
import { DateRangePicker } from '@/components/DateRangePicker';
import { CalendarView } from '@/components/CalendarView';
import { AddressSearch } from '@/components/AddressSearch';
import { MapView } from '@/components/MapView';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarIcon, Plus, Search, Star, Camera, FileText, Download, Filter, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { usePagination } from '@/hooks/usePagination';

interface MarketingVisit {
  id: string;
  office_id: string;
  visit_date: string;
  visit_type: string;
  group_tag?: string;
  contact_person?: string;
  visited: boolean;
  rep_name: string;
  materials_handed_out?: string[];
  star_rating?: number;
  follow_up_notes?: string;
  photo_url?: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  clinic_id?: string;
  // Joined data
  office_name?: string;
}

interface Office {
  id: string;
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

const VISIT_TYPES = ['New Target', 'Routine', 'Reconnect', 'Follow-up'];
const MATERIALS = ['Referral Slips', 'Portfolio', 'Gifts', 'Booklets', 'Gift Card'];

export function MarketingVisits() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRep, setFilterRep] = useState('');
  const [filterRating, setFilterRating] = useState('');
  const [filterVisited, setFilterVisited] = useState('');
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [selectedOffice, setSelectedOffice] = useState<Office | null>(null);
  const [activeTab, setActiveTab] = useState('table');

  // Paginated visits using custom hook
  const visits = usePagination({
    tableName: 'marketing_visits',
    pageSize: 20,
    selectFields: `
      id,
      office_id,
      visit_date,
      visit_type,
      group_tag,
      contact_person,
      visited,
      rep_name,
      materials_handed_out,
      star_rating,
      follow_up_notes,
      photo_url,
      created_at,
      updated_at,
      user_id,
      clinic_id
    `,
    orderBy: { column: 'visit_date', ascending: false }
  });

  // Form state
  const [formData, setFormData] = useState({
    office_id: '',
    visit_date: new Date(),
    visit_type: '',
    group_tag: '',
    contact_person: '',
    visited: false,
    materials_handed_out: [] as string[],
    star_rating: 0,
    follow_up_notes: '',
    photo_file: null as File | null,
  });

  useEffect(() => {
    loadData();
    visits.loadPage(0, true);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load offices (patient sources with type 'Office')
      const { data: officesData, error: officesError } = await supabase
        .from('patient_sources')
        .select('id, name, address, latitude, longitude')
        .eq('source_type', 'Office')
        .eq('is_active', true)
        .order('name');

      if (officesError) throw officesError;
      setOffices(officesData || []);
    } catch (error: any) {
      console.error('MarketingVisits error:', error);
      toast({
        title: "Error loading data",
        description: error.message,
        variant: "destructive",
      });
      setOffices([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to add visits",
        variant: "destructive",
      });
      return;
    }

    if (!selectedOffice || !formData.visit_type) {
      toast({
        title: "Validation Error",
        description: "Please select an office and visit type",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // If it's a new office from Google Places, create it first
      let officeId = selectedOffice.id;
      if (selectedOffice.id.startsWith('new-')) {
        const { data: newOffice, error: officeError } = await supabase
          .from('patient_sources')
          .insert({
            name: selectedOffice.name,
            address: selectedOffice.address,
            latitude: selectedOffice.latitude,
            longitude: selectedOffice.longitude,
            source_type: 'Office',
            created_by: user.id,
            is_active: true
          })
          .select('id')
          .single();

        if (officeError) throw officeError;
        officeId = newOffice.id;
      }

      const visitData = {
        office_id: officeId,
        visit_date: format(formData.visit_date, 'yyyy-MM-dd'),
        visit_type: formData.visit_type,
        group_tag: formData.group_tag || null,
        contact_person: formData.contact_person || null,
        visited: formData.visited,
        rep_name: user.email || 'Unknown Rep',
        materials_handed_out: formData.materials_handed_out.length > 0 ? formData.materials_handed_out : null,
        star_rating: formData.star_rating > 0 ? formData.star_rating : null,
        follow_up_notes: formData.follow_up_notes || null,
        user_id: user.id,
        clinic_id: null, // nullable as per schema
      };

      const { error } = await supabase
        .from('marketing_visits')
        .insert([visitData]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Marketing visit added successfully",
      });

      // Reset form and reload data
      setFormData({
        office_id: '',
        visit_date: new Date(),
        visit_type: '',
        group_tag: '',
        contact_person: '',
        visited: false,
        materials_handed_out: [],
        star_rating: 0,
        follow_up_notes: '',
        photo_file: null,
      });
      setSelectedOffice(null);
      setShowForm(false);
      visits.refresh();
    } catch (error: any) {
      toast({
        title: "Error adding visit",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleMaterial = (material: string) => {
    setFormData(prev => ({
      ...prev,
      materials_handed_out: prev.materials_handed_out.includes(material)
        ? prev.materials_handed_out.filter(m => m !== material)
        : [...prev.materials_handed_out, material]
    }));
  };

  // Add office names to visits data for display
  const visitsWithOfficeNames = visits.data.map(visit => ({
    ...visit,
    office_name: offices.find(office => office.id === visit.office_id)?.name || 'Unknown Office'
  }));

  const filteredVisits = visitsWithOfficeNames.filter(visit => {
    const matchesSearch = visit.office_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         visit.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         visit.rep_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRep = !filterRep || visit.rep_name.includes(filterRep);
    const matchesRating = !filterRating || filterRating === 'all' || visit.star_rating?.toString() === filterRating;
    const matchesVisited = !filterVisited || filterVisited === 'all' ||
                          (filterVisited === 'visited' && visit.visited) ||
                          (filterVisited === 'not_visited' && !visit.visited);
    
    // Date range filtering
    const visitDate = new Date(visit.visit_date);
    const matchesDateRange = (!dateRange.from || visitDate >= dateRange.from) &&
                            (!dateRange.to || visitDate <= dateRange.to);
    
    return matchesSearch && matchesRep && matchesRating && matchesVisited && matchesDateRange;
  });

  const exportToCSV = () => {
    const csvData = filteredVisits.map(visit => ({
      Date: format(new Date(visit.visit_date), 'yyyy-MM-dd'),
      Office: visit.office_name,
      'Visit Type': visit.visit_type,
      'Group Tag': visit.group_tag || '',
      'Contact Person': visit.contact_person || '',
      'Rep Name': visit.rep_name,
      Visited: visit.visited ? 'Yes' : 'No',
      'Star Rating': visit.star_rating || '',
      'Materials Handed Out': visit.materials_handed_out?.join(', ') || '',
      'Follow-up Notes': visit.follow_up_notes || ''
    }));

    const csvHeaders = Object.keys(csvData[0] || {});
    const csvContent = [
      csvHeaders.join(','),
      ...csvData.map(row => 
        csvHeaders.map(header => 
          `"${(row as any)[header].toString().replace(/"/g, '""')}"`
        ).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `marketing-visits-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderStars = (rating?: number) => {
    if (!rating) return <span className="text-muted-foreground">-</span>;
    return (
      <div className="flex">
        {[1, 2, 3, 4, 5].map(star => (
          <Star
            key={star}
            className={`w-4 h-4 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
          />
        ))}
      </div>
    );
  };

  if (loading && visits.data.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading marketing visits...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-3 mb-8">
        <div className="flex items-center gap-3">
          <Camera className="h-8 w-8 title-icon" />
          <h1 className="text-4xl font-bold page-title">Marketing Visits</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Track and manage office visits and outreach activities
        </p>
      </div>

      {/* Action Button */}
      <div className="flex justify-end">
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Visit
        </Button>
      </div>

      {/* Add Visit Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add Marketing Visit</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="office">Office *</Label>
                  <AddressSearch
                    value={selectedOffice?.id}
                    onSelect={(office) => {
                      setSelectedOffice(office);
                      setFormData(prev => ({ ...prev, office_id: office?.id || '' }));
                    }}
                    placeholder="Search for an office or address..."
                  />
                  {selectedOffice && (
                    <div className="mt-2 p-2 bg-muted rounded-md">
                      <div className="text-sm font-medium">{selectedOffice.name}</div>
                      {selectedOffice.address && (
                        <div className="text-xs text-muted-foreground">{selectedOffice.address}</div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Visit Date *</Label>
                  <EnhancedDatePicker
                    value={formData.visit_date}
                    onChange={(date) => date && setFormData(prev => ({ ...prev, visit_date: date }))}
                    placeholder="Select visit date"
                    withTime={true}
                    presets={true}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="visit_type">Visit Type *</Label>
                  <Select value={formData.visit_type} onValueChange={(value) => 
                    setFormData(prev => ({ ...prev, visit_type: value }))
                  }>
                    <SelectTrigger>
                      <SelectValue placeholder="Select visit type" />
                    </SelectTrigger>
                    <SelectContent>
                      {VISIT_TYPES.map(type => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="group_tag">Group Tag</Label>
                  <Input
                    id="group_tag"
                    value={formData.group_tag}
                    onChange={(e) => setFormData(prev => ({ ...prev, group_tag: e.target.value }))}
                    placeholder="Optional group tag"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact_person">Contact Person</Label>
                  <Input
                    id="contact_person"
                    value={formData.contact_person}
                    onChange={(e) => setFormData(prev => ({ ...prev, contact_person: e.target.value }))}
                    placeholder="Person met during visit"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Rep Name</Label>
                  <Input
                    value={user?.email || 'Unknown Rep'}
                    disabled
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="visited"
                  checked={formData.visited}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, visited: !!checked }))
                  }
                />
                <Label htmlFor="visited">Visited?</Label>
              </div>

              <div className="space-y-2">
                <Label>Materials Handed Out</Label>
                <div className="flex flex-wrap gap-2">
                  {MATERIALS.map(material => (
                    <Badge
                      key={material}
                      variant={formData.materials_handed_out.includes(material) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleMaterial(material)}
                    >
                      {material}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Star Rating</Label>
                <div className="flex space-x-1">
                  {[1, 2, 3, 4, 5].map(star => (
                    <Star
                      key={star}
                      className={`w-6 h-6 cursor-pointer ${
                        star <= formData.star_rating 
                          ? 'fill-yellow-400 text-yellow-400' 
                          : 'text-gray-300 hover:text-yellow-400'
                      }`}
                      onClick={() => setFormData(prev => ({ ...prev, star_rating: star }))}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="follow_up_notes">Follow-up Notes</Label>
                <Textarea
                  id="follow_up_notes"
                  value={formData.follow_up_notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, follow_up_notes: e.target.value }))}
                  placeholder="Notes for follow-up actions..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading || !formData.office_id || !formData.visit_type}>
                  {loading ? 'Saving...' : 'Save Visit'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search visits..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Rep</Label>
              <Input
                placeholder="Filter by rep..."
                value={filterRep}
                onChange={(e) => setFilterRep(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Rating</Label>
              <Select value={filterRating} onValueChange={setFilterRating}>
                <SelectTrigger>
                  <SelectValue placeholder="All ratings" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All ratings</SelectItem>
                  {[1, 2, 3, 4, 5].map(rating => (
                    <SelectItem key={rating} value={rating.toString()}>
                      {rating} stars
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Visit Status</Label>
              <Select value={filterVisited} onValueChange={setFilterVisited}>
                <SelectTrigger>
                  <SelectValue placeholder="All visits" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All visits</SelectItem>
                  <SelectItem value="visited">Visited</SelectItem>
                  <SelectItem value="not_visited">Not visited</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Visits Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Visits ({filteredVisits.length})</CardTitle>
            <Button variant="outline" size="sm" className="gap-2" onClick={exportToCSV}>
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {filteredVisits.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No visits found</h3>
              <p className="text-muted-foreground mb-4">
                {visits.data.length === 0 
                  ? "Start by adding your first marketing visit"
                  : "Try adjusting your filters to see more results"
                }
              </p>
              {visits.data.length === 0 && (
                <Button onClick={() => setShowForm(true)} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add Your First Visit
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Office</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Rep</TableHead>
                    <TableHead>Visited</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Materials</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVisits.map((visit) => (
                    <TableRow key={visit.id}>
                      <TableCell>
                        {format(new Date(visit.visit_date), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell className="font-medium">
                        {visit.office_name}
                        {visit.group_tag && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {visit.group_tag}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{visit.visit_type}</Badge>
                      </TableCell>
                      <TableCell>{visit.contact_person || '-'}</TableCell>
                      <TableCell>{visit.rep_name}</TableCell>
                      <TableCell>
                        <Badge variant={visit.visited ? "default" : "secondary"}>
                          {visit.visited ? 'Yes' : 'No'}
                        </Badge>
                      </TableCell>
                      <TableCell>{renderStars(visit.star_rating)}</TableCell>
                      <TableCell>
                        {visit.materials_handed_out && visit.materials_handed_out.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {visit.materials_handed_out.map(material => (
                              <Badge key={material} variant="outline" className="text-xs">
                                {material}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {visit.follow_up_notes ? (
                          <div className="max-w-40 truncate" title={visit.follow_up_notes}>
                            {visit.follow_up_notes}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Load More Button */}
          {visits.hasMore && filteredVisits.length > 0 && (
            <div className="flex justify-center pt-6">
              <Button 
                onClick={visits.loadMore} 
                disabled={visits.loading}
                variant="outline"
                className="gap-2"
              >
                {visits.loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>Load More Visits</>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}