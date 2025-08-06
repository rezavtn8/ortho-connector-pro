import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ReferringOffice, OfficeTag, OfficeScore } from '@/lib/database.types';
import { MapPin, Phone, Globe, Star, Clock } from 'lucide-react';
import { OfficeMapModal } from './OfficeMapModal';

interface OfficeCardProps {
  office: ReferringOffice;
  tags?: OfficeTag[];
  score?: OfficeScore;
  totalReferrals?: number;
  recentReferrals?: number;
  onViewDetails?: () => void;
  onEdit?: () => void;
}

export function OfficeCard({ 
  office, 
  tags = [], 
  score = 'Cold',
  totalReferrals = 0,
  recentReferrals = 0,
  onViewDetails,
  onEdit 
}: OfficeCardProps) {
  const [showMapModal, setShowMapModal] = useState(false);
  const getScoreBadgeVariant = (score: OfficeScore) => {
    switch (score) {
      case 'Strong': return 'strong';
      case 'Moderate': return 'moderate';
      case 'Sporadic': return 'sporadic';
      case 'Cold': return 'cold';
      default: return 'cold';
    }
  };

  return (
    <Card variant="elevated" className="transition-all duration-200 hover:shadow-glow cursor-pointer">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">{office.name}</CardTitle>
          <Badge variant={getScoreBadgeVariant(score)}>
            {score}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Location & Contact */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4" />
            <span>{office.address}</span>
          </div>
          
          {office.phone && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="w-4 h-4" />
              <span>{office.phone}</span>
            </div>
          )}
          
          {office.website && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Globe className="w-4 h-4" />
              <a 
                href={office.website} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Website
              </a>
            </div>
          )}
        </div>

        {/* Ratings */}
        {(office.google_rating || office.yelp_rating) && (
          <div className="flex items-center gap-4 text-sm">
            {office.google_rating && (
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span>{office.google_rating} Google</span>
              </div>
            )}
            {office.yelp_rating && (
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span>{office.yelp_rating} Yelp</span>
              </div>
            )}
          </div>
        )}

        {/* Office Hours */}
        {office.office_hours && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>{office.office_hours}</span>
          </div>
        )}

        {/* Referral Stats */}
        <div className="bg-accent/30 rounded-lg p-3">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">{totalReferrals}</div>
              <div className="text-xs text-muted-foreground">Total Referrals</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">{recentReferrals}</div>
              <div className="text-xs text-muted-foreground">Last 3 Months</div>
            </div>
          </div>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge key={tag.id} variant="secondary" className="text-xs">
                {tag.tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Distance */}
        {office.distance_from_clinic && (
          <div className="text-sm text-muted-foreground">
            {office.distance_from_clinic.toFixed(1)} miles away
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={() => window.location.href = `/office/${office.id}`}
          >
            View Details
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowMapModal(true)}
          >
            <MapPin className="w-4 h-4 mr-1" />
            Map
          </Button>
        </div>
        
        <OfficeMapModal 
          office={office}
          isOpen={showMapModal}
          onClose={() => setShowMapModal(false)}
        />
      </CardContent>
    </Card>
  );
}