import React, { useState } from 'react';
import { Building2, Globe, Star, Facebook, Users, MessageSquare } from 'lucide-react';

interface PatientSourceGraphProps {
  className?: string;
}

export const PatientSourceGraph: React.FC<PatientSourceGraphProps> = ({ className = '' }) => {
  const [hoveredSource, setHoveredSource] = useState<string | null>(null);

  const sources = [
    { id: 'google', name: 'Google', icon: Globe, position: { x: 50, y: 20 }, volume: '35%' },
    { id: 'yelp', name: 'Yelp', icon: Star, position: { x: 80, y: 35 }, volume: '18%' },
    { id: 'facebook', name: 'Facebook', icon: Facebook, position: { x: 80, y: 65 }, volume: '12%' },
    { id: 'website', name: 'Website', icon: Globe, position: { x: 50, y: 80 }, volume: '22%' },
    { id: 'offices', name: 'Referring Offices', icon: Building2, position: { x: 20, y: 65 }, volume: '8%' },
    { id: 'word-of-mouth', name: 'Word of Mouth', icon: MessageSquare, position: { x: 20, y: 35 }, volume: '15%' }
  ];

  return (
    <div className={`relative w-full h-80 md:h-96 bg-white rounded-2xl border border-muted shadow-sm overflow-hidden ${className}`}>
      {/* Subtle grid background */}
      <div className="absolute inset-0 opacity-5">
        <div className="w-full h-full" style={{
          backgroundImage: `
            linear-gradient(hsl(var(--muted-foreground)) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--muted-foreground)) 1px, transparent 1px)
          `,
          backgroundSize: '24px 24px'
        }} />
      </div>

      {/* Clean connection lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <marker
            id="arrowhead-clean"
            markerWidth="8"
            markerHeight="6"
            refX="7"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <polygon
              points="0 0, 8 3, 0 6"
              fill="hsl(var(--primary))"
              opacity="0.6"
            />
          </marker>
        </defs>
        
        {sources.map((source) => (
          <line
            key={source.id}
            x1={source.position.x}
            y1={source.position.y}
            x2="50"
            y2="50"
            stroke="hsl(var(--primary))"
            strokeWidth={hoveredSource === source.id ? "2" : "1"}
            markerEnd="url(#arrowhead-clean)"
            opacity={hoveredSource === source.id ? "0.8" : "0.4"}
            className="transition-all duration-200"
            strokeDasharray="2,3"
          />
        ))}
      </svg>

      {/* Central dental office */}
      <div 
        className="absolute w-16 h-16 -translate-x-1/2 -translate-y-1/2 group"
        style={{ left: '50%', top: '50%' }}
      >
        <div className="w-full h-full bg-primary rounded-xl shadow-md flex items-center justify-center text-primary-foreground transition-transform duration-200 hover:scale-105">
          <Building2 className="w-7 h-7" />
        </div>
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 text-xs font-medium text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-background px-2 py-1 rounded shadow-sm border">
          Your Dental Office
        </div>
      </div>

      {/* Source nodes */}
      {sources.map((source) => {
        const IconComponent = source.icon;
        const isHovered = hoveredSource === source.id;
        
        return (
          <div
            key={source.id}
            className="absolute w-12 h-12 -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
            style={{
              left: `${source.position.x}%`,
              top: `${source.position.y}%`
            }}
            onMouseEnter={() => setHoveredSource(source.id)}
            onMouseLeave={() => setHoveredSource(null)}
          >
            <div className={`w-full h-full bg-background rounded-lg shadow-sm border flex items-center justify-center transition-all duration-200 ${
              isHovered 
                ? 'shadow-md scale-110 border-primary/40 bg-primary/5' 
                : 'border-border hover:shadow-md hover:scale-105'
            }`}>
              <IconComponent className={`w-5 h-5 text-muted-foreground ${
                isHovered ? 'text-primary' : ''
              } transition-colors duration-200`} />
            </div>
            
            {/* Clean tooltip */}
            <div className={`absolute top-full mt-1 left-1/2 -translate-x-1/2 text-xs font-medium text-foreground whitespace-nowrap transition-all duration-200 bg-background px-2 py-1 rounded shadow-sm border z-10 ${
              isHovered ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}>
              <div className="text-center">
                <div>{source.name}</div>
                <div className="text-primary text-xs">{source.volume}</div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Subtle tech elements */}
      <div className="absolute top-4 left-4 w-2 h-2 bg-primary/20 rounded-full"></div>
      <div className="absolute top-6 right-8 w-1 h-1 bg-primary/30 rounded-full"></div>
      <div className="absolute bottom-8 left-8 w-1.5 h-1.5 bg-primary/20 rounded-full"></div>
      <div className="absolute bottom-4 right-4 w-2 h-2 bg-primary/20 rounded-full"></div>
    </div>
  );
};