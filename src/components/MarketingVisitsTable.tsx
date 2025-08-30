import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Plus, 
  Star, 
  Calendar, 
  User, 
  FileText, 
  Filter, 
  Download,
  Edit3,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { MarketingVisit, VISIT_TYPE_OPTIONS, MARKETING_MATERIALS } from '@/lib/database.types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface MarketingVisitsTableProps {
  officeId: string;
  officeName: string;
  onAddVisit: () => void;
  onEditVisit: (visit: MarketingVisit) => void;
}

interface VisitFilters {
  rep: string;
  materials: string;
  rating: string;
  visitStatus: string;
  visitType: string;
}

export function MarketingVisitsTable({ 
  officeId, 
  officeName, 
  onAddVisit, 
  onEditVisit 
}: MarketingVisitsTableProps) {
  const [visits, setVisits] = useState<MarketingVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<VisitFilters>({
    rep: 'all',
    materials: 'all',
    rating: 'all',
    visitStatus: 'all',
    visitType: 'all',
  });
  const { toast } = useToast();

  useEffect(() => {
    loadVisits();
  }, [officeId]);

  const loadVisits = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('marketing_visits')
        .select('*')
        .eq('office_id', officeId)
        .order('visit_date', { ascending: false });

      if (error) throw error;
      setVisits(data || []);
    } catch (error) {
      console.error('Error loading visits:', error);
      toast({
        title: "Error",
        description: "Failed to load marketing visits",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVisit = async (visitId: string) => {
    if (!confirm('Are you sure you want to delete this visit?')) return;
    
    try {
      const { error } = await supabase
        .from('marketing_visits')
        .delete()
        .eq('id', visitId);

      if (error) throw error;
      
      setVisits(visits.filter(v => v.id !== visitId));
      toast({
        title: "Success",
        description: "Visit deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting visit:', error);
      toast({
        title: "Error",
        description: "Failed to delete visit",
        variant: "destructive",
      });
    }
  };

  // Get unique values for filter options
  const uniqueReps = Array.from(new Set(visits.map(v => v.rep_name).filter(Boolean)));
  const uniqueMaterials = Array.from(new Set(visits.flatMap(v => v.materials_handed_out)));

  // Filter visits based on current filters
  const filteredVisits = visits.filter(visit => {
    if (filters.rep !== 'all' && visit.rep_name !== filters.rep) return false;
    if (filters.visitStatus !== 'all') {
      const isVisited = filters.visitStatus === 'completed';
      if (visit.visited !== isVisited) return false;
    }
    if (filters.visitType !== 'all' && visit.visit_type !== filters.visitType) return false;
    if (filters.materials !== 'all' && !visit.materials_handed_out.includes(filters.materials as any)) return false;
    if (filters.rating !== 'all') {
      const ratingFilter = parseInt(filters.rating);
      if (!visit.star_rating || visit.star_rating < ratingFilter) return false;
    }
    return true;
  });

  const exportToCSV = () => {
    const csvData = filteredVisits.map(visit => ({
      'Visit Date': format(new Date(visit.visit_date), 'yyyy-MM-dd'),
      'Visit Type': visit.visit_type,
      'Rep Name': visit.rep_name,
      'Contact Person': visit.contact_person || '',
      'Visited': visit.visited ? 'Yes' : 'No',
      'Materials': visit.materials_handed_out.join(', '),
      'Rating': visit.star_rating || '',
      'Group Tag': visit.group_tag || '',
      'Notes': visit.follow_up_notes || ''
    }));

    const csvString = [
      Object.keys(csvData[0] || {}).join(','),
      ...csvData.map(row => Object.values(row).map(value => `"${value}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `marketing-visits-${officeName.replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const StarDisplay = ({ rating }: { rating?: number | null }) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            "w-3 h-3",
            rating && star <= rating
              ? "fill-yellow-400 text-yellow-400"
              : "text-muted-foreground"
          )}
        />
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Loading visits...</p>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Marketing Visits
            </CardTitle>
            <CardDescription>
              Track marketing visits and outreach for {officeName}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {filteredVisits.length > 0 && (
              <Button variant="outline" size="sm" onClick={exportToCSV}>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            )}
            <Button onClick={onAddVisit} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Visit
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters:</span>
          </div>
          
          <Select value={filters.rep} onValueChange={(value) => setFilters({ ...filters, rep: value })}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Rep" />
            </SelectTrigger>
            <SelectContent className="bg-background border z-50">
              <SelectItem value="all">All Reps</SelectItem>
              {uniqueReps.map(rep => (
                <SelectItem key={rep} value={rep}>{rep}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.visitType} onValueChange={(value) => setFilters({ ...filters, visitType: value })}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Visit Type" />
            </SelectTrigger>
            <SelectContent className="bg-background border z-50">
              <SelectItem value="all">All Types</SelectItem>
              {VISIT_TYPE_OPTIONS.map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.visitStatus} onValueChange={(value) => setFilters({ ...filters, visitStatus: value })}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-background border z-50">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="planned">Planned</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.rating} onValueChange={(value) => setFilters({ ...filters, rating: value })}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Rating" />
            </SelectTrigger>
            <SelectContent className="bg-background border z-50">
              <SelectItem value="all">All Ratings</SelectItem>
              <SelectItem value="4">4+ Stars</SelectItem>
              <SelectItem value="3">3+ Stars</SelectItem>
              <SelectItem value="2">2+ Stars</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Visits Table */}
        {filteredVisits.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No visits found</h3>
            <p className="text-muted-foreground mb-4">
              {visits.length === 0 
                ? "No marketing visits have been recorded for this office yet."
                : "No visits match the current filters."
              }
            </p>
            <Button onClick={onAddVisit}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Visit
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-3 font-medium">Date</th>
                    <th className="text-left p-3 font-medium">Type</th>
                    <th className="text-left p-3 font-medium">Rep</th>
                    <th className="text-left p-3 font-medium">Contact</th>
                    <th className="text-center p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Materials</th>
                    <th className="text-center p-3 font-medium">Rating</th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredVisits.map((visit) => (
                    <tr key={visit.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3">
                        <div className="font-medium">
                          {format(new Date(visit.visit_date), 'MMM d, yyyy')}
                        </div>
                        {visit.group_tag && (
                          <div className="text-xs text-muted-foreground">{visit.group_tag}</div>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline">{visit.visit_type}</Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span>{visit.rep_name}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="text-muted-foreground">
                          {visit.contact_person || 'Not specified'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant={visit.visited ? "default" : "outline"}>
                          {visit.visited ? 'Completed' : 'Planned'}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {visit.materials_handed_out.map((material) => (
                            <Badge key={material} variant="secondary" className="text-xs">
                              {material}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        {visit.star_rating ? (
                          <StarDisplay rating={visit.star_rating} />
                        ) : (
                          <span className="text-muted-foreground text-xs">No rating</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEditVisit(visit)}
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteVisit(visit.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Summary Stats */}
        {filteredVisits.length > 0 && (
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{filteredVisits.length}</div>
              <div className="text-xs text-muted-foreground">Total Visits</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {filteredVisits.filter(v => v.visited).length}
              </div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {filteredVisits.filter(v => v.star_rating && v.star_rating >= 4).length}
              </div>
              <div className="text-xs text-muted-foreground">4+ Star Visits</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {Math.round((filteredVisits.reduce((sum, v) => sum + (v.star_rating || 0), 0) / filteredVisits.filter(v => v.star_rating).length) * 10) / 10 || 0}
              </div>
              <div className="text-xs text-muted-foreground">Avg Rating</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}