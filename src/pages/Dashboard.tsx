import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PatientSource, SourceTag } from '@/lib/database.types';
import { supabase } from '@/integrations/supabase/client';
import { Search, Filter, Building2, TrendingUp, Users, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

export function Dashboard() {
  const [offices, setOffices] = useState<PatientSource[]>([]);
  const [tags, setTags] = useState<SourceTag[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load patient sources
      const { data: sourcesData, error: sourcesError } = await supabase
        .from('patient_sources')
        .select('*')
        .order('name');

      if (sourcesError) throw sourcesError;

      // Load source tags
      const { data: tagsData, error: tagsError } = await supabase
        .from('source_tags')
        .select('*');

      if (tagsError) throw tagsError;

      setOffices(sourcesData || []);
      setTags(tagsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredOffices = offices.filter(office =>
    office.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    office.address?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate statistics - simplified for now
  const totalOffices = offices.length;
  const activeOffices = offices.filter(office => office.is_active).length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <CardTitle className="text-lg">
                  <div className="h-4 bg-muted rounded animate-pulse w-24"></div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded animate-pulse w-16 mb-2"></div>
                <div className="h-3 bg-muted rounded animate-pulse w-32"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Dashboard
          </h1>
          <p className="text-muted-foreground">
            Overview of your referring offices
          </p>
        </div>
        <Button 
          onClick={() => navigate('/offices')}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Manage Offices
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Offices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{totalOffices}</div>
              <Building2 className="w-8 h-8 text-blue-500 opacity-20" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {activeOffices} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Referrals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">0</div>
              <TrendingUp className="w-8 h-8 text-green-500 opacity-20" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              All-time referrals
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Relationships
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{activeOffices}</div>
              <Users className="w-8 h-8 text-orange-500 opacity-20" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Recent activity
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search offices by name or address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" className="gap-2">
              <Filter className="w-4 h-4" />
              Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Offices List */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Referring Offices</h2>
        
        {filteredOffices.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOffices.map((office) => (
              <Card 
                key={office.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(`/source/${office.id}`)}
              >
                <CardHeader>
                  <CardTitle className="text-lg">{office.name}</CardTitle>
                  {office.address && (
                    <p className="text-sm text-muted-foreground">{office.address}</p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground mb-2">
                      Type: {office.source_type}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Status: {office.is_active ? 'Active' : 'Inactive'}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <Building2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <div className="text-muted-foreground">
                {searchTerm ? 'No offices found matching your search.' : 'No offices found.'}
              </div>
              <Button 
                className="mt-4"
                onClick={() => navigate('/offices')}
              >
                Go to Offices Page
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}