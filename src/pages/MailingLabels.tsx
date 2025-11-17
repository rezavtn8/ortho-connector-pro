import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Download, Search, Filter, FileSpreadsheet, MapPin, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useOffices } from '@/hooks/useOffices';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { AddressCorrectionDialog } from '@/components/AddressCorrectionDialog';

interface ParsedAddress {
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
}

interface MailingLabelData {
  officeName: string;
  contactName: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
}

// Parse address into components - PHASE 1: Enhanced regex and logic
const parseAddress = (address: string | null): ParsedAddress => {
  if (!address) {
    return { address1: '', address2: '', city: '', state: '', zip: '' };
  }

  // Clean up address
  const cleanAddress = address.trim();
  
  // Split by comma
  const parts = cleanAddress.split(',').map(p => p.trim());
  
  let address1 = '';
  let address2 = '';
  let city = '';
  let state = '';
  let zip = '';

  if (parts.length >= 2) {
    // Get the last part which should contain state and zip
    const lastPart = parts[parts.length - 1];
    const stateZipMatch = lastPart.match(/^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
    
    if (stateZipMatch) {
      state = stateZipMatch[1];
      zip = stateZipMatch[2];
      
      // City is the second-to-last part
      if (parts.length >= 2) {
        city = parts[parts.length - 2].trim();
      }
      
      // Everything before city is address
      const addressParts = parts.slice(0, parts.length - 2);
      
      if (addressParts.length > 0) {
        const fullAddress = addressParts.join(', ').trim();
        
        // Try to split street address from suite/unit
        // Patterns: "123 Main St #100", "123 Main St Suite 100", "123 Main St Ste 100"
        // Also handle: "#100", "# 100", "Suite 100", "Ste 100", "Unit 100", "Apt 100"
        const suiteMatch = fullAddress.match(/^(.*?)\s+(Suite|Unit|Apt|Ste|Building|Bldg|#)\s*(.+)$/i);
        
        if (suiteMatch) {
          address1 = suiteMatch[1].trim();
          const suiteType = suiteMatch[2].trim();
          const suiteNum = suiteMatch[3].trim();
          // Normalize the suite format
          if (suiteType === '#') {
            address2 = `#${suiteNum}`;
          } else {
            address2 = `${suiteType.toUpperCase()} ${suiteNum}`;
          }
        } else {
          address1 = fullAddress;
        }
      }
    } else {
      // Fallback: couldn't parse state/zip from last part
      // Just put everything in address1
      address1 = cleanAddress;
    }
  } else {
    // Single part address - just use as-is
    address1 = cleanAddress;
  }

  return { address1, address2, city, state, zip };
};

export function MailingLabels() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTiers, setSelectedTiers] = useState<string[]>(['VIP', 'Warm', 'Cold', 'Dormant']);
  const [includeDiscovered, setIncludeDiscovered] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'partner' | 'discovered'>('all');
  const [showParseErrors, setShowParseErrors] = useState(false);
  
  // PHASE 1: Address Correction State
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [correctionProgress, setCorrectionProgress] = useState(0);
  const [showCorrectionDialog, setShowCorrectionDialog] = useState(false);
  const [correctionResults, setCorrectionResults] = useState<any[]>([]);
  const [hasBeenCorrected, setHasBeenCorrected] = useState(false);

  const { data: offices = [], isLoading: officesLoading } = useOffices();
  
  const { data: discoveredOffices = [], isLoading: discoveredLoading } = useQuery({
    queryKey: ['discovered-offices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discovered_offices')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: includeDiscovered || sourceFilter === 'discovered',
  });

  // Phase 2: Filtering Logic + Error Detection
  const filteredData = useMemo(() => {
    let results: MailingLabelData[] = [];
    let errors: string[] = [];

    // Filter partner offices
    if (sourceFilter === 'all' || sourceFilter === 'partner') {
      const partnerOffices = offices
        .filter(office => {
          const matchesTier = selectedTiers.includes(office.tier);
          const matchesSearch = searchTerm === '' || 
            office.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (office.address?.toLowerCase().includes(searchTerm.toLowerCase()));
          
          return matchesTier && matchesSearch;
        })
        .map(office => {
          const parsed = parseAddress(office.address);
          
          // Detect potential parsing errors
          if (!parsed.city || !parsed.state || !parsed.zip) {
            errors.push(`${office.name}: Missing city/state/zip - "${office.address}"`);
          }
          
          return {
            officeName: office.name,
            contactName: '', // Partner offices don't have contact name
            ...parsed,
          };
        });
      
      results = [...results, ...partnerOffices];
    }

    // Filter discovered offices
    if (sourceFilter === 'all' || sourceFilter === 'discovered') {
      if (includeDiscovered || sourceFilter === 'discovered') {
        const discovered = discoveredOffices
          .filter(office => {
            const matchesSearch = searchTerm === '' || 
              office.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              (office.address?.toLowerCase().includes(searchTerm.toLowerCase()));
            
            return matchesSearch;
          })
          .map(office => {
            const parsed = parseAddress(office.address);
            
            // Detect potential parsing errors
            if (!parsed.city || !parsed.state || !parsed.zip) {
              errors.push(`${office.name}: Missing city/state/zip - "${office.address}"`);
            }
            
            return {
              officeName: office.name,
              contactName: '', // Discovered offices don't have contact name
              ...parsed,
            };
          });
        
        results = [...results, ...discovered];
      }
    }

    // Log errors if any
    if (errors.length > 0 && showParseErrors) {
      console.warn('Address parsing errors:', errors);
    }

    return results;
  }, [offices, discoveredOffices, selectedTiers, includeDiscovered, searchTerm, sourceFilter, showParseErrors]);

  // Phase 4: Excel Export
  const handleExportToExcel = () => {
    if (filteredData.length === 0) {
      toast({
        title: "No data to export",
        description: "Please adjust your filters to include offices.",
        variant: "destructive",
      });
      return;
    }

    const exportData = filteredData.map(item => ({
      'Office Name': item.officeName,
      'Contact Name': item.contactName,
      'Address 1': item.address1,
      'Address 2': item.address2,
      'City': item.city,
      'State': item.state,
      'ZIP': item.zip,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Mailing Labels');

    // Set column widths
    worksheet['!cols'] = [
      { wch: 30 }, // Office Name
      { wch: 25 }, // Contact Name
      { wch: 30 }, // Address 1
      { wch: 20 }, // Address 2
      { wch: 20 }, // City
      { wch: 8 },  // State
      { wch: 12 }, // ZIP
    ];

    const fileName = `mailing-labels-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    toast({
      title: "Export successful",
      description: `Exported ${filteredData.length} mailing labels to ${fileName}`,
    });
  };

  const isLoading = officesLoading || (includeDiscovered && discoveredLoading);

  const toggleTier = (tier: string) => {
    setSelectedTiers(prev => 
      prev.includes(tier) 
        ? prev.filter(t => t !== tier)
        : [...prev, tier]
    );
  };

  // PHASE 2: Address Correction Handler - Now shows review dialog
  const handleCorrectAddresses = async () => {
    if (hasBeenCorrected) {
      toast({
        title: "Already corrected",
        description: "Addresses have already been corrected once. Refresh the page to run again.",
        variant: "destructive",
      });
      return;
    }

    // Get all partner office IDs that are currently filtered
    const officesWithIds = offices
      .filter(office => {
        const matchesTier = selectedTiers.includes(office.tier);
        const matchesSearch = searchTerm === '' || 
          office.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (office.address?.toLowerCase().includes(searchTerm.toLowerCase()));
        
        return matchesTier && matchesSearch && office.address;
      });

    const partnerOfficeIds = officesWithIds.map(office => office.id);

    if (partnerOfficeIds.length === 0) {
      toast({
        title: "No addresses to correct",
        description: "No partner offices with addresses found in current filter.",
        variant: "destructive",
      });
      return;
    }

    setIsCorrecting(true);
    setCorrectionProgress(0);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      toast({
        title: "Starting address correction",
        description: `Processing ${partnerOfficeIds.length} offices with Google Maps API...`,
      });

      // Call edge function via supabase client to get corrections (no auto-update)
      const { data: result, error: fnError } = await supabase.functions.invoke('correct-office-addresses', {
        body: { officeIds: partnerOfficeIds }
      });

      if (fnError) {
        throw new Error(fnError.message || 'Address correction failed');
      }
      
      // Map results with office names
      const resultsWithNames = result.results.map((r: any) => {
        const office = officesWithIds.find(o => o.id === r.id);
        return {
          ...r,
          officeName: office?.name || 'Unknown Office',
        };
      });

      setCorrectionResults(resultsWithNames);
      setCorrectionProgress(100);
      setShowCorrectionDialog(true);

      toast({
        title: "Analysis complete",
        description: `Found ${result.needsUpdate} addresses that can be improved.`,
      });

    } catch (error) {
      console.error('Address correction error:', error);
      toast({
        title: "Correction failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive",
      });
    } finally {
      setIsCorrecting(false);
    }
  };

  // PHASE 3: Apply selected corrections
  const handleApplyCorrections = async (selectedIds: string[]) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      const updates = correctionResults
        .filter(r => selectedIds.includes(r.id))
        .map(r => ({ id: r.id, address: r.corrected }));

      // Invoke edge function to apply selected corrections
      const { data: result, error: fnError } = await supabase.functions.invoke('apply-address-corrections', {
        body: { updates }
      });

      if (fnError) {
        throw new Error(fnError.message || 'Failed to apply corrections');
      }
      
      toast({
        title: "Addresses updated",
        description: `Successfully updated ${result.updated} of ${result.total} addresses.`,
      });

      setHasBeenCorrected(true);
      
      // Refresh page to show updated addresses
      setTimeout(() => window.location.reload(), 1500);

    } catch (error) {
      console.error('Apply corrections error:', error);
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive",
      });
      throw error;
    }
  };

  return (
    <div className="space-y-6">
      {/* Phase 1: Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Mailing Labels</h1>
        <p className="text-muted-foreground">
          Generate Excel sheets for bulk mailing to offices
        </p>
      </div>

      {/* Phase 2 & 3: Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filter Options
          </CardTitle>
          <CardDescription>
            Select which offices to include in your mailing list
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Search */}
          <div className="space-y-2">
            <Label htmlFor="search">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search by office name or address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Source Filter */}
          <div className="space-y-2">
            <Label htmlFor="source-filter">Office Source</Label>
            <Select value={sourceFilter} onValueChange={(value: any) => setSourceFilter(value)}>
              <SelectTrigger id="source-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Offices</SelectItem>
                <SelectItem value="partner">Partner Offices Only</SelectItem>
                <SelectItem value="discovered">Discovered Offices Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tier Selection (for partner offices) */}
          {(sourceFilter === 'all' || sourceFilter === 'partner') && (
            <div className="space-y-2">
              <Label>Partner Office Tiers</Label>
              <div className="flex flex-wrap gap-2">
                {['VIP', 'Warm', 'Cold', 'Dormant'].map(tier => (
                  <div key={tier} className="flex items-center space-x-2">
                    <Checkbox
                      id={`tier-${tier}`}
                      checked={selectedTiers.includes(tier)}
                      onCheckedChange={() => toggleTier(tier)}
                    />
                    <label
                      htmlFor={`tier-${tier}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {tier}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Include Discovered (when showing all) */}
          {sourceFilter === 'all' && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-discovered"
                checked={includeDiscovered}
                onCheckedChange={(checked) => setIncludeDiscovered(checked as boolean)}
              />
              <label
                htmlFor="include-discovered"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Include discovered offices
              </label>
            </div>
          )}

          {/* PHASE 2: Show Parse Errors Toggle */}
          <div className="pt-2 border-t">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-parse-errors"
                checked={showParseErrors}
                onCheckedChange={(checked) => setShowParseErrors(checked as boolean)}
              />
              <label
                htmlFor="show-parse-errors"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Log address parsing errors to console
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PHASE 3: Address Correction Tool */}
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Address Correction Tool
          </CardTitle>
          <CardDescription>
            Use Google Maps API to validate and standardize all partner office addresses (one-time use)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasBeenCorrected ? (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Correction Complete</AlertTitle>
              <AlertDescription>
                Addresses have been updated successfully. Refresh the page to run correction again.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="space-y-2 flex-1">
                  <p className="text-sm font-medium">How it works:</p>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Sends each partner office address to Google Maps Geocoding API</li>
                    <li>Receives standardized, validated addresses with proper formatting</li>
                    <li>Updates your database with corrected addresses automatically</li>
                    <li>Can only be used once per page load (refresh to run again)</li>
                  </ul>
                </div>
              </div>

              {isCorrecting && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Processing addresses...</span>
                    <span>{Math.round(correctionProgress)}%</span>
                  </div>
                  <Progress value={correctionProgress} />
                </div>
              )}

              <Button
                onClick={handleCorrectAddresses}
                disabled={isCorrecting || hasBeenCorrected || officesLoading}
                className="w-full gap-2"
                size="lg"
              >
                {isCorrecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Correcting Addresses...
                  </>
                ) : (
                  <>
                    <MapPin className="w-4 h-4" />
                    Correct All Partner Office Addresses
                  </>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Phase 3: Preview Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Preview</CardTitle>
              <CardDescription>
                {isLoading ? 'Loading...' : `${filteredData.length} offices selected`}
              </CardDescription>
            </div>
            <Button 
              onClick={handleExportToExcel}
              disabled={isLoading || filteredData.length === 0}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Export to Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading offices...
            </div>
          ) : filteredData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No offices match your filters. Try adjusting your selection.
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader className="bg-muted/50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead>Office Name</TableHead>
                      <TableHead>Contact Name</TableHead>
                      <TableHead>Address 1</TableHead>
                      <TableHead>Address 2</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>ZIP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{item.officeName}</TableCell>
                        <TableCell>{item.contactName || '-'}</TableCell>
                        <TableCell>{item.address1 || '-'}</TableCell>
                        <TableCell>{item.address2 || '-'}</TableCell>
                        <TableCell>{item.city || '-'}</TableCell>
                        <TableCell>{item.state || '-'}</TableCell>
                        <TableCell>{item.zip || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <FileSpreadsheet className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Excel Format</p>
              <p className="text-sm text-muted-foreground">
                The exported file will be formatted for standard mailing label sheets with columns: 
                Office Name, Contact Name, Address 1, Address 2, City, State, and ZIP.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Address Correction Dialog */}
      <AddressCorrectionDialog
        open={showCorrectionDialog}
        onOpenChange={setShowCorrectionDialog}
        corrections={correctionResults}
        onConfirm={handleApplyCorrections}
      />
    </div>
  );
}
