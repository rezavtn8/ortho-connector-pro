// src/components/ImportDataDialog.tsx
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { SOURCE_TYPE_CONFIG, SourceType } from '@/lib/database.types';

interface ImportDataDialogProps {
  onImportComplete?: () => void;
}

interface ParsedRow {
  source: string;
  monthlyData: { [key: string]: number };
  total: number;
}

interface DuplicateInfo {
  sourceId: string;
  sourceName: string;
  yearMonth: string;
  existingCount: number;
  newCount: number;
  monthName: string;
}

interface ConflictResolution {
  duplicateId: string;
  action: 'skip' | 'merge' | 'add';
}

export function ImportDataDialog({ onImportComplete }: ImportDataDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [preview, setPreview] = useState(false);
  const [defaultSourceType, setDefaultSourceType] = useState<SourceType>('Other');
  const [selectedYear, setSelectedYear] = useState<string>('2025');
  const [importProgress, setImportProgress] = useState<string>('');
  const [duplicates, setDuplicates] = useState<DuplicateInfo[]>([]);
  const [conflictResolutions, setConflictResolutions] = useState<ConflictResolution[]>([]);
  const [showConflicts, setShowConflicts] = useState(false);
  const { toast } = useToast();

  // Month name to month number mapping - handles various formats
  const monthMap: { [key: string]: string } = {
    'jan': '01', 'january': '01',
    'feb': '02', 'february': '02',
    'mar': '03', 'march': '03',
    'apr': '04', 'april': '04',
    'may': '05',
    'jun': '06', 'june': '06',
    'jul': '07', 'july': '07',
    'aug': '08', 'august': '08',
    'sep': '09', 'september': '09', 'sept': '09',
    'oct': '10', 'october': '10',
    'nov': '11', 'november': '11',
    'dec': '12', 'december': '12'
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      parseCSV(text);
    };
    reader.readAsText(uploadedFile);
  };

  const parseCSV = (text: string) => {
    try {
      // Split lines and handle different line endings
      const lines = text.trim().split(/\r?\n/);
      
      // Parse headers
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      // Find source column (required)
      const sourceIndex = headers.findIndex(h => h === 'source' || h === 'name');
      if (sourceIndex === -1) {
        throw new Error('CSV must have a "Source" column');
      }
      
      // Find month columns
      const monthColumns: { name: string, index: number, monthNum: string }[] = [];
      headers.forEach((header, index) => {
        const monthNum = monthMap[header];
        if (monthNum) {
          monthColumns.push({ name: header, index, monthNum });
        }
      });
      
      if (monthColumns.length === 0) {
        throw new Error('No month columns found. Use Jan, Feb, March, etc.');
      }
      
      // Find total column (optional)
      const totalIndex = headers.findIndex(h => h === 'total');
      
      // Parse data rows
      const data: ParsedRow[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue; // Skip empty lines
        
        // Handle CSV with possible commas in values (basic parsing)
        const values = line.split(',').map(v => v.trim());
        
        const sourceName = values[sourceIndex];
        if (!sourceName) continue;
        
        const monthlyData: { [key: string]: number } = {};
        let calculatedTotal = 0;
        
        monthColumns.forEach(({ name, index, monthNum }) => {
          const value = parseFloat(values[index]) || 0;
          const capitalizedMonth = name.charAt(0).toUpperCase() + name.slice(1);
          monthlyData[capitalizedMonth] = value;
          calculatedTotal += value;
        });
        
        // Use provided total or calculated total
        const total = totalIndex >= 0 ? 
          (parseFloat(values[totalIndex]) || calculatedTotal) : 
          calculatedTotal;
        
        if (calculatedTotal > 0) { // Only add if there's data
          data.push({
            source: sourceName,
            monthlyData,
            total
          });
        }
      }
      
      if (data.length === 0) {
        throw new Error('No valid data found in CSV');
      }
      
      setParsedData(data);
      setPreview(true);
      
      toast({
        title: "File Parsed Successfully",
        description: `Found ${data.length} sources with patient data`,
      });
    } catch (error: any) {
      console.error('Error parsing CSV:', error);
      toast({
        title: "Parse Error",
        description: error.message || "Failed to parse CSV file. Please check the format.",
        variant: "destructive",
      });
      setFile(null);
    }
  };

  const performImport = async () => {
    if (!parsedData.length) return;
    
    setLoading(true);
    setImportProgress('Starting import...');
    
    let sourcesCreated = 0;
    let sourcesUpdated = 0;
    let dataPointsCreated = 0;
    let errors: string[] = [];
    
    try {
      for (let i = 0; i < parsedData.length; i++) {
        const row = parsedData[i];
        setImportProgress(`Processing ${i + 1} of ${parsedData.length}: ${row.source}`);
        
        try {
          // Check if source exists
          const { data: existingSource, error: searchError } = await supabase
            .from('patient_sources')
            .select('id')
            .eq('name', row.source)
            .maybeSingle();
          
          if (searchError && searchError.code !== 'PGRST116') {
            throw searchError;
          }
          
          let sourceId: string;
          
          if (!existingSource) {
            // Create new source
            const { data: newSource, error: createError } = await supabase
              .from('patient_sources')
              .insert({
                name: row.source,
                source_type: defaultSourceType,
                is_active: true
              })
              .select('id')
              .single();
            
            if (createError) {
              errors.push(`Failed to create source "${row.source}": ${createError.message}`);
              continue;
            }
            
            sourceId = newSource.id;
            sourcesCreated++;
          } else {
            sourceId = existingSource.id;
            sourcesUpdated++;
          }
          
          // Import monthly data
          for (const [monthName, count] of Object.entries(row.monthlyData)) {
            if (count <= 0) continue;
            
            const monthNum = monthMap[monthName.toLowerCase()];
            if (!monthNum) continue;
            
            const yearMonth = `${selectedYear}-${monthNum}`;
            
            // Check if record exists
            const { data: existing, error: checkError } = await supabase
              .from('monthly_patients')
              .select('id, patient_count')
              .eq('source_id', sourceId)
              .eq('year_month', yearMonth)
              .maybeSingle();
            
            if (checkError && checkError.code !== 'PGRST116') {
              errors.push(`Error checking ${monthName} for ${row.source}: ${checkError.message}`);
              continue;
            }
            
            if (existing) {
              // Find conflict resolution for this duplicate
              const duplicateId = `${sourceId}-${yearMonth}`;
              const resolution = conflictResolutions.find(cr => cr.duplicateId === duplicateId);
              const action = resolution?.action || 'skip';
              
              let newCount = Math.round(count);
              
              if (action === 'skip') {
                // Skip this record, don't update
                continue;
              } else if (action === 'merge') {
                // Add to existing count
                newCount = existing.patient_count + Math.round(count);
              } else if (action === 'add') {
                // Replace existing count
                newCount = Math.round(count);
              }
              
              // Update existing record
              const { error: updateError } = await supabase
                .from('monthly_patients')
                .update({ 
                  patient_count: newCount,
                  updated_at: new Date().toISOString()
                })
                .eq('id', existing.id);
              
              if (updateError) {
                errors.push(`Failed to update ${monthName} for ${row.source}: ${updateError.message}`);
              } else {
                dataPointsCreated++;
              }
            } else {
              // Insert new record
              const { error: insertError } = await supabase
                .from('monthly_patients')
                .insert({
                  source_id: sourceId,
                  year_month: yearMonth,
                  patient_count: Math.round(count)
                });
              
              if (insertError) {
                errors.push(`Failed to insert ${monthName} for ${row.source}: ${insertError.message}`);
              } else {
                dataPointsCreated++;
              }
            }
          }
        } catch (error: any) {
          errors.push(`Error processing ${row.source}: ${error.message}`);
        }
      }
      
      setImportProgress('');
      
      // Show results
      let message = `Import complete!\n`;
      message += `• ${sourcesCreated} new sources created\n`;
      message += `• ${sourcesUpdated} existing sources updated\n`;
      message += `• ${dataPointsCreated} monthly data points imported`;
      
      if (errors.length > 0) {
        message += `\n\n⚠️ ${errors.length} errors occurred`;
        console.error('Import errors:', errors);
      }
      
      toast({
        title: errors.length > 0 ? "Import Completed with Warnings" : "Import Successful",
        description: message,
        variant: errors.length > 0 ? "default" : "default",
      });
      
      // Reset and close
      setOpen(false);
      setParsedData([]);
      setFile(null);
      setPreview(false);
      setDuplicates([]);
      setConflictResolutions([]);
      setShowConflicts(false);
      
      onImportComplete?.();
    } catch (error: any) {
      console.error('Fatal import error:', error);
      toast({
        title: "Import Failed",
        description: error.message || "A critical error occurred during import",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setImportProgress('');
    }
  };

  const importData = async () => {
    await checkForDuplicates();
  };

  const downloadTemplate = () => {
    const template = `Source,Jan,Feb,March,April,May,June,July,Aug,Sep,Oct,Nov,Dec,Total
Dr. Smith's Dental,10,12,15,8,20,18,22,25,19,21,23,20,213
City Medical Center,5,8,6,10,12,9,11,13,14,10,12,15,125
Online Referrals,3,4,5,3,6,7,8,5,4,6,5,4,60
Insurance Partners,2,3,4,2,5,4,6,7,5,4,3,2,47`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'patient-data-template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };


  // Generate year options (current year and 5 years back)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear + 1 - i);

  const checkForDuplicates = async () => {
    if (!parsedData.length) return;
    
    setLoading(true);
    setImportProgress('Checking for duplicates...');
    
    const foundDuplicates: DuplicateInfo[] = [];
    
    try {
      for (const row of parsedData) {
        // Check if source exists
        const { data: existingSource, error: searchError } = await supabase
          .from('patient_sources')
          .select('id')
          .eq('name', row.source)
          .maybeSingle();
        
        if (searchError && searchError.code !== 'PGRST116') {
          continue;
        }
        
        if (existingSource) {
          // Check for existing monthly data
          for (const [monthName, count] of Object.entries(row.monthlyData)) {
            if (count <= 0) continue;
            
            const monthNum = monthMap[monthName.toLowerCase()];
            if (!monthNum) continue;
            
            const yearMonth = `${selectedYear}-${monthNum}`;
            
            const { data: existing, error: checkError } = await supabase
              .from('monthly_patients')
              .select('id, patient_count')
              .eq('source_id', existingSource.id)
              .eq('year_month', yearMonth)
              .maybeSingle();
            
            if (checkError && checkError.code !== 'PGRST116') {
              continue;
            }
            
            if (existing) {
              foundDuplicates.push({
                sourceId: existingSource.id,
                sourceName: row.source,
                yearMonth,
                existingCount: existing.patient_count,
                newCount: count,
                monthName
              });
            }
          }
        }
      }
      
      if (foundDuplicates.length > 0) {
        setDuplicates(foundDuplicates);
        setConflictResolutions(foundDuplicates.map(d => ({
          duplicateId: `${d.sourceId}-${d.yearMonth}`,
          action: 'skip'
        })));
        setShowConflicts(true);
      } else {
        // No duplicates, proceed with import
        await performImport();
      }
    } catch (error: any) {
      console.error('Error checking duplicates:', error);
      toast({
        title: "Error",
        description: "Failed to check for duplicates",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setImportProgress('');
    }
  };

  const updateConflictResolution = (duplicateId: string, action: 'skip' | 'merge' | 'add') => {
    setConflictResolutions(prev => 
      prev.map(cr => 
        cr.duplicateId === duplicateId ? { ...cr, action } : cr
      )
    );
  };

  const resolveConflictsAndImport = async () => {
    setShowConflicts(false);
    await performImport();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="w-4 h-4 mr-2" />
          Import CSV Data
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Patient Data from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file with monthly patient counts to import historical data
          </DialogDescription>
        </DialogHeader>

        {!preview ? (
          <div className="space-y-6">
            {/* File Format Info */}
            <Alert>
              <FileSpreadsheet className="h-4 w-4" />
              <AlertDescription>
                <div className="mt-2 space-y-2">
                  <p className="font-semibold">Required CSV Format:</p>
                  <ul className="text-sm list-disc list-inside space-y-1">
                    <li>First column: <strong>Source</strong> (source/office name)</li>
                    <li>Month columns: <strong>Jan, Feb, March, April, May, June, July, Aug, Sep, Oct, Nov, Dec</strong></li>
                    <li>Optional: <strong>Total</strong> column (will be calculated if not provided)</li>
                    <li>Values should be numbers (decimals will be rounded)</li>
                  </ul>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={downloadTemplate}
                    className="p-0 h-auto"
                  >
                    <Download className="w-3 h-3 mr-1" />
                    Download Template CSV
                  </Button>
                </div>
              </AlertDescription>
            </Alert>

            {/* Import Settings */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Year for Import</Label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {yearOptions.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    All monthly data will be imported for this year (default: 2025)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Default Source Type</Label>
                  <select
                    value={defaultSourceType}
                    onChange={(e) => setDefaultSourceType(e.target.value as SourceType)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {Object.entries(SOURCE_TYPE_CONFIG).map(([key, config]) => (
                      <option key={key} value={key}>
                        {config.icon} {config.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Type for new sources created during import
                  </p>
                </div>
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <Label htmlFor="csv-file">Select CSV File</Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  disabled={loading}
                />
                {file && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {file.name}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : showConflicts ? (
          <div className="space-y-4">
            {/* Conflicts Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-destructive">Duplicate Data Detected</h3>
                <p className="text-sm text-muted-foreground">
                  {duplicates.length} conflicts found. Choose how to handle each duplicate:
                </p>
              </div>
            </div>

            {/* Conflicts List */}
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {duplicates.map((duplicate, index) => {
                const resolution = conflictResolutions.find(cr => cr.duplicateId === `${duplicate.sourceId}-${duplicate.yearMonth}`)?.action || 'skip';
                return (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{duplicate.sourceName}</p>
                        <p className="text-sm text-muted-foreground">
                          {duplicate.monthName} {selectedYear}
                        </p>
                      </div>
                      <Badge variant="destructive">Duplicate</Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Existing Count:</p>
                        <p className="font-medium">{duplicate.existingCount}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">New Count:</p>
                        <p className="font-medium">{duplicate.newCount}</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={resolution === 'skip' ? 'default' : 'outline'}
                        onClick={() => updateConflictResolution(`${duplicate.sourceId}-${duplicate.yearMonth}`, 'skip')}
                      >
                        Skip
                      </Button>
                      <Button
                        size="sm"
                        variant={resolution === 'merge' ? 'default' : 'outline'}
                        onClick={() => updateConflictResolution(`${duplicate.sourceId}-${duplicate.yearMonth}`, 'merge')}
                      >
                        Merge ({duplicate.existingCount + duplicate.newCount})
                      </Button>
                      <Button
                        size="sm"
                        variant={resolution === 'add' ? 'default' : 'outline'}
                        onClick={() => updateConflictResolution(`${duplicate.sourceId}-${duplicate.yearMonth}`, 'add')}
                      >
                        Replace
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Conflict Actions */}
            <div className="flex justify-between items-center pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setShowConflicts(false);
                  setDuplicates([]);
                  setConflictResolutions([]);
                }}
                disabled={loading}
              >
                Back to Preview
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={resolveConflictsAndImport}
                  disabled={loading}
                >
                  {loading ? 'Importing...' : 'Proceed with Import'}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Preview Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Preview Import Data</h3>
                <p className="text-sm text-muted-foreground">
                  {parsedData.length} sources found • Year: {selectedYear}
                </p>
              </div>
              <Badge variant="secondary">
                {defaultSourceType}
              </Badge>
            </div>

            {/* Preview Table */}
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-[300px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="text-left p-2 font-medium">Source</th>
                      {Object.keys(parsedData[0]?.monthlyData || {}).slice(0, 6).map(month => (
                        <th key={month} className="text-center p-2 font-medium">{month.slice(0, 3)}</th>
                      ))}
                      <th className="text-center p-2 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.slice(0, 10).map((row, index) => {
                      const months = Object.keys(row.monthlyData);
                      return (
                        <tr key={index} className="border-t">
                          <td className="p-2 font-medium">{row.source}</td>
                          {months.slice(0, 6).map(month => (
                            <td key={month} className="text-center p-2">
                              {row.monthlyData[month] || 0}
                            </td>
                          ))}
                          <td className="text-center p-2 font-semibold">{row.total}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {parsedData.length > 10 && (
                <div className="bg-muted p-2 text-center text-sm text-muted-foreground">
                  And {parsedData.length - 10} more sources...
                </div>
              )}
            </div>

            {/* Import Progress */}
            {importProgress && (
              <Alert>
                <AlertCircle className="h-4 w-4 animate-spin" />
                <AlertDescription>{importProgress}</AlertDescription>
              </Alert>
            )}

            {/* Import Actions */}
            <div className="flex justify-between items-center">
              <Button
                variant="outline"
                onClick={() => {
                  setPreview(false);
                  setParsedData([]);
                  setFile(null);
                }}
                disabled={loading}
              >
                Back to Upload
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={importData}
                  disabled={loading}
                >
                  {loading ? (
                    <>Importing... Please wait</>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Import {parsedData.length} Sources
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}