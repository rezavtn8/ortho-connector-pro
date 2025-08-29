import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Phone, Mail, Globe, Star, TrendingUp, TrendingDown, Users, ExternalLink, Edit2, Clock, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface OfficeCardProps {
  office: ReferringOffice;
  tags?: OfficeTag[];
  score?: OfficeScore;
  totalReferrals?: number;
  recentReferrals?: number;
  onViewDetails?: () => void;
  onEdit?: () => void;
}

export const OfficeCard: React.FC<OfficeCardProps> = ({
  office,
  tags = [],
  score = 'Cold',
  totalReferrals = 0,
  recentReferrals = 0,
  onViewDetails,
  onEdit
}) => {
  const navigate = useNavigate();

  const scoreColors = {
    'Strong': 'bg-green-100 text-green-800 border-green-200',
    'Moderate': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'Sporadic': 'bg-orange-100 text-orange-800 border-orange-200',
    'Cold': 'bg-gray-100 text-gray-600 border-gray-200'
  };

  const scoreIcons = {
    'Strong': TrendingUp,
    'Moderate': Users,
    'Sporadic': TrendingDown,
    'Cold': Users
  };

  const ScoreIcon = scoreIcons[score];

  const handleCardClick = () => {
    navigate(`/office/${office.id}`);
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `(${match[1]}) ${match[2]}-${match[3]}`;
    }
    return phone;
  };

  return (
    <Card 
      className="group hover:shadow-lg transition-all duration-200 cursor-pointer overflow-hidden border-gray-200 hover:border-primary/30"
      onClick={handleCardClick}
    >
      {/* Header with gradient accent */}
      <div className="h-1 bg-gradient-to-r from-blue-500 to-purple-500" />
      
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold line-clamp-2 group-hover:text-primary transition-colors flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              {office.name}
            </CardTitle>
          </div>
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.();
              }}
            >
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                handleCardClick();
              }}
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Score Badge */}
        <div className="mt-2">
          <Badge className={`${scoreColors[score]} gap-1`}>
            <ScoreIcon className="w-3 h-3" />
            {score}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Contact Information */}
        <div className="space-y-2 text-sm">
          {office.address && (
            <div className="flex items-start gap-2 text-muted-foreground">
              <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span className="line-clamp-2">{office.address}</span>
            </div>
          )}
          
          {office.phone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="w-4 h-4 flex-shrink-0" />
              <a 
                href={`tel:${office.phone}`}
                onClick={(e) => e.stopPropagation()}
                className="hover:text-primary hover:underline"
              >
                {formatPhone(office.phone)}
              </a>
            </div>
          )}
          
          {office.email && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="w-4 h-4 flex-shrink-0" />
              <a 
                href={`mailto:${office.email}`}
                onClick={(e) => e.stopPropagation()}
                className="hover:text-primary hover:underline truncate"
              >
                {office.email}
              </a>
            </div>
          )}
          
          {office.website && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Globe className="w-4 h-4 flex-shrink-0" />
              <a 
                href={office.website}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="hover:text-primary hover:underline truncate"
              >
                {office.website.replace(/^https?:\/\//, '')}
              </a>
            </div>
          )}

          {office.office_hours && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4 flex-shrink-0" />
              <span>{office.office_hours}</span>
            </div>
          )}
        </div>

        {/* Ratings */}
        {(office.google_rating || office.yelp_rating) && (
          <div className="flex gap-3 pt-2 border-t">
            {office.google_rating && (
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                <span className="text-sm font-medium">{office.google_rating}</span>
                <span className="text-xs text-muted-foreground">Google</span>
              </div>
            )}
            {office.yelp_rating && (
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-red-500 fill-red-500" />
                <span className="text-sm font-medium">{office.yelp_rating}</span>
                <span className="text-xs text-muted-foreground">Yelp</span>
              </div>
            )}
          </div>
        )}

        {/* Referral Stats */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{totalReferrals}</div>
            <div className="text-xs text-muted-foreground">Total Referrals</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{recentReferrals}</div>
            <div className="text-xs text-muted-foreground">Recent (3mo)</div>
          </div>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-2">
            {tags.slice(0, 3).map((tag) => (
              <Badge 
                key={tag.id} 
                variant="secondary" 
                className="text-xs"
              >
                {tag.tag}
              </Badge>
            ))}
            {tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{tags.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Additional Info */}
        <div className="flex justify-between items-center pt-2 text-xs text-muted-foreground">
          {office.distance_from_clinic && (
            <span>{office.distance_from_clinic} miles away</span>
          )}
          {office.patient_load && office.patient_load > 0 && (
            <span>{office.patient_load} patients</span>
          )}
          {office.source && (
            <Badge variant="outline" className="text-xs">
              Source: {office.source}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default OfficeCard;