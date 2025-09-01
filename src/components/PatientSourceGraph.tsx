import React, { useState } from 'react';
import { Building2, Globe, Star, Facebook, Users, MessageSquare } from 'lucide-react';

interface PatientSourceGraphProps {
  className?: string;
}

export const PatientSourceGraph: React.FC<PatientSourceGraphProps> = ({ className = '' }) => {
  const [hoveredSource, setHoveredSource] = useState<string | null>(null);

  const sources = [
    { id: 'google', name: 'Google', icon: Globe, angle: 0 },
    { id: 'yelp', name: 'Yelp', icon: Star, angle: 60 },
    { id: 'facebook', name: 'Facebook', icon: Facebook, angle: 120 },
    { id: 'website', name: 'Website', icon: Globe, angle: 180 },
    { id: 'offices', name: 'Referring Offices', icon: Building2, angle: 240 },
    { id: 'word-of-mouth', name: 'Word of Mouth', icon: MessageSquare, angle: 300 }
  ];

  const radius = 40;
  const getPosition = (angle: number) => {
    const radian = (angle * Math.PI) / 180;
    const x = 50 + radius * Math.cos(radian - Math.PI / 2);
    const y = 50 + radius * Math.sin(radian - Math.PI / 2);
    return { x, y };
  };

  return (
    <div className={`relative w-full h-80 md:h-96 bg-white ${className}`}>
      {/* Connection lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="flowLine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--connection-primary))" stopOpacity="0.3" />
            <stop offset="70%" stopColor="hsl(var(--connection-primary))" stopOpacity="0.8" />
            <stop offset="100%" stopColor="hsl(var(--connection-primary))" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="flowLineActive" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--connection-primary))" stopOpacity="0.6" />
            <stop offset="70%" stopColor="hsl(var(--connection-primary))" stopOpacity="1" />
            <stop offset="100%" stopColor="hsl(var(--connection-primary))" stopOpacity="0" />
          </linearGradient>
        </defs>
        
        {sources.map((source) => {
          const position = getPosition(source.angle);
          const isActive = hoveredSource === source.id;
          
          return (
            <line
              key={source.id}
              x1={position.x}
              y1={position.y}
              x2="50"
              y2="50"
              stroke={isActive ? "url(#flowLineActive)" : "url(#flowLine)"}
              strokeWidth="1"
              className="transition-all duration-300"
              style={{
                filter: isActive ? 'drop-shadow(0 0 2px hsl(var(--connection-primary) / 0.6))' : 'none'
              }}
            />
          );
        })}
      </svg>

      {/* Central node */}
      <div 
        className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 z-10"
        style={{ left: '50%', top: '50%' }}
      >
        <div className="w-full h-full bg-connection-primary rounded-full flex items-center justify-center text-white">
          <Building2 className="w-4 h-4" />
        </div>
        {hoveredSource && (
          <div className="absolute -inset-1 bg-connection-primary/30 rounded-full animate-pulse"></div>
        )}
        <div className="absolute top-full mt-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="text-sm font-medium text-connection-text">Your Dental Office</span>
        </div>
      </div>

      {/* Source nodes */}
      {sources.map((source) => {
        const IconComponent = source.icon;
        const position = getPosition(source.angle);
        const isHovered = hoveredSource === source.id;
        
        return (
          <div
            key={source.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
            style={{
              left: `${position.x}%`,
              top: `${position.y}%`,
            }}
            onMouseEnter={() => setHoveredSource(source.id)}
            onMouseLeave={() => setHoveredSource(null)}
          >
            <div className="flex flex-col items-center space-y-2">
              <div className={`w-6 h-6 rounded-full bg-white border flex items-center justify-center transition-all duration-300 ${
                isHovered 
                  ? 'border-connection-primary text-connection-primary shadow-sm scale-110' 
                  : 'border-gray-200 text-gray-400 hover:border-connection-primary/50 hover:text-connection-primary/70'
              }`}>
                <IconComponent className="w-3 h-3" />
              </div>
              <span className={`text-xs font-medium transition-all duration-300 ${
                isHovered 
                  ? 'text-connection-primary' 
                  : 'text-connection-muted hover:text-connection-text'
              }`}>
                {source.name}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};