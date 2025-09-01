import React from 'react';

export const HeroVineFrame: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <svg 
        className="w-full h-full" 
        viewBox="0 0 800 600" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Left vine that curves around the text */}
        <path
          d="M50 100 Q150 80 200 150 Q180 200 150 250 Q120 300 100 380 Q130 420 180 450"
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
          className="text-vine opacity-60"
        />
        
        {/* Right vine that curves around the text */}
        <path
          d="M750 100 Q650 80 600 150 Q620 200 650 250 Q680 300 700 380 Q670 420 620 450"
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
          className="text-vine opacity-60"
        />
        
        {/* Top decorative vine */}
        <path
          d="M200 50 Q300 30 400 50 Q500 70 600 50"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          className="text-vine opacity-40"
        />
        
        {/* Bottom decorative vine */}
        <path
          d="M200 550 Q300 530 400 550 Q500 570 600 550"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          className="text-vine opacity-40"
        />
        
        {/* Leaves scattered around the frame */}
        <g className="text-leaf">
          {/* Top left cluster */}
          <path d="M180 120 Q195 110 205 118 Q198 130 188 132 Q182 128 180 120 Z" fill="currentColor" opacity="0.8" />
          <path d="M165 135 Q175 130 182 138 Q175 145 170 142 Q165 138 165 135 Z" fill="currentColor" opacity="0.6" />
          
          {/* Top right cluster */}
          <path d="M620 120 Q605 110 595 118 Q602 130 612 132 Q618 128 620 120 Z" fill="currentColor" opacity="0.8" />
          <path d="M635 135 Q625 130 618 138 Q625 145 630 142 Q635 138 635 135 Z" fill="currentColor" opacity="0.6" />
          
          {/* Left side clusters */}
          <path d="M130 250 Q145 240 155 248 Q148 260 138 262 Q132 258 130 250 Z" fill="currentColor" opacity="0.7" />
          <path d="M115 270 Q125 265 132 273 Q125 280 120 277 Q115 273 115 270 Z" fill="currentColor" opacity="0.5" />
          
          {/* Right side clusters */}
          <path d="M670 250 Q655 240 645 248 Q652 260 662 262 Q668 258 670 250 Z" fill="currentColor" opacity="0.7" />
          <path d="M685 270 Q675 265 668 273 Q675 280 680 277 Q685 273 685 270 Z" fill="currentColor" opacity="0.5" />
          
          {/* Bottom clusters */}
          <path d="M200 480 Q215 470 225 478 Q218 490 208 492 Q202 488 200 480 Z" fill="currentColor" opacity="0.8" />
          <path d="M600 480 Q585 470 575 478 Q582 490 592 492 Q598 488 600 480 Z" fill="currentColor" opacity="0.8" />
          
          {/* Small accent leaves */}
          <path d="M250 80 Q258 76 262 83 Q258 90 252 88 Q248 83 250 80 Z" fill="currentColor" opacity="0.4" />
          <path d="M550 80 Q542 76 538 83 Q542 90 548 88 Q552 83 550 80 Z" fill="currentColor" opacity="0.4" />
        </g>
      </svg>
    </div>
  );
};