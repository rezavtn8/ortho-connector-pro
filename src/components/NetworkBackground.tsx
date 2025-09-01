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
        {/* Tech interface corner connections - avoiding text areas */}
        
        {/* Top left corner connection */}
        <ConnectionLine
          startX={5} startY={5}
          endX={25} endY={5}
          curved={false}
          animated={false}
          className="opacity-40"
        />
        <ConnectionLine
          startX={25} startY={5}
          endX={25} endY={20}
          curved={false}
          animated={false}
          className="opacity-40"
        />
        
        {/* Top right corner connection */}
        <ConnectionLine
          startX={75} startY={5}
          endX={95} endY={5}
          curved={false}
          animated={false}
          className="opacity-40"
        />
        <ConnectionLine
          startX={95} startY={5}
          endX={95} endY={20}
          curved={false}
          animated={false}
          className="opacity-40"
        />
        
        {/* Bottom left corner connection */}
        <ConnectionLine
          startX={5} startY={80}
          endX={5} endY={95}
          curved={false}
          animated={false}
          className="opacity-40"
        />
        <ConnectionLine
          startX={5} startY={95}
          endX={20} endY={95}
          curved={false}
          animated={false}
          className="opacity-40"
        />
        
        {/* Bottom right corner connection */}
        <ConnectionLine
          startX={80} startY={95}
          endX={95} endY={95}
          curved={false}
          animated={false}
          className="opacity-40"
        />
        <ConnectionLine
          startX={95} startY={80}
          endX={95} endY={95}
          curved={false}
          animated={false}
          className="opacity-40"
        />
        
        {/* Side tech accents - in free areas */}
        <ConnectionLine
          startX={8} startY={35}
          endX={18} endY={35}
          curved={false}
          animated={false}
          className="opacity-25"
        />
        <ConnectionLine
          startX={18} startY={35}
          endX={18} endY={45}
          curved={false}
          animated={false}
          className="opacity-25"
        />
        
        <ConnectionLine
          startX={82} startY={55}
          endX={92} endY={55}
          curved={false}
          animated={false}
          className="opacity-25"
        />
        <ConnectionLine
          startX={82} startY={55}
          endX={82} endY={65}
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