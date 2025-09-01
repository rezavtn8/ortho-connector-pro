import React, { useState } from 'react';
import { Building2, Globe, Star, Facebook, Users, MessageSquare } from 'lucide-react';

interface PatientSourceGraphProps {
  className?: string;
}

export const PatientSourceGraph: React.FC<PatientSourceGraphProps> = ({ className = '' }) => {
  const [hoveredSource, setHoveredSource] = useState<string | null>(null);

  // Circular layout positions - 6 sources around the center
  const sources = [
    { id: 'google', name: 'Google', icon: Globe, angle: 0 },
    { id: 'yelp', name: 'Yelp', icon: Star, angle: 60 },
    { id: 'facebook', name: 'Facebook', icon: Facebook, angle: 120 },
    { id: 'website', name: 'Website', icon: Globe, angle: 180 },
    { id: 'offices', name: 'Referring Offices', icon: Building2, angle: 240 },
    { id: 'word-of-mouth', name: 'Word of Mouth', icon: MessageSquare, angle: 300 }
  ];

  // Calculate positions based on angle (circular orbit)
  const radius = 35; // Percentage from center
  const getPosition = (angle: number) => {
    const radian = (angle * Math.PI) / 180;
    const x = 50 + radius * Math.cos(radian - Math.PI / 2); // -π/2 to start from top
    const y = 50 + radius * Math.sin(radian - Math.PI / 2);
    return { x, y };
  };

  return (
    <div className={`relative w-full h-80 md:h-96 bg-white rounded-3xl overflow-hidden ${className}`}>
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-connection-bg/30 via-white to-connection-bg/20"></div>

      {/* Connection lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="connectionLine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--connection-primary))" stopOpacity="0.2" />
            <stop offset="50%" stopColor="hsl(var(--connection-primary))" stopOpacity="0.6" />
            <stop offset="100%" stopColor="hsl(var(--connection-primary))" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id="connectionLineActive" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--connection-primary))" stopOpacity="0.4" />
            <stop offset="50%" stopColor="hsl(var(--connection-primary))" stopOpacity="1" />
            <stop offset="100%" stopColor="hsl(var(--connection-primary))" stopOpacity="0.4" />
          </linearGradient>
        </defs>
        
        {sources.map((source) => {
          const position = getPosition(source.angle);
          const isActive = hoveredSource === source.id;
          
          return (
            <g key={source.id}>
              <line
                x1={position.x}
                y1={position.y}
                x2="50"
                y2="50"
                stroke={isActive ? "url(#connectionLineActive)" : "url(#connectionLine)"}
                strokeWidth={isActive ? "2" : "1"}
                className={`transition-all duration-300 ${isActive ? '' : 'animate-pulse'}`}
                style={{
                  animationDuration: '3s',
                  filter: isActive ? 'drop-shadow(0 0 4px hsl(var(--connection-primary) / 0.5))' : 'none'
                }}
              />
              
              {/* Animated signal dot */}
              <circle
                className={`animate-signal ${isActive ? 'opacity-100' : 'opacity-60'}`}
                r="1"
                fill="hsl(var(--connection-primary))"
                style={{
                  animationDuration: '2s',
                  animationDelay: `${source.angle / 60}s`
                }}
              >
                <animateMotion
                  dur="2s"
                  repeatCount="indefinite"
                  begin={`${source.angle / 60}s`}
                >
                  <mpath href={`#signal-path-${source.id}`} />
                </animateMotion>
              </circle>
              
              {/* Signal path (hidden) */}
              <path
                id={`signal-path-${source.id}`}
                d={`M ${position.x} ${position.y} L 50 50`}
                stroke="none"
                fill="none"
              />
            </g>
          );
        })}
      </svg>

      {/* Central dental office node */}
      <div 
        className="absolute w-16 h-16 -translate-x-1/2 -translate-y-1/2 z-20"
        style={{ left: '50%', top: '50%' }}
      >
        <div className="w-full h-full bg-connection-primary rounded-full shadow-lg flex items-center justify-center text-white relative">
          <Building2 className="w-7 h-7" />
          
          {/* Glow effect */}
          <div className="absolute -inset-2 bg-connection-primary/20 rounded-full animate-pulse blur-sm"></div>
          <div className="absolute -inset-4 bg-connection-primary/10 rounded-full animate-ping"></div>
        </div>
        
        {/* Center label */}
        <div className="absolute top-full mt-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <div className="bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-medium text-connection-text shadow-sm border border-connection-primary/10">
            Your Dental Office
          </div>
        </div>
      </div>

      {/* Source nodes */}
      {sources.map((source, index) => {
        const IconComponent = source.icon;
        const position = getPosition(source.angle);
        const isHovered = hoveredSource === source.id;
        
        return (
          <div
            key={source.id}
            className="absolute w-12 h-12 -translate-x-1/2 -translate-y-1/2 z-10 cursor-pointer"
            style={{
              left: `${position.x}%`,
              top: `${position.y}%`,
            }}
            onMouseEnter={() => setHoveredSource(source.id)}
            onMouseLeave={() => setHoveredSource(null)}
          >
            <div className={`w-full h-full bg-white rounded-full shadow-sm border border-connection-primary/20 flex items-center justify-center transition-all duration-300 ${
              isHovered ? 'scale-110 shadow-lg bg-connection-primary text-white border-connection-primary' : 'text-connection-muted hover:text-connection-primary'
            }`}>
              <IconComponent className="w-5 h-5" />
            </div>
            
            {/* Hover glow */}
            {isHovered && (
              <div className="absolute -inset-1 bg-connection-primary/30 rounded-full blur-sm animate-pulse"></div>
            )}
            
            {/* Label pill */}
            <div className={`absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap transition-all duration-300 ${
              isHovered ? 'opacity-100 translate-y-0' : 'opacity-70 translate-y-1'
            }`}>
              <div className={`px-3 py-1 rounded-full text-xs font-medium shadow-sm border transition-all duration-300 ${
                isHovered 
                  ? 'bg-connection-primary text-white border-connection-primary shadow-md' 
                  : 'bg-white/95 backdrop-blur-sm text-connection-text border-connection-primary/10'
              }`}>
                {source.name}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};