import React from 'react';

interface ConnectionLineProps {
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  curved?: boolean;
  animated?: boolean;
  className?: string;
  delay?: number;
}

export const ConnectionLine: React.FC<ConnectionLineProps> = ({
  startX = 0,
  startY = 50,
  endX = 100,
  endY = 50,
  curved = false,
  animated = true,
  className = '',
  delay = 0
}) => {
  const pathData = curved 
    ? `M${startX} ${startY} Q${(startX + endX) / 2} ${startY - 20} ${endX} ${endY}`
    : `M${startX} ${startY} L${endX} ${endY}`;

  return (
    <svg 
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      viewBox="0 0 100 100" 
      preserveAspectRatio="none"
    >
      <path
        d={pathData}
        stroke="hsl(var(--connection-primary))"
        strokeWidth="0.5"
        fill="none"
        className={`opacity-60 ${animated ? 'animate-draw-line hover-glow' : ''}`}
        style={{ 
          animationDelay: `${delay}s`,
          strokeDasharray: animated ? '100' : 'none'
        }}
      />
    </svg>
  );
};