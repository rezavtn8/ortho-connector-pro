import React from 'react';
import { Building2, Globe, Star, Facebook, Users, MessageSquare } from 'lucide-react';

interface PatientSourceGraphProps {
  className?: string;
}

export const PatientSourceGraph: React.FC<PatientSourceGraphProps> = ({ className = '' }) => {
  const sources = [
    { id: 'google', name: 'Google', icon: Globe, angle: 0 },
    { id: 'yelp', name: 'Yelp', icon: Star, angle: 60 },
    { id: 'facebook', name: 'Facebook', icon: Facebook, angle: 120 },
    { id: 'website', name: 'Website', icon: Globe, angle: 180 },
    { id: 'offices', name: 'Referring Offices', icon: Building2, angle: 240 },
    { id: 'word-of-mouth', name: 'Word of Mouth', icon: MessageSquare, angle: 300 }
  ];

  const radius = 38;
  const getPosition = (angle: number) => {
    const radian = (angle * Math.PI) / 180;
    const x = 50 + radius * Math.cos(radian - Math.PI / 2);
    const y = 50 + radius * Math.sin(radian - Math.PI / 2);
    return { x, y };
  };

  return (
    <div className={`relative w-full h-80 md:h-96 bg-gradient-to-br from-slate-50/30 via-white to-slate-50/30 ${className}`}>
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 opacity-[0.02]">
        <div 
          className="w-full h-full"
          style={{
            backgroundImage: `
              linear-gradient(hsl(var(--connection-primary) / 0.1) 1px, transparent 1px),
              linear-gradient(90deg, hsl(var(--connection-primary) / 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }}
        />
      </div>

      {/* Connection lines */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="flowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--connection-primary))" stopOpacity="0.2" />
            <stop offset="80%" stopColor="hsl(var(--connection-primary))" stopOpacity="0.6" />
            <stop offset="100%" stopColor="hsl(var(--connection-primary))" stopOpacity="0" />
          </linearGradient>
        </defs>
        
        {sources.map((source) => {
          const position = getPosition(source.angle);
          
          return (
            <line
              key={source.id}
              x1={position.x}
              y1={position.y}
              x2="50"
              y2="50"
              stroke="url(#flowGradient)"
              strokeWidth="0.8"
              className="opacity-80"
            />
          );
        })}
      </svg>

      {/* Center node - Your Dental Office */}
      <div 
        className="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2"
        style={{ left: '50%', top: '50%' }}
      >
        <div className="w-full h-full bg-connection-primary rounded-full flex items-center justify-center text-white">
          <Building2 className="w-3 h-3" />
        </div>
        <div className="absolute top-full mt-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="text-sm font-medium text-connection-text">Your Dental Office</span>
        </div>
      </div>

      {/* Source nodes */}
      {sources.map((source) => {
        const IconComponent = source.icon;
        const position = getPosition(source.angle);
        
        return (
          <div
            key={source.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${position.x}%`,
              top: `${position.y}%`,
            }}
          >
            <div className="flex flex-col items-center space-y-2">
              <div className="w-5 h-5 rounded-full bg-white border border-connection-primary/30 flex items-center justify-center">
                <IconComponent className="w-2.5 h-2.5 text-connection-primary/70" />
              </div>
              <span className="text-xs font-medium text-connection-muted text-center leading-tight">
                {source.name}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};