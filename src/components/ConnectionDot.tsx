import React from 'react';

interface ConnectionDotProps {
  size?: 'sm' | 'md' | 'lg';
  position?: { x: number; y: number };
  label?: string;
  animated?: boolean;
  className?: string;
  delay?: number;
}

export const ConnectionDot: React.FC<ConnectionDotProps> = ({
  size = 'md',
  position = { x: 50, y: 50 },
  label,
  animated = true,
  className = '',
  delay = 0
}) => {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  };

  return (
    <div 
      className={`absolute ${sizeClasses[size]} -translate-x-1/2 -translate-y-1/2 ${className}`}
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`
      }}
    >
      <div 
        className={`w-full h-full bg-connection-primary rounded-full ${
          animated ? 'animate-pulse-dot animate-pulse-glow' : ''
        } cursor-pointer transition-all duration-300 hover:scale-125 hover:animate-glow hover:bg-connection-secondary`}
        style={{ animationDelay: `${delay}s` }}
      />
      {label && (
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 text-xs text-connection-text whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity duration-200 bg-white px-2 py-1 rounded shadow-sm border">
          {label}
        </div>
      )}
    </div>
  );
};