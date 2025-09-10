import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Search, Building2, ArrowRight, ArrowLeft, Navigation, Clock } from 'lucide-react';

interface DiscoveryParams {
  distance: number;
  zipCode?: string;
  officeType?: string;
  minRating?: number;
  searchStrategy?: string;
  includeSpecialties?: boolean;
  requireWebsite?: boolean;
}

interface DiscoveryWizardProps {
  onDiscover: (params: DiscoveryParams) => Promise<void>;
  isLoading: boolean;
  weeklyUsage: { used: number; limit: number };
  canDiscover: boolean;
  nextRefreshDate?: Date;
}

const DISTANCE_OPTIONS = [
  { value: 1, label: '1 mile', description: 'Walking Distance' },
  { value: 3, label: '3 miles', description: 'Nearby Area' },
  { value: 5, label: '5 miles', description: 'Local Area' },
  { value: 10, label: '10 miles', description: 'Extended Area' },
  { value: 15, label: '15 miles', description: 'Wide Network' },
  { value: 25, label: '25 miles', description: 'Regional Network' },
  { value: 50, label: '50 miles', description: 'Metropolitan Area' },
];

const OFFICE_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'General Dentist', label: 'General Dentist' },
  { value: 'Pediatric', label: 'Pediatric Dentistry' },
  { value: 'Orthodontics', label: 'Orthodontics' },
  { value: 'Oral Surgery', label: 'Oral Surgery' },
  { value: 'Endodontics', label: 'Endodontics' },
  { value: 'Periodontics', label: 'Periodontics' },
  { value: 'Multi-specialty', label: 'Multi-specialty' },
];

const SEARCH_STRATEGIES = [
  { value: 'comprehensive', label: 'Comprehensive Search', description: 'Finds all dental practices using multiple search methods' },
  { value: 'nearby', label: 'Nearby Search', description: 'Quick search for offices in immediate vicinity' },
  { value: 'specialty', label: 'Specialty Focus', description: 'Targets specialized dental practices' },
  { value: 'high_rated', label: 'High-Rated Only', description: 'Focuses on highly-rated practices' },
];

const RATING_OPTIONS = [
  { value: 0, label: 'Any Rating' },
  { value: 3.5, label: '3.5+ Stars' },
  { value: 4.0, label: '4.0+ Stars' },
  { value: 4.5, label: '4.5+ Stars' },
];

