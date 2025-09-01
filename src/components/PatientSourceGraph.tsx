import React, { useState } from 'react';
import { Building2, Globe, Star, Facebook, Users, MessageSquare } from 'lucide-react';

interface PatientSourceGraphProps {
  className?: string;
}

export const PatientSourceGraph: React.FC<PatientSourceGraphProps> = ({ className = '' }) => {
  const [hoveredSource, setHoveredSource] = useState<string | null>(null);
  const [simulationActive, setSimulationActive] = useState(false);

  const sources = [
    { id: 'google', name: 'Google', icon: Globe, position: { x: 50, y: 15 }, color: 'text-blue-500', volume: '35%' },
    { id: 'yelp', name: 'Yelp', icon: Star, position: { x: 85, y: 35 }, color: 'text-red-500', volume: '18%' },
    { id: 'facebook', name: 'Facebook', icon: Facebook, position: { x: 85, y: 65 }, color: 'text-blue-600', volume: '12%' },
    { id: 'website', name: 'Website', icon: Globe, position: { x: 50, y: 85 }, color: 'text-green-500', volume: '22%' },
    { id: 'offices', name: 'Other Offices', icon: Building2, position: { x: 15, y: 65 }, color: 'text-purple-500', volume: '8%' },
    { id: 'word-of-mouth', name: 'Word of Mouth', icon: MessageSquare, position: { x: 15, y: 35 }, color: 'text-orange-500', volume: '15%' }
  ];

  return (
    <div className={`relative w-full h-96 md:h-[400px] lg:h-[450px] bg-gradient-to-br from-white to-connection-bg/30 rounded-3xl border border-connection-primary/20 shadow-elegant overflow-hidden ${className}`}>
      {/* Simulation Controls */}
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={() => setSimulationActive(!simulationActive)}
          className="px-3 py-1 text-xs bg-white/80 backdrop-blur-sm rounded-full border border-connection-primary/30 text-connection-primary hover:bg-connection-primary hover:text-white transition-all duration-200"
        >
          {simulationActive ? 'Pause Flow' : 'Show Flow'}
        </button>
      </div>

      {/* Background grid pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="w-full h-full" style={{
          backgroundImage: `
            linear-gradient(hsl(var(--connection-primary)) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--connection-primary)) 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px'
        }} />
      </div>

      {/* Data flow particles */}
      <div className="absolute inset-0 pointer-events-none">
        {sources.map((source, index) => (
          <div
            key={`particle-${source.id}`}
            className={`absolute w-1 h-1 rounded-full transition-all duration-500 ${
              simulationActive || hoveredSource === source.id
                ? 'opacity-100 animate-travel-line'
                : 'opacity-0'
            }`}
            style={{
              background: `hsl(var(--connection-primary))`,
              animationDelay: `${index * 0.8}s`,
              animationDuration: '3s'
            }}
          />
        ))}
      </div>

      {/* Connection lines with arrows */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3.5, 0 7"
              fill="hsl(var(--connection-primary))"
              className="opacity-70"
            />
          </marker>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge> 
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {sources.map((source, index) => (
          <line
            key={source.id}
            x1={source.position.x}
            y1={source.position.y}
            x2="50"
            y2="50"
            stroke="hsl(var(--connection-primary))"
            strokeWidth={hoveredSource === source.id ? "2.5" : "1.5"}
            markerEnd="url(#arrowhead)"
            className={`transition-all duration-300 ${
              hoveredSource === source.id 
                ? 'opacity-100 animate-pulse-intense' 
                : simulationActive 
                  ? 'opacity-70 animate-pulse-line'
                  : 'opacity-60'
            }`}
            filter="url(#glow)"
            style={{
              animationDelay: `${index * 0.3}s`,
              strokeDasharray: hoveredSource === source.id ? '6,1' : '4,2'
            }}
          />
        ))}
      </svg>

      {/* Central dental office node */}
      <div 
        className="absolute w-20 h-20 -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
        style={{ left: '50%', top: '50%' }}
      >
        <div className="w-full h-full bg-gradient-to-br from-connection-primary to-connection-primary/80 rounded-2xl shadow-elegant flex items-center justify-center text-white group-hover:scale-110 transition-all duration-300 animate-pulse-glow border-2 border-white">
          <Building2 className="w-8 h-8" />
        </div>
        <div className="absolute top-full mt-3 left-1/2 -translate-x-1/2 text-sm font-semibold text-connection-text whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white px-3 py-1 rounded-lg shadow-sm border">
          Your Dental Office
        </div>
      </div>

      {/* Source nodes */}
      {sources.map((source, index) => {
        const IconComponent = source.icon;
        const isHovered = hoveredSource === source.id;
        return (
          <div
            key={source.id}
            className="absolute w-12 h-12 md:w-14 md:h-14 -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
            style={{
              left: `${source.position.x}%`,
              top: `${source.position.y}%`,
              animationDelay: `${index * 0.2}s`
            }}
            onMouseEnter={() => setHoveredSource(source.id)}
            onMouseLeave={() => setHoveredSource(null)}
            onClick={() => setHoveredSource(isHovered ? null : source.id)}
          >
            <div className={`w-full h-full bg-white rounded-xl shadow-md flex items-center justify-center transition-all duration-300 border ${
              isHovered 
                ? 'shadow-xl scale-125 border-connection-primary/60 bg-connection-primary/5' 
                : 'shadow-md group-hover:shadow-lg group-hover:scale-110 border-connection-primary/20'
            } animate-fade-in`}>
              <IconComponent className={`w-5 h-5 md:w-6 md:h-6 ${source.color} ${
                isHovered ? 'scale-110' : 'group-hover:scale-110'
              } transition-transform duration-200`} />
            </div>
            
            {/* Enhanced tooltip with volume data */}
            <div className={`absolute top-full mt-2 left-1/2 -translate-x-1/2 text-xs font-medium text-connection-text whitespace-nowrap transition-all duration-200 bg-white px-3 py-2 rounded-lg shadow-lg border z-20 ${
              isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100'
            }`}>
              <div className="text-center">
                <div className="font-semibold">{source.name}</div>
                <div className="text-connection-primary text-xs mt-1">{source.volume} of patients</div>
              </div>
            </div>
            
            {/* Enhanced pulsing connection point */}
            <div className={`absolute top-1/2 left-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2 bg-connection-primary rounded-full ${
              isHovered ? 'animate-ping-intense' : 'animate-ping'
            } opacity-40 transition-all duration-300`} 
                 style={{ animationDelay: `${index * 0.5}s` }} />
          </div>
        );
      })}

      {/* Floating particles for ambiance */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-connection-primary/30 rounded-full animate-float"
            style={{
              left: `${20 + (i * 15)}%`,
              top: `${30 + (i * 8)}%`,
              animationDelay: `${i * 1.2}s`,
              animationDuration: `${4 + (i * 0.5)}s`
            }}
          />
        ))}
      </div>
    </div>
  );
};