import React from 'react';

interface AnimatedNexoraLogoProps {
  className?: string;
  size?: number;
  animate?: boolean;
}

export const AnimatedNexoraLogo: React.FC<AnimatedNexoraLogoProps> = ({ 
  className = '', 
  size = 24, 
  animate = true 
}) => {
  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 100 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10"
      >
        <defs>
          <linearGradient id="letterGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5EACA8" />
            <stop offset="100%" stopColor="#4A9B97" />
          </linearGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge> 
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/> 
            </feMerge>
          </filter>
        </defs>
        
        {/* Letter N */}
        <path 
          d="M25 20 L25 80 L35 80 L35 40 L65 80 L75 80 L75 20 L65 20 L65 60 L35 20 Z" 
          fill="url(#letterGradient)"
          filter={animate ? "url(#glow)" : "none"}
          className={animate ? "animate-glow" : ""}
        />
      </svg>
      
      {/* Orbital Ring */}
      <div 
        className={`absolute inset-0 ${animate ? 'animate-orbit' : ''}`}
        style={{ 
          width: size, 
          height: size,
          transformOrigin: 'center center'
        }}
      >
        <div 
          className="absolute w-2 h-2 rounded-full bg-gradient-to-r from-connection-primary to-connection-accent shadow-glow"
          style={{
            top: '10%',
            left: '50%',
            transform: 'translateX(-50%)',
            filter: 'drop-shadow(0 0 8px #5EACA8)'
          }}
        />
      </div>
      
      {/* Orbital Path (visible ring) */}
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 100 100" 
        className="absolute inset-0"
        style={{ opacity: 0.3 }}
      >
        <circle 
          cx="50" 
          cy="50" 
          r="40" 
          fill="none" 
          stroke="#5EACA8" 
          strokeWidth="0.5"
          strokeDasharray="2,2"
          className={animate ? "animate-pulse" : ""}
        />
      </svg>
      
      {/* Sparkle Effects */}
      {animate && (
        <>
          <div 
            className="absolute w-1 h-1 bg-connection-accent rounded-full animate-sparkle"
            style={{ 
              top: '20%', 
              right: '20%',
              animationDelay: '1s'
            }}
          />
          <div 
            className="absolute w-1 h-1 bg-connection-primary rounded-full animate-sparkle"
            style={{ 
              bottom: '25%', 
              left: '15%',
              animationDelay: '2.5s'
            }}
          />
        </>
      )}
    </div>
  );
};