import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  MapPin, Search, Building2, ArrowRight, ArrowLeft, Navigation, Clock,
  AlertCircle, Star, Globe, Stethoscope, Check,
} from 'lucide-react';

/** What the search actually asks Google for. */
export interface DiscoverySearch {
  distance: number;
  zipCode: string;
}

/**
 * How results are presented.
 *
 * These never reach the edge function. Discovery saves every dental office
 * inside the radius, and these preferences filter what you see — so changing
 * one is instant and free instead of costing a fresh search, and the numbers
 * on screen always match the filter that produced them.
 */
export interface DiscoveryPreferences {
  officeType: string;
  minRating: number;
  includeSpecialties: boolean;
  requireWebsite: boolean;
}

export interface DiscoveryUsage {
  used: number;
  limit: number;
  resetsAt?: string | null;
}

interface DiscoveryWizardProps {
  onDiscover: (search: DiscoverySearch, preferences: DiscoveryPreferences) => Promise<void>;
  isLoading: boolean;
  usage: DiscoveryUsage;
  preferences: DiscoveryPreferences;
  clinicName?: string | null;
  hasClinicLocation: boolean;
  compact?: boolean;
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

const RATING_OPTIONS = [
  { value: 0, label: 'Any Rating' },
  { value: 3.5, label: '3.5+ Stars' },
  { value: 4.0, label: '4.0+ Stars' },
  { value: 4.5, label: '4.5+ Stars' },
];

const TOTAL_STEPS = 4;

/**
 * Status text while a search runs.
 *
 * A wide search legitimately takes 15-30 seconds because it sweeps the area in
 * tiles. A spinner with no explanation reads as a hang, so the stages say what
 * is happening and roughly track how long each part takes.
 */
const PROGRESS_STAGES = [
  { after: 0, label: 'Locating your search area…' },
  { after: 3, label: 'Sweeping the area for dental practices…' },
  { after: 9, label: 'Covering dense neighbourhoods in finer detail…' },
  { after: 16, label: 'Searching for specialists…' },
  { after: 24, label: 'Checking each office against your network…' },
  { after: 34, label: 'Still working — large areas take a little longer…' },
];

function useProgressLabel(isLoading: boolean): string {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isLoading) {
      setElapsed(0);
      return;
    }
    const started = Date.now();
    const timer = setInterval(() => setElapsed((Date.now() - started) / 1000), 1000);
    return () => clearInterval(timer);
  }, [isLoading]);

  const stage = [...PROGRESS_STAGES].reverse().find((s) => elapsed >= s.after);
  return stage?.label ?? PROGRESS_STAGES[0].label;
}

