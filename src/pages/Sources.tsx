import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Sources() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Patient Sources</h1>
          <p className="text-muted-foreground">
            Track monthly patients by source
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-12 text-center">
          <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <div className="text-muted-foreground mb-4">
            Patient sources are managed on the main dashboard where you can update monthly counts in real-time.
          </div>
          <Button onClick={() => navigate('/')} className="gap-2">
            Go to This Month
            <ArrowRight className="w-4 h-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default Sources;