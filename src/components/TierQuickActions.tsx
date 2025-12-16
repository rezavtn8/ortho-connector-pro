import { useNavigate } from 'react-router-dom';
import { Mail, Printer, Calendar, ChevronDown, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TierQuickActionsProps {
  tier: string;
  officeIds: string[];
  onEmailCampaign?: (tier: string, ids: string[]) => void;
  onGiftCampaign?: (tier: string, ids: string[]) => void;
  onScheduleVisits?: (tier: string, ids: string[]) => void;
}

export function TierQuickActions({
  tier,
  officeIds,
  onEmailCampaign,
  onGiftCampaign,
  onScheduleVisits,
}: TierQuickActionsProps) {
  const navigate = useNavigate();

  if (officeIds.length === 0) return null;

  const handlePrintLabels = () => {
    navigate(`/mailing-labels?tier=${tier}`);
  };

  const handleViewOnMap = () => {
    navigate(`/map-view?tier=${tier}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 px-1.5 ml-1">
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem onClick={() => onEmailCampaign?.(tier, officeIds)}>
          <Mail className="h-4 w-4 mr-2" />
          Email All {tier}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onGiftCampaign?.(tier, officeIds)}>
          <Gift className="h-4 w-4 mr-2" />
          Gift Campaign
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePrintLabels}>
          <Printer className="h-4 w-4 mr-2" />
          Print {tier} Labels
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onScheduleVisits?.(tier, officeIds)}>
          <Calendar className="h-4 w-4 mr-2" />
          Schedule Visits
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
