import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Mail, Gift, Printer, MapPin, Tag, Calendar, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TagAssignDialog } from './TagAssignDialog';
import { motion, AnimatePresence } from 'framer-motion';

interface SelectionActionBarProps {
  selectedIds: string[];
  selectedNames?: string[];
  onClear: () => void;
  onEmailCampaign?: () => void;
  onGiftCampaign?: () => void;
  onScheduleVisits?: () => void;
  isDiscoveredOffices?: boolean;
  onBulkAdd?: () => void;
  onRemove?: () => void;
}

export function SelectionActionBar({
  selectedIds,
  selectedNames = [],
  onClear,
  onEmailCampaign,
  onGiftCampaign,
  onScheduleVisits,
  isDiscoveredOffices = false,
  onBulkAdd,
  onRemove,
}: SelectionActionBarProps) {
  const navigate = useNavigate();
  const [isTagDialogOpen, setIsTagDialogOpen] = useState(false);

  const handlePrintLabels = () => {
    const idsParam = selectedIds.join(',');
    // Use discovered=true param for discovered offices
    if (isDiscoveredOffices) {
      navigate(`/mailing-labels?discovered=true&ids=${idsParam}`);
    } else {
      navigate(`/mailing-labels?ids=${idsParam}`);
    }
  };

  const handleViewOnMap = () => {
    const idsParam = selectedIds.join(',');
    if (isDiscoveredOffices) {
      navigate(`/map-view?discovered=true&ids=${idsParam}`);
    } else {
      navigate(`/map-view?ids=${idsParam}`);
    }
  };

  if (selectedIds.length === 0) return null;

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="flex items-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-xl shadow-2xl border border-primary-foreground/20">
            <span className="text-sm font-medium whitespace-nowrap">
              {selectedIds.length} selected
            </span>
            
            <div className="w-px h-6 bg-primary-foreground/30 mx-2" />

            {/* Primary Actions - Different for discovered vs network offices */}
            {isDiscoveredOffices ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onBulkAdd}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Add to Network</span>
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handlePrintLabels}
                  className="gap-2"
                >
                  <Printer className="h-4 w-4" />
                  <span className="hidden sm:inline">Labels</span>
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleViewOnMap}
                  className="gap-2"
                >
                  <MapPin className="h-4 w-4" />
                  <span className="hidden sm:inline">Map</span>
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onRemove}
                  className="gap-2 bg-destructive/10 hover:bg-destructive/20 text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Remove</span>
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onEmailCampaign}
                  className="gap-2"
                >
                  <Mail className="h-4 w-4" />
                  <span className="hidden sm:inline">Email</span>
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onGiftCampaign}
                  className="gap-2"
                >
                  <Gift className="h-4 w-4" />
                  <span className="hidden sm:inline">Gift</span>
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handlePrintLabels}
                  className="gap-2"
                >
                  <Printer className="h-4 w-4" />
                  <span className="hidden sm:inline">Labels</span>
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsTagDialogOpen(true)}
                  className="gap-2"
                >
                  <Tag className="h-4 w-4" />
                  <span className="hidden sm:inline">Tag</span>
                </Button>
              </>
            )}

            {/* More Actions Dropdown - Only for network offices */}
            {!isDiscoveredOffices && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm" className="px-2">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleViewOnMap}>
                    <MapPin className="h-4 w-4 mr-2" />
                    View on Map
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onScheduleVisits}>
                    <Calendar className="h-4 w-4 mr-2" />
                    Schedule Visits
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={onClear}
                    className="text-destructive focus:text-destructive"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear Selection
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Close button */}
            <button
              onClick={onClear}
              className="ml-2 p-1.5 rounded-lg hover:bg-primary-foreground/20 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>

      <TagAssignDialog
        isOpen={isTagDialogOpen}
        onClose={() => setIsTagDialogOpen(false)}
        officeIds={selectedIds}
        officeNames={selectedNames}
      />
    </>
  );
}