export const DiscoveryWizard: React.FC<DiscoveryWizardProps> = ({
  onDiscover,
  isLoading,
  weeklyUsage,
  canDiscover,
  nextRefreshDate
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [params, setParams] = useState<DiscoveryParams>({
    distance: 5,
    zipCode: '',
    officeType: 'all',
    minRating: 0,
    searchStrategy: 'comprehensive',
    includeSpecialties: true,
    requireWebsite: false
  });

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleDiscover = async () => {
    await onDiscover(params);
  };

  const formatNextRefreshDate = () => {
    if (!nextRefreshDate) return '';
    return nextRefreshDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            🔍 Discovery Assistant
          </CardTitle>
          <Badge variant="outline" className="text-sm">
            Step {currentStep} of 4
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Search className="w-4 h-4" />
          <span>Define your search parameters to find dental offices in your area</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Progress Bar */}
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step <= currentStep 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground'
              }`}>
                {step}
              </div>
              {step < 4 && (
                <div className={`h-0.5 w-6 ${
                  step < currentStep ? 'bg-primary' : 'bg-muted'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Distance Range */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Navigation className="w-5 h-5 text-primary" />
                Select Search Distance
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Choose how far from your clinic to search for dental offices
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {DISTANCE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setParams(prev => ({ ...prev, distance: option.value }))}
                  className={`p-4 rounded-lg border-2 transition-all text-left hover:shadow-md ${
                    params.distance === option.value
                      ? 'border-primary bg-primary/5 shadow-md'
                      : 'border-muted hover:border-primary/50'
                  }`}
                >
                  <div className="font-medium">{option.label}</div>
                  <div className="text-sm text-muted-foreground">{option.description}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Location Settings */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                Location Settings
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Search will default to your clinic location, or enter a ZIP code to search elsewhere
              </p>
            </div>

            <div className="space-y-3">
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Building2 className="w-4 h-4 text-primary" />
                  Default: Your Clinic Location
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Search will be centered around your clinic's address
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Override with ZIP Code (Optional)</label>
                <Input
                  placeholder="Enter ZIP code to search elsewhere..."
                  value={params.zipCode}
                  onChange={(e) => setParams(prev => ({ ...prev, zipCode: e.target.value }))}
                  className="max-w-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to use your clinic's location
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Search Strategy */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Search className="w-5 h-5 text-primary" />
                Search Strategy
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Choose how comprehensive you want the search to be
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SEARCH_STRATEGIES.map((strategy) => (
                <button
                  key={strategy.value}
                  onClick={() => setParams(prev => ({ ...prev, searchStrategy: strategy.value }))}
                  className={`p-4 rounded-lg border-2 transition-all text-left hover:shadow-md ${
                    params.searchStrategy === strategy.value
                      ? 'border-primary bg-primary/5 shadow-md'
                      : 'border-muted hover:border-primary/50'
                  }`}
                >
                  <div className="font-medium">{strategy.label}</div>
                  <div className="text-sm text-muted-foreground">{strategy.description}</div>
                </button>
              ))}
            </div>

            <div className="space-y-4 mt-6">
              <div className="space-y-3">
                <label className="text-sm font-medium">Minimum Rating</label>
                <Select
                  value={params.minRating?.toString()}
                  onValueChange={(value) => setParams(prev => ({ ...prev, minRating: parseFloat(value) }))}
                >
                  <SelectTrigger className="w-full max-w-xs">
                    <SelectValue placeholder="Select minimum rating..." />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border shadow-lg z-50">
                    {RATING_OPTIONS.map((rating) => (
                      <SelectItem key={rating.value} value={rating.value.toString()}>
                        {rating.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="includeSpecialties"
                    checked={params.includeSpecialties}
                    onChange={(e) => setParams(prev => ({ ...prev, includeSpecialties: e.target.checked }))}
                    className="rounded border-muted"
                  />
                  <label htmlFor="includeSpecialties" className="text-sm font-medium">
                    Include specialty practices (orthodontics, oral surgery, etc.)
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="requireWebsite"
                    checked={params.requireWebsite}
                    onChange={(e) => setParams(prev => ({ ...prev, requireWebsite: e.target.checked }))}
                    className="rounded border-muted"
                  />
                  <label htmlFor="requireWebsite" className="text-sm font-medium">
                    Only practices with websites
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Office Type Filter */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                Office Type Preference
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Filter results by type of dental practice (optional)
              </p>
            </div>

            <div className="space-y-3">
              <Select
                value={params.officeType}
                onValueChange={(value) => setParams(prev => ({ ...prev, officeType: value }))}
              >
                <SelectTrigger className="w-full max-w-xs">
                  <SelectValue placeholder="Select office type..." />
                </SelectTrigger>
                <SelectContent className="bg-popover border shadow-lg z-50">
                  {OFFICE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="text-sm text-muted-foreground">
                Types are inferred from office names and Google categories
              </div>
            </div>

            {/* Weekly Usage Display */}
            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Weekly API Usage</span>
                </div>
                <Badge variant={weeklyUsage.used >= weeklyUsage.limit ? "destructive" : "secondary"}>
                  {weeklyUsage.used} of {weeklyUsage.limit} used
                </Badge>
              </div>
              {!canDiscover && nextRefreshDate && (
                <p className="text-xs text-muted-foreground mt-2">
                  Next discovery available: {formatNextRefreshDate()}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-4">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>

          {currentStep < 4 ? (
            <Button
              onClick={handleNext}
              className="flex items-center gap-2 bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleDiscover}
              disabled={isLoading || !canDiscover}
              className="flex items-center gap-2 bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90"
              size="lg"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Discovering...
                </>
              ) : (
                <>
                  🔍 Discover Offices
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};