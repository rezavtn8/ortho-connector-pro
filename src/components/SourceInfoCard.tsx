import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PatientSource } from '@/lib/database.types';
import { Phone, Mail, Globe, Edit, MapPin, Star, Building } from 'lucide-react';

interface SourceInfoCardProps {
  source: PatientSource;
  onEdit: () => void;
}

export function SourceInfoCard({ source, onEdit }: SourceInfoCardProps) {
  const renderStars = (rating?: number) => {
    if (!rating) return <span className="text-muted-foreground">-</span>;
    return (
      <div className="flex">
        {[1, 2, 3, 4, 5].map(star => (
          <Star
            key={star}
            className={`w-4 h-4 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
          />
        ))}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building className="w-5 h-5" />
            Source Information
          </CardTitle>
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Edit className="w-4 h-4 mr-2" />
            Edit Details
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {source.phone && (
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{source.phone}</p>
              </div>
            </div>
          )}
          
          {source.email && (
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{source.email}</p>
              </div>
            </div>
          )}
          
          {source.website && (
            <div className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Website</p>
                <a 
                  href={source.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  {source.website}
                </a>
              </div>
            </div>
          )}
          
          {source.address && (
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Address</p>
                <p className="font-medium">{source.address}</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Ratings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
              <span className="text-sm font-medium">G</span>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Google Rating</p>
              <div className="flex items-center gap-2">
                {renderStars(source.google_rating)}
                {source.google_rating && (
                  <span className="text-sm font-medium">{source.google_rating}</span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100 text-red-600">
              <span className="text-sm font-medium">Y</span>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Yelp Rating</p>
              <div className="flex items-center gap-2">
                {renderStars(source.yelp_rating)}
                {source.yelp_rating && (
                  <span className="text-sm font-medium">{source.yelp_rating}</span>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {source.notes && (
          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-2">Notes</p>
            <p className="text-sm bg-muted/50 p-3 rounded-lg">{source.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}