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
        {/* Clean framing lines - positioned to avoid text overlap */}
        
        {/* Top elegant curve - above headline */}
        <ConnectionLine
          startX={20} startY={15}
          endX={80} endY={15}
          curved={false}
          animated={false}
          className="opacity-30"
        />
        
        {/* Subtle side accent - left side */}
        <ConnectionLine
          startX={5} startY={30}
          endX={15} endY={70}
          curved={false}
          animated={false}
          className="opacity-20"
        />
        
        {/* Bottom framing line - below CTA */}
        <ConnectionLine
          startX={30} startY={85}
          endX={70} endY={85}
          curved={false}
          animated={false}
          className="opacity-25"
        />
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