import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EditableCell } from '@/components/EditableCell';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Download, Search, Filter, FileSpreadsheet, MapPin, CheckCircle2, AlertCircle, Loader2, FileText, FileDown, RotateCcw, Pencil, X, Check } from 'lucide-react';
import { downloadLabelsPDF } from '@/utils/pdfLabelGenerator';
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
import { MailingLabelPreview } from '@/components/MailingLabelPreview';

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

// PHASE 1: Enhanced address parsing with proper handling of "United States" suffix
const parseAddress = (address: string | null): ParsedAddress => {
  if (!address) {
    return { address1: '', address2: '', city: '', state: '', zip: '' };
  }

  // Clean up address - remove "United States" or "USA" from the end
  let cleanAddress = address.trim();
  cleanAddress = cleanAddress.replace(/,?\s*(United States|USA)\s*$/i, '');
  
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
    
    // Match patterns like "CA 92618" or "CA 92618-1234"
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
        
        // Try to split street address from suite/unit/apt
        // Match patterns: "#170-B", "Suite 100", "STE 300", "Unit A", etc.
        const suiteMatch = fullAddress.match(/^(.*?)\s+(Suite|Unit|Apt|Ste|STE|Building|Bldg|#)\s*(.+)$/i);
        
        if (suiteMatch) {
          address1 = suiteMatch[1].trim();
          const suiteType = suiteMatch[2].trim();
          const suiteNum = suiteMatch[3].trim();
          // Normalize the suite format
          if (suiteType === '#') {
            address2 = `#${suiteNum}`;
          } else {
            address2 = `${suiteType.charAt(0).toUpperCase() + suiteType.slice(1).toLowerCase()} ${suiteNum}`;
          }
        } else {
          address1 = fullAddress;
        }
      }
    } else {
      // Fallback: couldn't parse state/zip from last part
      // Try to find state and zip anywhere in the address
      const stateZipAnywhere = cleanAddress.match(/([A-Z]{2})\s+(\d{5}(?:-\d{4})?)/);
      if (stateZipAnywhere) {
        state = stateZipAnywhere[1];
        zip = stateZipAnywhere[2];
        
        // Try to extract city (word before state)
        const cityMatch = cleanAddress.match(/,?\s*([^,]+?)\s*,?\s*[A-Z]{2}\s+\d{5}/);
        if (cityMatch) {
          city = cityMatch[1].trim();
        }
        
        // Extract address before city/state/zip
        const addressBeforeCityState = cleanAddress.split(city)[0];
        if (addressBeforeCityState) {
          const addrMatch = addressBeforeCityState.match(/^(.*?)\s+(Suite|Unit|Apt|Ste|STE|#)\s*(.+?)$/i);
          if (addrMatch) {
            address1 = addrMatch[1].trim().replace(/,$/, '');
            const suiteType = addrMatch[2].trim();
            const suiteNum = addrMatch[3].trim().replace(/,$/, '');
            address2 = suiteType === '#' ? `#${suiteNum}` : `${suiteType.charAt(0).toUpperCase() + suiteType.slice(1).toLowerCase()} ${suiteNum}`;
          } else {
            address1 = addressBeforeCityState.trim().replace(/,$/, '');
          }
        }
      } else {
        // Ultimate fallback: just use everything as address1
        address1 = cleanAddress;
      }
    }
  } else {
    // Single part address - just use as-is
    address1 = cleanAddress;
  }

  return { address1, address2, city, state, zip };
};

// PHASE 2: Extract doctor name from office name for contact
const extractContactName = (officeName: string): string => {
  if (!officeName) return '';
  
  // Pattern 1: "Practice Name: Dr. FirstName LastName" or "Practice Name - Dr. FirstName LastName"
  const colonPattern = officeName.match(/[:–-]\s*Dr\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i);
  if (colonPattern) {
    return `Dr. ${colonPattern[1].trim()}`;
  }
  
  // Pattern 2: "Dr. FirstName LastName" at the start
  const startPattern = officeName.match(/^Dr\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i);
  if (startPattern) {
    return `Dr. ${startPattern[1].trim()}`;
  }
  
  // Pattern 3: "FirstName LastName DDS/DMD/DDS" etc at the end or anywhere
  const degreePattern = officeName.match(/([A-Z][a-z]+\s+[A-Z][a-z]+)\s*,?\s*(DDS|DMD|MD|PhD|D\.D\.S\.|D\.M\.D\.)/i);
  if (degreePattern) {
    return `Dr. ${degreePattern[1].trim()}`;
  }
  
  // Pattern 4: Just "FirstName LastName" if office name is a person's name (2-3 words, each capitalized)
  const personNamePattern = officeName.match(/^([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)$/);
  if (personNamePattern) {
    return `Dr. ${personNamePattern[1].trim()}`;
  }
  
  // Fallback: return the office name as-is
  return officeName;
};

export type LabelNameFormat = 'office' | 'contact';

export function MailingLabels() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTiers, setSelectedTiers] = useState<string[]>(['VIP', 'Warm', 'Cold', 'Dormant']);
  const [includeDiscovered, setIncludeDiscovered] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'partner' | 'discovered'>('all');
  const [showParseErrors, setShowParseErrors] = useState(false);
  const [labelNameFormat, setLabelNameFormat] = useState<LabelNameFormat>('office');
  
  // PHASE 1: Address Correction State
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [correctionProgress, setCorrectionProgress] = useState(0);
  const [showCorrectionDialog, setShowCorrectionDialog] = useState(false);
  const [correctionResults, setCorrectionResults] = useState<any[]>([]);
  const [hasBeenCorrected, setHasBeenCorrected] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

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
            contactName: extractContactName(office.name),
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
              contactName: extractContactName(office.name),
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

  // Editable data state - syncs with filtered data but allows edits
  const [editableData, setEditableData] = useState<MailingLabelData[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [hasCustomEdits, setHasCustomEdits] = useState(false);
  
  // Track the last filteredData stringified to detect real changes
  const [lastFilteredDataHash, setLastFilteredDataHash] = useState<string>('');

  // Only sync editable data when filteredData ACTUALLY changes AND no custom edits
  useEffect(() => {
    const currentHash = JSON.stringify(filteredData);
    
    // Only update if: not in edit mode, no custom edits, and data actually changed
    if (!isEditMode && !hasCustomEdits && currentHash !== lastFilteredDataHash) {
      setEditableData(filteredData);
      setLastFilteredDataHash(currentHash);
    }
  }, [filteredData, isEditMode, hasCustomEdits, lastFilteredDataHash]);

  // Handle cell edit - memoized for performance
  const handleCellEdit = useCallback((index: number, field: keyof MailingLabelData, value: string) => {
    setEditableData(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }, []);

  // Enter edit mode - preserve existing edits if any
  const handleStartEdit = () => {
    if (!hasCustomEdits) {
      setEditableData([...filteredData]);
    }
    setIsEditMode(true);
  };

  // Save edits
  const handleSaveEdits = () => {
    setHasCustomEdits(true);
    setIsEditMode(false);
    toast({
      title: "Changes saved",
      description: "Your edits have been applied to the export data.",
    });
  };

  // Cancel edits
  const handleCancelEdit = () => {
    if (hasCustomEdits) {
      // Revert to last saved state - do nothing, editableData already has saved edits
    } else {
      setEditableData(filteredData);
    }
    setIsEditMode(false);
    toast({
      title: "Edits cancelled",
      description: "Changes have been reverted.",
    });
  };

  // Reset to original data
  const handleResetToOriginal = () => {
    setEditableData(filteredData);
    setHasCustomEdits(false);
    toast({
      title: "Reset complete",
      description: "Data restored to original values.",
    });
  };

  // Get export data (uses editable data)

  // Phase 4: Excel Export
  const handleExportToExcel = () => {
    if (editableData.length === 0) {
      toast({
        title: "No data to export",
        description: "Please adjust your filters to include offices.",
        variant: "destructive",
      });
      return;
    }

    const exportData = editableData.map(item => ({
      'Name': labelNameFormat === 'office' ? item.officeName : item.contactName,
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
      { wch: 30 }, // Name
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
      description: `Exported ${editableData.length} mailing labels to ${fileName}`,
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
      const hasAnyOffices = offices.length > 0;
      const hasAddresses = offices.some(o => o.address);
      
      let description = "No partner offices with addresses found in current filter.";
      if (!hasAnyOffices) {
        description = "You don't have any partner offices yet. Add offices from the Offices page first.";
      } else if (!hasAddresses) {
        description = "Your offices don't have addresses. Add addresses to your offices first.";
      } else {
        description = "No offices match the current tier/search filters. Try adjusting your filters.";
      }
      
      toast({
        title: "No addresses to correct",
        description,
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

      console.log('Session token available:', !!session.access_token);

      toast({
        title: "Starting address correction",
        description: `Processing ${partnerOfficeIds.length} offices with Google Maps API...`,
      });

      // Call edge function via supabase client to get corrections (no auto-update)
      const { data: result, error: fnError } = await supabase.functions.invoke('correct-office-addresses', {
        body: { officeIds: partnerOfficeIds },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      console.log('Function invoke result:', { hasData: !!result, hasError: !!fnError });

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
        body: { updates },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
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
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Preview
                  {isEditMode && (
                    <Badge variant="outline" className="text-xs border-primary text-primary">
                      <Pencil className="w-3 h-3 mr-1" />
                      Editing
                    </Badge>
                  )}
                  {!isEditMode && hasCustomEdits && (
                    <Badge variant="secondary" className="text-xs">
                      <Check className="w-3 h-3 mr-1" />
                      Edited
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {isLoading ? 'Loading...' : `${editableData.length} offices selected`}
                  {isEditMode && ' • Edit cells below, then save'}
                  {!isEditMode && hasCustomEdits && ' • Custom edits applied'}
                </CardDescription>
              </div>
              {/* Label Name Format Selector */}
              <div className="flex items-center gap-3">
                <Label htmlFor="name-format" className="text-sm whitespace-nowrap">Export Name:</Label>
                <Select value={labelNameFormat} onValueChange={(value: LabelNameFormat) => setLabelNameFormat(value)}>
                  <SelectTrigger id="name-format" className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="office">Office Name</SelectItem>
                    <SelectItem value="contact">Contact Name (Dr.)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {isEditMode ? (
                <>
                  <Button 
                    onClick={handleCancelEdit}
                    variant="ghost"
                    className="gap-2"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSaveEdits}
                    variant="default"
                    className="gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Save Changes
                  </Button>
                </>
              ) : (
                <>
                  {hasCustomEdits && (
                    <Button 
                      onClick={handleResetToOriginal}
                      variant="ghost"
                      className="gap-2 text-muted-foreground"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reset
                    </Button>
                  )}
                  <Button 
                    onClick={handleStartEdit}
                    disabled={isLoading || editableData.length === 0}
                    variant="outline"
                    className="gap-2"
                  >
                    <Pencil className="w-4 h-4" />
                    Edit
                  </Button>
                  <Button 
                    onClick={() => setShowPreview(true)}
                    disabled={isLoading || editableData.length === 0}
                    variant="outline"
                    className="gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Preview Labels
                  </Button>
                  <Button 
                    onClick={() => {
                      const pdfData = editableData.map(item => ({
                        contact: labelNameFormat === 'office' ? item.officeName : item.contactName,
                        address1: item.address1,
                        address2: item.address2,
                        city: item.city,
                        state: item.state,
                        zip: item.zip,
                      }));
                      const filename = `mailing-labels-${new Date().toISOString().split('T')[0]}.pdf`;
                      downloadLabelsPDF(pdfData, '5160', { showToLabel: true }, filename);
                      toast({
                        title: "PDF Downloaded",
                        description: `Exported ${editableData.length} labels using Avery 5160 template.`,
                      });
                    }}
                    disabled={isLoading || editableData.length === 0}
                    variant="secondary"
                    className="gap-2"
                  >
                    <FileDown className="w-4 h-4" />
                    Quick PDF
                  </Button>
                  <Button 
                    onClick={handleExportToExcel}
                    disabled={isLoading || filteredData.length === 0}
                    className="gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Export Excel
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading offices...
            </div>
          ) : editableData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No offices match your filters. Try adjusting your selection.
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader className="bg-muted/50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="min-w-[180px]">Office Name</TableHead>
                      <TableHead className="min-w-[150px]">Contact Name</TableHead>
                      <TableHead className="min-w-[180px]">Address 1</TableHead>
                      <TableHead className="min-w-[120px]">Address 2</TableHead>
                      <TableHead className="min-w-[120px]">City</TableHead>
                      <TableHead className="min-w-[60px]">State</TableHead>
                      <TableHead className="min-w-[80px]">ZIP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {editableData.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className={isEditMode ? "p-1" : "font-medium"}>
                          {isEditMode ? (
                            <EditableCell
                              value={item.officeName}
                              onChange={(val) => handleCellEdit(index, 'officeName', val)}
                              className="font-medium"
                            />
                          ) : (
                            item.officeName || '-'
                          )}
                        </TableCell>
                        <TableCell className={isEditMode ? "p-1" : ""}>
                          {isEditMode ? (
                            <EditableCell
                              value={item.contactName}
                              onChange={(val) => handleCellEdit(index, 'contactName', val)}
                            />
                          ) : (
                            item.contactName || '-'
                          )}
                        </TableCell>
                        <TableCell className={isEditMode ? "p-1" : ""}>
                          {isEditMode ? (
                            <EditableCell
                              value={item.address1}
                              onChange={(val) => handleCellEdit(index, 'address1', val)}
                            />
                          ) : (
                            item.address1 || '-'
                          )}
                        </TableCell>
                        <TableCell className={isEditMode ? "p-1" : ""}>
                          {isEditMode ? (
                            <EditableCell
                              value={item.address2}
                              onChange={(val) => handleCellEdit(index, 'address2', val)}
                            />
                          ) : (
                            item.address2 || '-'
                          )}
                        </TableCell>
                        <TableCell className={isEditMode ? "p-1" : ""}>
                          {isEditMode ? (
                            <EditableCell
                              value={item.city}
                              onChange={(val) => handleCellEdit(index, 'city', val)}
                            />
                          ) : (
                            item.city || '-'
                          )}
                        </TableCell>
                        <TableCell className={isEditMode ? "p-1" : ""}>
                          {isEditMode ? (
                            <EditableCell
                              value={item.state}
                              onChange={(val) => handleCellEdit(index, 'state', val)}
                              className="w-16"
                            />
                          ) : (
                            item.state || '-'
                          )}
                        </TableCell>
                        <TableCell className={isEditMode ? "p-1" : ""}>
                          {isEditMode ? (
                            <EditableCell
                              value={item.zip}
                              onChange={(val) => handleCellEdit(index, 'zip', val)}
                              className="w-20"
                            />
                          ) : (
                            item.zip || '-'
                          )}
                        </TableCell>
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

      {/* Mailing Label Preview */}
      <MailingLabelPreview
        open={showPreview}
        onOpenChange={setShowPreview}
        data={editableData.map(item => ({
          contact: labelNameFormat === 'office' ? item.officeName : item.contactName,
          address1: item.address1,
          address2: item.address2,
          city: item.city,
          state: item.state,
          zip: item.zip,
        }))}
      />
    </div>
  );
}
