import React, { useState } from 'react';
import { Building2, Globe, Star, Facebook, Users, MessageSquare } from 'lucide-react';

interface PatientSourceGraphProps {
  className?: string;
}

export const PatientSourceGraph: React.FC<PatientSourceGraphProps> = ({ className = '' }) => {
  const [hoveredSource, setHoveredSource] = useState<string | null>(null);

  const sources = [
    { id: 'google', name: 'Google', icon: Globe, position: { x: 50, y: 18 }, volume: '35%', color: 'from-blue-500 to-blue-600' },
    { id: 'yelp', name: 'Yelp', icon: Star, position: { x: 82, y: 32 }, volume: '18%', color: 'from-red-500 to-red-600' },
    { id: 'facebook', name: 'Facebook', icon: Facebook, position: { x: 82, y: 68 }, volume: '12%', color: 'from-blue-600 to-blue-700' },
    { id: 'website', name: 'Website', icon: Globe, position: { x: 50, y: 82 }, volume: '22%', color: 'from-green-500 to-green-600' },
    { id: 'offices', name: 'Referring Offices', icon: Building2, position: { x: 18, y: 68 }, volume: '8%', color: 'from-purple-500 to-purple-600' },
    { id: 'word-of-mouth', name: 'Word of Mouth', icon: MessageSquare, position: { x: 18, y: 32 }, volume: '15%', color: 'from-orange-500 to-orange-600' }
  ];

  return (
    <div className={`relative w-full h-80 md:h-96 bg-gradient-to-br from-slate-50 to-white rounded-3xl border shadow-lg overflow-hidden ${className}`}>
      {/* Beautiful grid pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="w-full h-full" style={{
          backgroundImage: `
            radial-gradient(circle at 1px 1px, hsl(var(--primary)) 1px, transparent 0)
          `,
          backgroundSize: '24px 24px'
        }} />
      </div>

      {/* Flowing gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-50"></div>

      {/* Enhanced connection lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
            <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
            <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.4" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge> 
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <marker
            id="arrowhead-gradient"
            markerWidth="12"
            markerHeight="8"
            refX="10"
            refY="4"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <polygon
              points="0 0, 12 4, 0 8"
              fill="url(#lineGradient)"
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
            stroke="url(#lineGradient)"
            strokeWidth={hoveredSource === source.id ? "3" : "2"}
            markerEnd="url(#arrowhead-gradient)"
            className="transition-all duration-300"
            filter={hoveredSource === source.id ? "url(#glow)" : "none"}
            opacity={hoveredSource === source.id ? "1" : "0.7"}
          />
        ))}
      </svg>

      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-primary/20 rounded-full animate-pulse"
            style={{
              left: `${15 + (i * 12)}%`,
              top: `${25 + (i * 8)}%`,
              animationDelay: `${i * 0.8}s`,
              animationDuration: `${2 + (i * 0.3)}s`
            }}
          />
        ))}
      </div>

      {/* Central dental office with enhanced styling */}
      <div 
        className="absolute w-20 h-20 -translate-x-1/2 -translate-y-1/2 group"
        style={{ left: '50%', top: '50%' }}
      >
        <div className="w-full h-full bg-gradient-to-br from-primary to-primary/80 rounded-2xl shadow-xl flex items-center justify-center text-primary-foreground transition-all duration-300 hover:scale-110 hover:shadow-2xl border-2 border-white/50 backdrop-blur-sm">
          <Building2 className="w-9 h-9 drop-shadow-sm" />
        </div>
        <div className="absolute -inset-2 bg-gradient-to-r from-primary/20 to-accent/20 rounded-3xl -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl"></div>
        <div className="absolute top-full mt-3 left-1/2 -translate-x-1/2 text-sm font-semibold text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-300 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-xl shadow-lg border">
          Your Dental Office
        </div>
      </div>

      {/* Enhanced source nodes */}
      {sources.map((source, index) => {
        const IconComponent = source.icon;
        const isHovered = hoveredSource === source.id;
        
        return (
          <div
            key={source.id}
            className="absolute w-14 h-14 -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
            style={{
              left: `${source.position.x}%`,
              top: `${source.position.y}%`,
              animationDelay: `${index * 0.1}s`
            }}
            onMouseEnter={() => setHoveredSource(source.id)}
            onMouseLeave={() => setHoveredSource(null)}
          >
            <div className={`w-full h-full bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border flex items-center justify-center transition-all duration-300 ${
              isHovered 
                ? 'shadow-2xl scale-125 border-primary/60 bg-gradient-to-br from-white to-primary/10' 
                : 'shadow-lg hover:shadow-xl hover:scale-110 border-border/50'
            } animate-fade-in`}>
              <IconComponent className={`w-6 h-6 ${
                isHovered ? 'text-primary' : 'text-muted-foreground'
              } transition-all duration-300 drop-shadow-sm`} />
            </div>
            
            {/* Glowing ring effect */}
            <div className={`absolute -inset-1 bg-gradient-to-r ${source.color} rounded-2xl opacity-0 ${
              isHovered ? 'opacity-20' : ''
            } transition-opacity duration-300 -z-10 blur-sm`}></div>
            
            {/* Enhanced tooltip */}
            <div className={`absolute top-full mt-3 left-1/2 -translate-x-1/2 text-xs font-medium text-foreground whitespace-nowrap transition-all duration-300 bg-white/95 backdrop-blur-sm px-3 py-2 rounded-xl shadow-xl border z-20 ${
              isHovered ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2 group-hover:opacity-100 group-hover:scale-100 group-hover:translate-y-0'
            }`}>
              <div className="text-center">
                <div className="font-semibold">{source.name}</div>
                <div className="text-primary text-xs mt-1 font-medium">{source.volume} of patients</div>
              </div>
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white border-l border-t rotate-45"></div>
            </div>
          </div>
        );
      })}

      {/* Corner decorative elements */}
      <div className="absolute top-6 left-6 w-3 h-3 bg-gradient-to-br from-primary/30 to-accent/30 rounded-full animate-pulse"></div>
      <div className="absolute top-8 right-12 w-2 h-2 bg-gradient-to-br from-accent/40 to-primary/40 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
      <div className="absolute bottom-12 left-12 w-2.5 h-2.5 bg-gradient-to-br from-primary/25 to-accent/25 rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
      <div className="absolute bottom-6 right-6 w-3 h-3 bg-gradient-to-br from-accent/35 to-primary/35 rounded-full animate-pulse" style={{ animationDelay: '1.5s' }}></div>
    </div>
  );
};