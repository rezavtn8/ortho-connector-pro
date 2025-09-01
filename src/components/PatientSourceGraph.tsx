import React from 'react';
import { Building2, Globe, Star, Facebook, Users, MessageSquare } from 'lucide-react';

interface PatientSourceGraphProps {
  className?: string;
}

export const PatientSourceGraph: React.FC<PatientSourceGraphProps> = ({ className = '' }) => {
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

      {/* Clean connection lines without arrows */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
            <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
          </linearGradient>
        </defs>
        
        {sources.map((source, index) => (
          <line
            key={source.id}
            x1={source.position.x}
            y1={source.position.y}
            x2="50"
            y2="50"
            stroke="url(#lineGradient)"
            strokeWidth="2"
            className="animate-pulse"
            style={{
              animationDelay: `${index * 0.3}s`,
              animationDuration: '2s'
            }}
          />
        ))}
      </svg>

      {/* Animated flow particles */}
      <div className="absolute inset-0 pointer-events-none">
        {sources.map((source, index) => (
          <div
            key={`flow-${source.id}`}
            className="absolute w-2 h-2 bg-primary rounded-full animate-flow"
            style={{
              left: `${source.position.x}%`,
              top: `${source.position.y}%`,
              animationDelay: `${index * 0.8}s`,
              animationDuration: '4s',
              '--start-x': `${source.position.x - 50}%`,
              '--start-y': `${source.position.y - 50}%`,
            } as any}
          />
        ))}
      </div>

      {/* Floating ambient particles */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-primary/20 rounded-full animate-float"
            style={{
              left: `${20 + (i * 12)}%`,
              top: `${30 + (i * 8)}%`,
              animationDelay: `${i * 1.2}s`,
              animationDuration: `${3 + (i * 0.5)}s`
            }}
          />
        ))}
      </div>

      {/* Central dental office with pulsing effect */}
      <div 
        className="absolute w-20 h-20 -translate-x-1/2 -translate-y-1/2"
        style={{ left: '50%', top: '50%' }}
      >
        <div className="w-full h-full bg-gradient-to-br from-primary to-primary/80 rounded-2xl shadow-xl flex items-center justify-center text-primary-foreground border-2 border-white/50 backdrop-blur-sm animate-pulse-glow">
          <Building2 className="w-9 h-9 drop-shadow-sm" />
        </div>
        <div className="absolute -inset-3 bg-gradient-to-r from-primary/10 to-accent/10 rounded-3xl -z-10 animate-ping opacity-20"></div>
        <div className="absolute top-full mt-3 left-1/2 -translate-x-1/2 text-sm font-semibold text-foreground whitespace-nowrap bg-white/90 backdrop-blur-sm px-4 py-2 rounded-xl shadow-lg border">
          Your Dental Office
        </div>
      </div>

      {/* Source nodes with subtle animations */}
      {sources.map((source, index) => {
        const IconComponent = source.icon;
        
        return (
          <div
            key={source.id}
            className="absolute w-14 h-14 -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${source.position.x}%`,
              top: `${source.position.y}%`,
            }}
          >
            <div className="w-full h-full bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-border/50 flex items-center justify-center animate-bob" style={{
              animationDelay: `${index * 0.2}s`,
              animationDuration: '3s'
            }}>
              <IconComponent className="w-6 h-6 text-muted-foreground drop-shadow-sm" />
            </div>
            
            {/* Subtle glowing ring */}
            <div className={`absolute -inset-1 bg-gradient-to-r ${source.color} rounded-2xl opacity-10 animate-pulse -z-10 blur-sm`} style={{
              animationDelay: `${index * 0.4}s`
            }}></div>
            
            {/* Always visible labels */}
            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 text-xs font-medium text-foreground whitespace-nowrap bg-white/95 backdrop-blur-sm px-3 py-1 rounded-lg shadow-md border">
              <div className="text-center">
                <div className="font-semibold">{source.name}</div>
                <div className="text-primary text-xs">{source.volume}</div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Corner decorative elements with staggered animations */}
      <div className="absolute top-6 left-6 w-3 h-3 bg-gradient-to-br from-primary/30 to-accent/30 rounded-full animate-pulse"></div>
      <div className="absolute top-8 right-12 w-2 h-2 bg-gradient-to-br from-accent/40 to-primary/40 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
      <div className="absolute bottom-12 left-12 w-2.5 h-2.5 bg-gradient-to-br from-primary/25 to-accent/25 rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
      <div className="absolute bottom-6 right-6 w-3 h-3 bg-gradient-to-br from-accent/35 to-primary/35 rounded-full animate-pulse" style={{ animationDelay: '1.5s' }}></div>
    </div>
  );
};