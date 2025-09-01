import React from 'react';
import { ConnectionLine } from './ConnectionLine';
import { ConnectionDot } from './ConnectionDot';

interface NetworkBackgroundProps {
  variant?: 'hero' | 'features' | 'subtle';
  className?: string;
}

export const NetworkBackground: React.FC<NetworkBackgroundProps> = ({
  variant = 'subtle',
  className = ''
}) => {
  if (variant === 'hero') {
    return (
      <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
        {/* Smart grid lines flowing toward center */}
        
        {/* Left side convergence */}
        <ConnectionLine
          startX={0} startY={25}
          endX={35} endY={45}
          animated
          delay={0.3}
        />
        <ConnectionLine
          startX={0} startY={75}
          endX={35} endY={55}
          animated
          delay={0.6}
        />
        
        {/* Right side convergence */}
        <ConnectionLine
          startX={100} startY={20}
          endX={65} endY={40}
          animated
          delay={0.9}
        />
        <ConnectionLine
          startX={100} startY={80}
          endX={65} endY={60}
          animated
          delay={1.2}
        />
        
        {/* Top convergence */}
        <ConnectionLine
          startX={30} startY={0}
          endX={45} endY={35}
          animated
          delay={1.5}
        />
        <ConnectionLine
          startX={70} startY={0}
          endX={55} endY={35}
          animated
          delay={1.8}
        />
        
        {/* Central connection hub */}
        <ConnectionLine
          startX={35} startY={50}
          endX={65} endY={50}
          animated
          delay={2.1}
          className="opacity-40"
        />
        
        {/* Network nodes - no labels */}
        <ConnectionDot position={{ x: 10, y: 25 }} size="sm" delay={2.4} />
        <ConnectionDot position={{ x: 10, y: 75 }} size="sm" delay={2.5} />
        <ConnectionDot position={{ x: 90, y: 20 }} size="sm" delay={2.6} />
        <ConnectionDot position={{ x: 90, y: 80 }} size="sm" delay={2.7} />
        <ConnectionDot position={{ x: 30, y: 10 }} size="sm" delay={2.8} />
        <ConnectionDot position={{ x: 70, y: 10 }} size="sm" delay={2.9} />
        
        {/* Central hub dots */}
        <ConnectionDot position={{ x: 50, y: 50 }} size="md" delay={3.0} />
        
        {/* Unconnected depth dots */}
        <ConnectionDot position={{ x: 20, y: 60 }} size="sm" delay={3.2} className="opacity-30" />
        <ConnectionDot position={{ x: 80, y: 40 }} size="sm" delay={3.4} className="opacity-30" />
        <ConnectionDot position={{ x: 60, y: 20 }} size="sm" delay={3.6} className="opacity-30" />
      </div>
    );
  }

  if (variant === 'features') {
    return (
      <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
        {/* Horizontal connecting lines */}
        <ConnectionLine
          startX={10} startY={25}
          endX={90} endY={25}
          animated
          delay={0}
        />
        <ConnectionLine
          startX={10} startY={50}
          endX={90} endY={50}
          animated
          delay={0.5}
        />
        <ConnectionLine
          startX={10} startY={75}
          endX={90} endY={75}
          animated
          delay={1}
        />
        
        {/* Feature nodes */}
        <ConnectionDot position={{ x: 25, y: 25 }} size="lg" delay={1.5} />
        <ConnectionDot position={{ x: 75, y: 25 }} size="lg" delay={1.7} />
        <ConnectionDot position={{ x: 25, y: 75 }} size="lg" delay={1.9} />
        <ConnectionDot position={{ x: 75, y: 75 }} size="lg" delay={2.1} />
      </div>
    );
  }

  // Subtle variant
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none opacity-20 ${className}`}>
      <ConnectionLine
        startX={0} startY={60}
        endX={30} endY={40}
        curved
        animated
      />
      <ConnectionDot position={{ x: 10, y: 60 }} size="sm" />
      <ConnectionDot position={{ x: 90, y: 20 }} size="sm" />
    </div>
  );
};