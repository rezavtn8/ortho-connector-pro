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
        {/* Flowing lines from edges */}
        <ConnectionLine
          startX={0} startY={30}
          endX={40} endY={50}
          curved
          animated
          delay={0.5}
        />
        <ConnectionLine
          startX={100} startY={70}
          endX={60} endY={50}
          curved
          animated
          delay={1}
        />
        <ConnectionLine
          startX={20} startY={0}
          endX={45} endY={35}
          curved
          animated
          delay={1.5}
        />
        
        {/* Connection dots */}
        <ConnectionDot position={{ x: 15, y: 30 }} label="Google" delay={2} />
        <ConnectionDot position={{ x: 85, y: 70 }} label="Referrals" delay={2.2} />
        <ConnectionDot position={{ x: 50, y: 20 }} label="Yelp" delay={2.4} />
        <ConnectionDot position={{ x: 30, y: 80 }} label="Word of Mouth" delay={2.6} />
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