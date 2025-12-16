import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Search, Upload, Plus, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SmartEmptyStateProps {
  type: 'offices' | 'campaigns' | 'visits' | 'labels' | 'sources';
  title?: string;
  description?: string;
  action?: ReactNode;
}

const EMPTY_STATE_CONFIG = {
  offices: {
    icon: Building2,
    title: 'No partner offices yet',
    description: 'Start building your referral network by adding partner offices or discovering nearby practices.',
    actions: [
      { label: 'Discover Nearby', path: '/discover', icon: Search, variant: 'default' as const },
      { label: 'Add Manually', path: '/offices?action=add', icon: Plus, variant: 'outline' as const },
    ],
  },
  campaigns: {
    icon: Building2,
    title: 'No campaigns yet',
    description: 'Create your first campaign to engage with your partner offices. Send emails, gifts, or schedule visits.',
    actions: [
      { label: 'Create Email Campaign', path: '/campaigns?action=new-email', icon: Plus, variant: 'default' as const },
      { label: 'Create Gift Campaign', path: '/campaigns?action=new-gift', icon: Plus, variant: 'outline' as const },
    ],
  },
  visits: {
    icon: Building2,
    title: 'No marketing visits logged',
    description: 'Track your in-person visits to partner offices. Keep a record of contacts made and materials distributed.',
    actions: [
      { label: 'Schedule a Visit', path: '/marketing-visits?action=add', icon: Plus, variant: 'default' as const },
    ],
  },
  labels: {
    icon: Building2,
    title: 'No offices to print labels for',
    description: 'Add partner offices first to generate mailing labels for your campaigns.',
    actions: [
      { label: 'Add Partner Offices', path: '/offices', icon: Plus, variant: 'default' as const },
    ],
  },
  sources: {
    icon: Building2,
    title: 'No patient sources yet',
    description: 'Track where your patients come from - online reviews, partner offices, social media, and more.',
    actions: [
      { label: 'Add Source', path: '/sources?action=add', icon: Plus, variant: 'default' as const },
      { label: 'Import CSV', path: '/sources?action=import', icon: Upload, variant: 'outline' as const },
    ],
  },
};

export function SmartEmptyState({ type, title, description, action }: SmartEmptyStateProps) {
  const navigate = useNavigate();
  const config = EMPTY_STATE_CONFIG[type];
  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      
      <h3 className="text-lg font-semibold mb-2">{title || config.title}</h3>
      <p className="text-muted-foreground max-w-md mb-6">{description || config.description}</p>
      
      {action || (
        <div className="flex flex-wrap gap-3 justify-center">
          {config.actions.map((action, index) => (
            <Button
              key={index}
              variant={action.variant}
              onClick={() => navigate(action.path)}
            >
              <action.icon className="h-4 w-4 mr-2" />
              {action.label}
            </Button>
          ))}
        </div>
      )}

      <div className="mt-8 p-4 border rounded-lg bg-muted/30 max-w-sm">
        <p className="text-sm text-muted-foreground">
          <strong>💡 Tip:</strong> The more data you add, the better insights you'll get about your referral network.
        </p>
      </div>
    </div>
  );
}
