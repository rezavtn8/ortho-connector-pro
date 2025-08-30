import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { MarketingVisitForm } from '@/components/MarketingVisitForm';
import { MarketingVisitsTable } from '@/components/MarketingVisitsTable';
import { MarketingOutreachAnalytics } from '@/components/MarketingOutreachAnalytics';
import { 
  Calendar, 
  Search, 
  Filter, 
  Plus,
  Building2,
  TrendingUp,
  AlertCircle,
  Users
} from 'lucide-react';
import { PatientSource } from '@/lib/database.types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useMarketingVisits } from '@/hooks/useMarketingVisits';
import { MarketingVisit } from '@/lib/database.types';

export function MarketingVisits() {
  const [selectedOffice, setSelectedOffice] = useState<PatientSource | null>(null);
  const [offices, setOffices] = useState<PatientSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddVisit, setShowAddVisit] = useState(false);
  const [editingVisit, setEditingVisit] = useState<MarketingVisit | null>(null);
  const [viewMode, setViewMode] = useState<'overview' | 'table' | 'analytics'>('overview');
  const { toast } = useToast();
  
  const { 
    visits, 
    loading: visitsLoading, 
    isSubmitting,
    saveVisit, 
    needsAttention, 
    getVisitStats 
  } = useMarketingVisits(selectedOffice?.id || '');

  React.useEffect(() => {
    loadOffices();
  }, []);

  const loadOffices = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('patient_sources')
        .select('*')
        .eq('is_active', true)
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

  const handleAddVisit = () => {
    setEditingVisit(null);
    setShowAddVisit(true);
  };

  const handleEditVisit = (visit: MarketingVisit) => {
    setEditingVisit(visit);
    setShowAddVisit(true);
  };

  const handleSubmitVisit = async (visitData: Partial<MarketingVisit>) => {
    const success = await saveVisit(visitData);
    if (success) {
      setShowAddVisit(false);
      setEditingVisit(null);
    }
  };

  const filteredOffices = offices.filter(office =>
    office.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get offices that need attention (no visits in 3+ months)
  const officesNeedingAttention = offices.filter(office => {
    // This would need to be calculated based on actual visit data
    // For now, we'll show a placeholder
    return Math.random() > 0.7; // Placeholder logic
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading offices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Marketing Visits</h1>
          <p className="text-muted-foreground">
            Track and analyze marketing outreach to referring offices
          </p>
        </div>
        {selectedOffice && (
          <Button onClick={handleAddVisit}>
            <Plus className="w-4 h-4 mr-2" />
            Add Visit
          </Button>
        )}
      </div>

      {/* Office Selection and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Select Office
          </CardTitle>
          <CardDescription>
            Choose an office to view and manage marketing visits
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search offices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Office Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
              {filteredOffices.map((office) => (
                <Card
                  key={office.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedOffice?.id === office.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedOffice(office)}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium text-sm mb-1">{office.name}</h3>
                        <p className="text-xs text-muted-foreground mb-2">
                          {office.source_type}
                        </p>
                        {office.address && (
                          <p className="text-xs text-muted-foreground">{office.address}</p>
                        )}
                      </div>
                      {officesNeedingAttention.includes(office) && (
                        <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredOffices.length === 0 && (
              <div className="text-center py-8">
                <Building2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No offices found</h3>
                <p className="text-muted-foreground">
                  {searchTerm ? 'No offices match your search.' : 'No offices available.'}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Office Analytics Overview */}
      {selectedOffice && (
        <>
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    {selectedOffice.name}
                    {needsAttention() && (
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                    )}
                  </CardTitle>
                  <CardDescription>
                    Marketing visit management and analytics
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={viewMode} onValueChange={(value: any) => setViewMode(value)}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background border z-50">
                      <SelectItem value="overview">Overview</SelectItem>
                      <SelectItem value="table">Visit History</SelectItem>
                      <SelectItem value="analytics">Analytics</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <div className="text-2xl font-bold text-primary">
                    {visitsLoading ? '...' : getVisitStats().total}
                  </div>
                  <div className="text-xs text-muted-foreground">Total Visits</div>
                </div>
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {visitsLoading ? '...' : getVisitStats().completed}
                  </div>
                  <div className="text-xs text-muted-foreground">Completed</div>
                </div>
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">
                    {visitsLoading ? '...' : getVisitStats().avgRating}
                  </div>
                  <div className="text-xs text-muted-foreground">Avg Rating</div>
                </div>
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {visitsLoading ? '...' : getVisitStats().completionRate}%
                  </div>
                  <div className="text-xs text-muted-foreground">Completion Rate</div>
                </div>
              </div>

              {needsAttention() && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span className="text-sm text-amber-800">
                    This office hasn't been visited in 3+ months and needs attention.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Content based on view mode */}
          {viewMode === 'overview' && (
            <MarketingVisitsTable
              officeId={selectedOffice.id}
              officeName={selectedOffice.name}
              onAddVisit={handleAddVisit}
              onEditVisit={handleEditVisit}
            />
          )}

          {viewMode === 'table' && (
            <MarketingVisitsTable
              officeId={selectedOffice.id}
              officeName={selectedOffice.name}
              onAddVisit={handleAddVisit}
              onEditVisit={handleEditVisit}
            />
          )}

          {viewMode === 'analytics' && (
            <MarketingOutreachAnalytics
              officeId={selectedOffice.id}
              officeName={selectedOffice.name}
            />
          )}
        </>
      )}

      {/* Add/Edit Visit Modal */}
      {showAddVisit && selectedOffice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <MarketingVisitForm
              visit={editingVisit}
              officeId={selectedOffice.id}
              officeName={selectedOffice.name}
              onSubmit={handleSubmitVisit}
              onCancel={() => {
                setShowAddVisit(false);
                setEditingVisit(null);
              }}
              isLoading={isSubmitting}
            />
          </div>
        </div>
      )}
    </div>
  );
}