import React from 'react';

interface VineDecorationProps {
  position: 'left' | 'right' | 'top' | 'bottom';
  className?: string;
}

export const VineDecoration: React.FC<VineDecorationProps> = ({ position, className = '' }) => {
  const getVineStyles = () => {
    switch (position) {
      case 'left':
        return 'absolute left-0 top-0 h-full w-32';
      case 'right':
        return 'absolute right-0 top-0 h-full w-32';
      case 'top':
        return 'absolute top-0 left-0 w-full h-24';
      case 'bottom':
        return 'absolute bottom-0 left-0 w-full h-24';
    }
  };

  const getVinePath = () => {
    switch (position) {
      case 'left':
        return (
          <svg className="w-full h-full" viewBox="0 0 120 800" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M20 0 Q40 100 20 200 Q60 250 40 350 Q20 400 40 500 Q60 550 20 650 Q40 700 20 800"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              className="text-leaf animate-vine-grow"
              style={{ strokeDasharray: 1000, strokeDashoffset: 0 }}
            />
            {/* Leaves */}
            <g className="text-leaf animate-leaf-sway" style={{ transformOrigin: '40px 150px' }}>
              <ellipse cx="50" cy="140" rx="8" ry="15" fill="currentColor" opacity="0.8" />
              <ellipse cx="45" cy="155" rx="6" ry="12" fill="currentColor" opacity="0.6" />
            </g>
            <g className="text-leaf animate-leaf-sway" style={{ transformOrigin: '30px 350px', animationDelay: '1s' }}>
              <ellipse cx="25" cy="340" rx="7" ry="14" fill="currentColor" opacity="0.8" />
              <ellipse cx="35" cy="355" rx="5" ry="10" fill="currentColor" opacity="0.6" />
            </g>
            <g className="text-leaf animate-leaf-sway" style={{ transformOrigin: '50px 550px', animationDelay: '2s' }}>
              <ellipse cx="55" cy="540" rx="6" ry="13" fill="currentColor" opacity="0.8" />
              <ellipse cx="50" cy="558" rx="4" ry="9" fill="currentColor" opacity="0.6" />
            </g>
          </svg>
        );
      case 'right':
        return (
          <svg className="w-full h-full" viewBox="0 0 120 800" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M100 0 Q80 100 100 200 Q60 250 80 350 Q100 400 80 500 Q60 550 100 650 Q80 700 100 800"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              className="text-leaf animate-vine-grow"
              style={{ strokeDasharray: 1000, strokeDashoffset: 0, animationDelay: '1s' }}
            />
            {/* Leaves */}
            <g className="text-leaf animate-leaf-sway" style={{ transformOrigin: '80px 180px', animationDelay: '0.5s' }}>
              <ellipse cx="70" cy="170" rx="8" ry="15" fill="currentColor" opacity="0.8" />
              <ellipse cx="75" cy="185" rx="6" ry="12" fill="currentColor" opacity="0.6" />
            </g>
            <g className="text-leaf animate-leaf-sway" style={{ transformOrigin: '90px 380px', animationDelay: '1.5s' }}>
              <ellipse cx="95" cy="370" rx="7" ry="14" fill="currentColor" opacity="0.8" />
              <ellipse cx="85" cy="385" rx="5" ry="10" fill="currentColor" opacity="0.6" />
            </g>
          </svg>
        );
      case 'top':
        return (
          <svg className="w-full h-full" viewBox="0 0 1200 96" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M0 60 Q100 40 200 60 Q300 80 400 60 Q500 40 600 60 Q700 80 800 60 Q900 40 1000 60 Q1100 80 1200 60"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              className="text-leaf animate-vine-grow"
              style={{ strokeDasharray: 1000, strokeDashoffset: 0 }}
            />
            {/* Scattered leaves */}
            <g className="text-leaf animate-float" style={{ animationDelay: '0s' }}>
              <ellipse cx="150" cy="45" rx="6" ry="10" fill="currentColor" opacity="0.7" />
            </g>
            <g className="text-leaf animate-float" style={{ animationDelay: '1s' }}>
              <ellipse cx="450" cy="75" rx="5" ry="9" fill="currentColor" opacity="0.6" />
            </g>
            <g className="text-leaf animate-float" style={{ animationDelay: '2s' }}>
              <ellipse cx="750" cy="45" rx="7" ry="11" fill="currentColor" opacity="0.8" />
            </g>
            <g className="text-leaf animate-float" style={{ animationDelay: '3s' }}>
              <ellipse cx="1050" cy="75" rx="4" ry="8" fill="currentColor" opacity="0.5" />
            </g>
          </svg>
        );
      case 'bottom':
        return (
          <svg className="w-full h-full" viewBox="0 0 1200 96" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M0 36 Q100 56 200 36 Q300 16 400 36 Q500 56 600 36 Q700 16 800 36 Q900 56 1000 36 Q1100 16 1200 36"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              className="text-leaf animate-vine-grow"
              style={{ strokeDasharray: 1000, strokeDashoffset: 0, animationDelay: '2s' }}
            />
            {/* Scattered leaves */}
            <g className="text-leaf animate-float" style={{ animationDelay: '0.5s' }}>
              <ellipse cx="200" cy="51" rx="6" ry="10" fill="currentColor" opacity="0.7" />
            </g>
            <g className="text-leaf animate-float" style={{ animationDelay: '1.5s' }}>
              <ellipse cx="500" cy="21" rx="5" ry="9" fill="currentColor" opacity="0.6" />
            </g>
            <g className="text-leaf animate-float" style={{ animationDelay: '2.5s' }}>
              <ellipse cx="800" cy="51" rx="7" ry="11" fill="currentColor" opacity="0.8" />
            </g>
          </svg>
        );
    }
  };

  return (
    <div className={`${getVineStyles()} ${className} pointer-events-none z-10`}>
      {getVinePath()}
    </div>
  );
};