import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Sources() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Referral Sources</h1>
          <p className="text-muted-foreground">
            Manage your referral sources and channels
          </p>
        </div>
        <Button onClick={() => navigate('?page=add-source')}>
          <Plus className="w-4 h-4 mr-2" />
          Add Source
        </Button>
      </div>

      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">
          Sources are managed through the Dashboard. Visit the Dashboard to see all your referral sources.
        </p>
        <Button onClick={() => navigate('/')} variant="outline">
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}

export default Sources;