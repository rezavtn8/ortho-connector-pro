import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Share2, Plus } from 'lucide-react';
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
        <Button onClick={() => navigate('/')}>
          <Plus className="w-4 h-4 mr-2" />
          Add Source (Coming Soon)
        </Button>
      </div>

      <Card>
        <CardContent className="p-12 text-center">
          <Share2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-semibold mb-2">Sources Management Coming Soon</h3>
          <p className="text-muted-foreground">
            This feature is under development
          </p>
          <Button 
            className="mt-4"
            variant="outline"
            onClick={() => navigate('/')}
          >
            Back to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default Sources;