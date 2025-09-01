import React from 'react';

export const HeroVineFrame: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <svg 
        className="w-full h-full" 
        viewBox="0 0 1000 400" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Elegant curved vine frame */}
        <path
          d="M100 50 Q200 30 350 80 Q450 120 500 100 Q550 80 650 120 Q800 170 900 50"
          stroke="hsl(var(--vine))"
          strokeWidth="2"
          fill="none"
          className="opacity-30"
        />
        
        <path
          d="M100 350 Q200 370 350 320 Q450 280 500 300 Q550 320 650 280 Q800 230 900 350"
          stroke="hsl(var(--vine))"
          strokeWidth="2"
          fill="none"
          className="opacity-30"
        />
        
        {/* Minimal leaf accents */}
        <g fill="hsl(var(--leaf))" className="opacity-40">
          <ellipse cx="300" cy="70" rx="4" ry="8" transform="rotate(-20 300 70)" />
          <ellipse cx="500" cy="90" rx="3" ry="6" transform="rotate(10 500 90)" />
          <ellipse cx="700" cy="110" rx="4" ry="8" transform="rotate(-30 700 110)" />
          
          <ellipse cx="300" cy="330" rx="4" ry="8" transform="rotate(20 300 330)" />
          <ellipse cx="500" cy="310" rx="3" ry="6" transform="rotate(-10 500 310)" />
          <ellipse cx="700" cy="290" rx="4" ry="8" transform="rotate(30 700 290)" />
        </g>
      </svg>
    </div>
  );
};