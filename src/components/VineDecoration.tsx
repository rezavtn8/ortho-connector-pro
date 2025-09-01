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
            {/* Main vine path */}
            <path
              d="M20 0 Q40 80 30 160 Q50 240 25 320 Q45 400 30 480 Q50 560 25 640 Q40 720 20 800"
              stroke="currentColor"
              strokeWidth="3"
              fill="none"
              className="text-vine opacity-80"
            />
            {/* Secondary branch */}
            <path
              d="M30 160 Q60 180 70 220 Q55 240 45 260"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              className="text-vine opacity-60"
            />
            {/* Leaves along the vine */}
            <g className="text-leaf">
              {/* Leaf cluster 1 */}
              <path d="M35 140 Q45 130 55 135 Q50 145 45 150 Q40 145 35 140 Z" fill="currentColor" opacity="0.9" />
              <path d="M40 152 Q48 148 52 155 Q48 162 42 160 Q38 155 40 152 Z" fill="currentColor" opacity="0.7" />
              
              {/* Leaf cluster 2 */}
              <path d="M50 220 Q62 210 70 218 Q65 230 58 232 Q52 228 50 220 Z" fill="currentColor" opacity="0.8" />
              <path d="M45 235 Q52 230 58 238 Q52 245 47 242 Q43 238 45 235 Z" fill="currentColor" opacity="0.6" />
              
              {/* Leaf cluster 3 */}
              <path d="M28 300 Q38 292 45 298 Q42 308 35 310 Q30 306 28 300 Z" fill="currentColor" opacity="0.9" />
              <path d="M32 315 Q40 312 45 318 Q40 325 35 322 Q30 318 32 315 Z" fill="currentColor" opacity="0.7" />
              
              {/* Leaf cluster 4 */}
              <path d="M48 460 Q58 452 65 458 Q62 468 55 470 Q50 466 48 460 Z" fill="currentColor" opacity="0.8" />
              <path d="M42 475 Q50 470 55 478 Q50 485 45 482 Q40 478 42 475 Z" fill="currentColor" opacity="0.6" />
              
              {/* Leaf cluster 5 */}
              <path d="M28 620 Q38 612 45 618 Q42 628 35 630 Q30 626 28 620 Z" fill="currentColor" opacity="0.9" />
              <path d="M32 635 Q40 632 45 638 Q40 645 35 642 Q30 638 32 635 Z" fill="currentColor" opacity="0.7" />
            </g>
          </svg>
        );
      case 'right':
        return (
          <svg className="w-full h-full" viewBox="0 0 120 800" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Main vine path */}
            <path
              d="M100 0 Q80 80 90 160 Q70 240 95 320 Q75 400 90 480 Q70 560 95 640 Q80 720 100 800"
              stroke="currentColor"
              strokeWidth="3"
              fill="none"
              className="text-vine opacity-80"
            />
            {/* Secondary branch */}
            <path
              d="M90 160 Q60 180 50 220 Q65 240 75 260"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              className="text-vine opacity-60"
            />
            {/* Leaves along the vine */}
            <g className="text-leaf">
              {/* Leaf cluster 1 */}
              <path d="M85 140 Q75 130 65 135 Q70 145 75 150 Q80 145 85 140 Z" fill="currentColor" opacity="0.9" />
              <path d="M80 152 Q72 148 68 155 Q72 162 78 160 Q82 155 80 152 Z" fill="currentColor" opacity="0.7" />
              
              {/* Leaf cluster 2 */}
              <path d="M70 220 Q58 210 50 218 Q55 230 62 232 Q68 228 70 220 Z" fill="currentColor" opacity="0.8" />
              <path d="M75 235 Q68 230 62 238 Q68 245 73 242 Q77 238 75 235 Z" fill="currentColor" opacity="0.6" />
              
              {/* Leaf cluster 3 */}
              <path d="M92 300 Q82 292 75 298 Q78 308 85 310 Q90 306 92 300 Z" fill="currentColor" opacity="0.9" />
              <path d="M88 315 Q80 312 75 318 Q80 325 85 322 Q90 318 88 315 Z" fill="currentColor" opacity="0.7" />
              
              {/* Leaf cluster 4 */}
              <path d="M72 460 Q62 452 55 458 Q58 468 65 470 Q70 466 72 460 Z" fill="currentColor" opacity="0.8" />
              <path d="M78 475 Q70 470 65 478 Q70 485 75 482 Q80 478 78 475 Z" fill="currentColor" opacity="0.6" />
              
              {/* Leaf cluster 5 */}
              <path d="M92 620 Q82 612 75 618 Q78 628 85 630 Q90 626 92 620 Z" fill="currentColor" opacity="0.9" />
              <path d="M88 635 Q80 632 75 638 Q80 645 85 642 Q90 638 88 635 Z" fill="currentColor" opacity="0.7" />
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