export const DiscoveryWizard: React.FC<DiscoveryWizardProps> = ({
  onDiscover,
  isLoading,
  usage,
  preferences,
  clinicName,
  hasClinicLocation,
  compact = false,
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [search, setSearch] = useState<DiscoverySearch>({ distance: 5, zipCode: '' });
  const [draft, setDraft] = useState<DiscoveryPreferences>(preferences);

  const progressLabel = useProgressLabel(isLoading);

  const zip = search.zipCode.trim();
  const zipError = zip.length > 0 && !/^\d{5}$/.test(zip)
    ? 'Enter a 5-digit ZIP code, or leave this empty to search from your clinic.'
    : null;

  // Without a clinic address and without a ZIP there is nothing to search
  // around, so the wizard says so up front instead of failing at the last step.
  const missingLocation = !hasClinicLocation && zip.length === 0;

  const remaining = Math.max(0, usage.limit - usage.used);
  const outOfSearches = remaining === 0;
  const canSubmit = !isLoading && !zipError && !missingLocation && !outOfSearches;

  const handleDiscover = async () => {
    if (!canSubmit) return;
    await onDiscover({ ...search, zipCode: zip }, draft);
  };

  const formatResetDate = () => {
    if (!usage.resetsAt) return null;
    return new Date(usage.resetsAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const searchOrigin = zip
    ? `ZIP ${zip}`
    : clinicName
      ? `${clinicName} (your clinic)`
      : 'your clinic';

  const activePreferences = [
    draft.officeType !== 'all' ? OFFICE_TYPES.find((t) => t.value === draft.officeType)?.label : null,
    draft.minRating > 0 ? `${draft.minRating}+ stars` : null,
    draft.requireWebsite ? 'has a website' : null,
    !draft.includeSpecialties ? 'general dentists only' : null,
  ].filter(Boolean) as string[];

  return (
    <Card className={compact ? 'border-0 shadow-none' : 'max-w-2xl mx-auto'}>
      <CardHeader className={compact ? 'px-0 pt-0' : undefined}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            🔍 Discovery Assistant
          </CardTitle>
          <Badge variant="outline" className="text-sm">
            Step {currentStep} of {TOTAL_STEPS}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Search className="w-4 h-4" />
          <span>Define your search parameters to find dental offices in your area</span>
        </div>
      </CardHeader>

      <CardContent className={`space-y-6 ${compact ? 'px-0 pb-0' : ''}`}>
        {/* Progress Bar */}
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex items-center">
              <button
                type="button"
                onClick={() => setCurrentStep(step)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step <= currentStep
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted-foreground/20'
                }`}
                aria-label={`Go to step ${step}`}
              >
                {step}
              </button>
              {step < TOTAL_STEPS && (
                <div className={`h-0.5 w-6 ${step < currentStep ? 'bg-primary' : 'bg-muted'}`} />
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
                Every dental office inside this radius is found and saved. Nothing outside it is.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {DISTANCE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSearch((prev) => ({ ...prev, distance: option.value }))}
                  className={`p-4 rounded-lg border-2 transition-all text-left hover:shadow-md ${
                    search.distance === option.value
                      ? 'border-primary bg-primary/5 shadow-md'
                      : 'border-muted hover:border-primary/50'
                  }`}
                >
                  <div className="font-medium">{option.label}</div>
                  <div className="text-sm text-muted-foreground">{option.description}</div>
                </button>
              ))}
            </div>

            {search.distance >= 25 && (
              <p className="text-xs text-muted-foreground flex items-start gap-2">
                <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                A {search.distance}-mile search covers a lot of ground and can take 20–40 seconds.
              </p>
            )}
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
              <div className={`p-4 rounded-lg ${hasClinicLocation ? 'bg-muted/50' : 'bg-destructive/5 border border-destructive/20'}`}>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Building2 className="w-4 h-4 text-primary" />
                  {hasClinicLocation
                    ? `Default: ${clinicName ?? 'Your Clinic'}`
                    : 'No clinic location on file'}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {hasClinicLocation
                    ? "Search will be centered around your clinic's address"
                    : 'Add your clinic address in Settings, or search by ZIP code below.'}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="discovery-zip">
                  Override with ZIP Code (Optional)
                </label>
                <Input
                  id="discovery-zip"
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="Enter ZIP code to search elsewhere..."
                  value={search.zipCode}
                  onChange={(e) =>
                    setSearch((prev) => ({ ...prev, zipCode: e.target.value.replace(/\D/g, '') }))
                  }
                  className={`max-w-xs ${zipError ? 'border-destructive' : ''}`}
                  aria-invalid={zipError != null}
                />
                {zipError ? (
                  <p className="text-xs text-destructive flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {zipError}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Leave empty to use your clinic's location
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Result preferences */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Star className="w-5 h-5 text-primary" />
                Result Preferences
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Narrow down what appears in your results. The search itself always looks for
                everything, so you can change these at any time without running a new search.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Minimum Rating</label>
                <Select
                  value={draft.minRating.toString()}
                  onValueChange={(value) =>
                    setDraft((prev) => ({ ...prev, minRating: parseFloat(value) }))
                  }
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
                {draft.minRating > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Offices Google has no rating for are hidden by this.
                  </p>
                )}
              </div>

              <label
                htmlFor="includeSpecialties"
                className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/40 transition-colors"
              >
                <input
                  type="checkbox"
                  id="includeSpecialties"
                  checked={draft.includeSpecialties}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, includeSpecialties: e.target.checked }))
                  }
                  className="rounded border-muted mt-0.5"
                />
                <span>
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-primary" />
                    Include specialty practices
                  </span>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    Orthodontics, oral surgery, endodontics, periodontics and multi-specialty groups.
                  </span>
                </span>
              </label>

              <label
                htmlFor="requireWebsite"
                className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/40 transition-colors"
              >
                <input
                  type="checkbox"
                  id="requireWebsite"
                  checked={draft.requireWebsite}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, requireWebsite: e.target.checked }))
                  }
                  className="rounded border-muted mt-0.5"
                />
                <span>
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Globe className="w-4 h-4 text-primary" />
                    Only practices with websites
                  </span>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    Useful when you plan to research each office before reaching out.
                  </span>
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Step 4: Office type + review */}
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
                value={draft.officeType}
                onValueChange={(value) => setDraft((prev) => ({ ...prev, officeType: value }))}
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

            {/* Review */}
            <div className="mt-6 p-4 rounded-lg border bg-muted/30 space-y-2">
              <div className="text-sm font-medium flex items-center gap-2">
                <Check className="w-4 h-4 text-primary" />
                Ready to search
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>
                  <span className="text-foreground font-medium">{search.distance} miles</span> around{' '}
                  <span className="text-foreground font-medium">{searchOrigin}</span>
                </li>
                <li>
                  Showing:{' '}
                  <span className="text-foreground font-medium">
                    {activePreferences.length > 0 ? activePreferences.join(', ') : 'every office found'}
                  </span>
                </li>
              </ul>
            </div>

            {/* Weekly Usage Display */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Fresh searches this week</span>
                </div>
                <Badge variant={outOfSearches ? 'destructive' : 'secondary'}>
                  {usage.used} of {usage.limit} used
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {outOfSearches
                  ? `Limit reached${formatResetDate() ? ` — one frees up on ${formatResetDate()}` : ''}. Results you've already found are still available.`
                  : 'Re-running a search you already ran this week is free — results are reused for 7 days.'}
              </p>
            </div>

            {missingLocation && (
              <p className="text-sm text-destructive flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                Add your clinic address in Settings, or go back and enter a ZIP code to search.
              </p>
            )}
          </div>
        )}

        {isLoading && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <div className="w-4 h-4 animate-spin rounded-full border-2 border-primary border-t-transparent shrink-0" />
            <span className="text-sm text-muted-foreground">{progressLabel}</span>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-4">
          <Button
            variant="outline"
            onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
            disabled={currentStep === 1 || isLoading}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>

          {currentStep < TOTAL_STEPS ? (
            <Button
              onClick={() => setCurrentStep((s) => Math.min(TOTAL_STEPS, s + 1))}
              disabled={currentStep === 2 && zipError != null}
              className="flex items-center gap-2 bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleDiscover}
              disabled={!canSubmit}
              className="flex items-center gap-2 bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90"
              size="lg"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Discovering...
                </>
              ) : (
                <>🔍 Discover Offices</>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
