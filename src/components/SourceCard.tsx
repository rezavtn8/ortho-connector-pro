import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Globe, Star, Users, Briefcase, Share2, BookOpen, MapPin, TrendingUp, Edit2, ExternalLink, Phone, Mail } from 'lucide-react';

interface Source {
  id: string;
  name: string;
  type: string;
  description: string;
  url?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  is_active: boolean;
  priority: 'high' | 'medium' | 'low';
  notes?: string;
  total_referrals?: number;
  conversion_rate?: number;
  created_at?: string;
  updated_at?: string;
}

interface SourceCardProps {
  source: Source;
  onEdit?: () => void;
  onViewDetails?: () => void;
}

export const SourceCard: React.FC<SourceCardProps> = ({
  source,
  onEdit,
  onViewDetails
}) => {
  const sourceTypes: Record<string, { icon: React.ComponentType<any>; color: string; label: string }> = {
    referral: { icon: Users, color: 'text-blue-600', label: 'Referral Partner' },
    google: { icon: Search, color: 'text-green-600', label: 'Google/Search' },
    yelp: { icon: Star, color: 'text-red-600', label: 'Yelp' },
    directory: { icon: BookOpen, color: 'text-purple-600', label: 'Medical Directory' },
    social: { icon: Share2, color: 'text-pink-600', label: 'Social Media' },
    website: { icon: Globe, color: 'text-indigo-600', label: 'Website' },
    insurance: { icon: Briefcase, color: 'text-teal-600', label: 'Insurance Network' },
    location: { icon: MapPin, color: 'text-orange-600', label: 'Walk-in/Location' },
    marketing: { icon: TrendingUp, color: 'text-cyan-600', label: 'Marketing Campaign' }
  };

  const priorityConfig = {
    high: { color: 'bg-red-100 text-red-800 border-red-200', label: 'High Priority' },
    medium: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Medium Priority' },
    low: { color: 'bg-green-100 text-green-800 border-green-200', label: 'Low Priority' }
  };

  const typeConfig = sourceTypes[source.type] || sourceTypes.referral;
  const TypeIcon = typeConfig.icon;

  return (
    <Card className="group hover:shadow-lg transition-all duration-200 cursor-pointer overflow-hidden border-gray-200 hover:border-primary/30">
      {/* Type indicator bar */}
      <div className={`h-1 bg-gradient-to-r ${
        source.type === 'referral' ? 'from-blue-500 to-blue-600' :
        source.type === 'google' ? 'from-green-500 to-green-600' :
        source.type === 'yelp' ? 'from-red-500 to-red-600' :
        source.type === 'directory' ? 'from-purple-500 to-purple-600' :
        source.type === 'social' ? 'from-pink-500 to-pink-600' :
        'from-gray-500 to-gray-600'
      }`} />
      
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold line-clamp-1 group-hover:text-primary transition-colors">
              {source.name}
            </CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <TypeIcon className={`w-4 h-4 ${typeConfig.color}`} />
              <span className="text-sm text-muted-foreground">{typeConfig.label}</span>
            </div>
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
                onViewDetails?.();
              }}
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Status badges */}
        <div className="flex gap-2 mt-2">
          <Badge className={priorityConfig[source.priority].color}>
            {priorityConfig[source.priority].label}
          </Badge>
          <Badge variant={source.is_active ? "success" : "secondary"}>
            {source.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Description */}
        <p className="text-sm text-muted-foreground line-clamp-2">
          {source.description}
        </p>

        {/* Contact Information */}
        {(source.contact_name || source.contact_email || source.contact_phone) && (
          <div className="space-y-1 text-sm border-t pt-3">
            {source.contact_name && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="w-3 h-3" />
                <span className="truncate">{source.contact_name}</span>
              </div>
            )}
            {source.contact_email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="w-3 h-3" />
                <a 
                  href={`mailto:${source.contact_email}`}
                  onClick={(e) => e.stopPropagation()}
                  className="hover:text-primary hover:underline truncate"
                >
                  {source.contact_email}
                </a>
              </div>
            )}
            {source.contact_phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="w-3 h-3" />
                <a 
                  href={`tel:${source.contact_phone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="hover:text-primary hover:underline"
                >
                  {source.contact_phone}
                </a>
              </div>
            )}
          </div>
        )}

        {/* URL */}
        {source.url && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Globe className="w-3 h-3" />
            <a 
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="hover:text-primary hover:underline truncate"
            >
              {source.url.replace(/^https?:\/\//, '')}
            </a>
          </div>
        )}

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t">
          <div className="text-center">
            <div className="text-xl font-bold text-primary">
              {source.total_referrals || 0}
            </div>
            <div className="text-xs text-muted-foreground">Total Referrals</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-primary">
              {source.conversion_rate ? `${source.conversion_rate}%` : 'N/A'}
            </div>
            <div className="text-xs text-muted-foreground">Conversion</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};