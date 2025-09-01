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
        {/* Enhanced gradient backgrounds with subtle movement */}
        <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-connection-primary/5 to-transparent rounded-full blur-3xl animate-float" style={{ animationDelay: '0s', animationDuration: '8s' }} />
        <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-connection-primary/3 to-transparent rounded-full blur-3xl animate-float" style={{ animationDelay: '2s', animationDuration: '10s' }} />
        <div className="absolute bottom-0 left-0 w-36 h-36 bg-gradient-to-tr from-connection-primary/4 to-transparent rounded-full blur-3xl animate-float" style={{ animationDelay: '4s', animationDuration: '12s' }} />
        
        {/* Subtle data flow particles along circuit lines */}
        <div className="absolute inset-0">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute w-0.5 h-0.5 bg-connection-primary/40 rounded-full animate-travel-line"
              style={{
                left: `${10 + (i * 10)}%`,
                top: `${15 + (i * 8)}%`,
                animationDelay: `${i * 1.5}s`,
                animationDuration: '6s'
              }}
            />
          ))}
        </div>
        
        {/* Circuit-style corner connections with glow */}
        
        {/* Top left circuit */}
        <ConnectionLine
          startX={2} startY={8}
          endX={18} endY={8}
          curved={false}
          animated={false}
          className="opacity-60 drop-shadow-circuit"
        />
        <ConnectionLine
          startX={18} startY={8}
          endX={18} endY={18}
          curved={false}
          animated={false}
          className="opacity-60 drop-shadow-circuit"
        />
        <ConnectionLine
          startX={18} startY={18}
          endX={28} endY={18}
          curved={false}
          animated={false}
          className="opacity-40 drop-shadow-circuit"
        />
        
        {/* Top right circuit */}
        <ConnectionLine
          startX={72} startY={8}
          endX={82} endY={8}
          curved={false}
          animated={false}
          className="opacity-40 drop-shadow-circuit"
        />
        <ConnectionLine
          startX={82} startY={8}
          endX={98} endY={8}
          curved={false}
          animated={false}
          className="opacity-60 drop-shadow-circuit"
        />
        <ConnectionLine
          startX={82} startY={8}
          endX={82} endY={18}
          curved={false}
          animated={false}
          className="opacity-60 drop-shadow-circuit"
        />
        
        {/* Bottom left circuit */}
        <ConnectionLine
          startX={2} startY={82}
          endX={2} endY={92}
          curved={false}
          animated={false}
          className="opacity-60 drop-shadow-circuit"
        />
        <ConnectionLine
          startX={2} startY={92}
          endX={18} endY={92}
          curved={false}
          animated={false}
          className="opacity-60 drop-shadow-circuit"
        />
        <ConnectionLine
          startX={18} startY={82}
          endX={18} endY={92}
          curved={false}
          animated={false}
          className="opacity-40 drop-shadow-circuit"
        />
        
        {/* Bottom right circuit */}
        <ConnectionLine
          startX={82} startY={82}
          endX={82} endY={92}
          curved={false}
          animated={false}
          className="opacity-40 drop-shadow-circuit"
        />
        <ConnectionLine
          startX={82} startY={92}
          endX={98} endY={92}
          curved={false}
          animated={false}
          className="opacity-60 drop-shadow-circuit"
        />
        <ConnectionLine
          startX={82} startY={82}
          endX={98} endY={82}
          curved={false}
          animated={false}
          className="opacity-60 drop-shadow-circuit"
        />
        
        {/* Subtle middle accents */}
        <ConnectionLine
          startX={5} startY={45}
          endX={15} endY={45}
          curved={false}
          animated={false}
          className="opacity-20 drop-shadow-circuit"
        />
        <ConnectionLine
          startX={85} startY={55}
          endX={95} endY={55}
          curved={false}
          animated={false}
          className="opacity-20 drop-shadow-circuit"
        />
        
        {/* Connection nodes at intersections */}
        <ConnectionDot position={{ x: 18, y: 8 }} size="sm" className="opacity-80" animated={false} />
        <ConnectionDot position={{ x: 82, y: 8 }} size="sm" className="opacity-80" animated={false} />
        <ConnectionDot position={{ x: 18, y: 92 }} size="sm" className="opacity-80" animated={false} />
        <ConnectionDot position={{ x: 82, y: 92 }} size="sm" className="opacity-80" animated={false} />
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