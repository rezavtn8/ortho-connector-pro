import React from 'react';
import { Office, Clinic } from '@/hooks/useMapData';

interface MarkerProps {
  office?: Office;
  clinic?: Clinic;
  onClick?: () => void;
}

export function createOfficeMarker(office: Office, onClick?: () => void): HTMLDivElement {
  const color = getCategoryColor(office.category);
  const size = getCategorySize(office.category);
  
  const el = document.createElement('div');
  el.innerHTML = `
    <div style="
      background-color: ${color};
      width: ${size.width}px;
      height: ${size.height}px;
      border-radius: 50%;
      border: 3px solid white;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 3px 10px rgba(0,0,0,0.3);
      position: relative;
      cursor: pointer;
      transition: transform 0.2s ease;
    ">
      <svg width="${size.iconSize}" height="${size.iconSize}" fill="white" viewBox="0 0 24 24">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
      </svg>
      ${office.currentMonthReferrals > 0 ? `
        <div style="
          position: absolute;
          top: -8px;
          right: -8px;
          background-color: #ef4444;
          color: white;
          border-radius: 50%;
          width: 22px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: bold;
          border: 2px solid white;
        ">${office.currentMonthReferrals}</div>
      ` : ''}
    </div>
  `;
  
  el.addEventListener('mouseenter', () => {
    el.style.transform = 'scale(1.1)';
  });
  
  el.addEventListener('mouseleave', () => {
    el.style.transform = 'scale(1)';
  });

  if (onClick) {
    el.addEventListener('click', onClick);
  }
  
  return el;
}

export function createClinicMarker(): HTMLDivElement {
  const el = document.createElement('div');
  el.innerHTML = `
    <div style="
      background-color: #2563eb;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      border: 4px solid white;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      cursor: pointer;
      transition: transform 0.2s ease;
    ">
      <svg width="24" height="24" fill="white" viewBox="0 0 24 24">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
    </div>
  `;

  el.addEventListener('mouseenter', () => {
    el.style.transform = 'scale(1.1)';
  });
  
  el.addEventListener('mouseleave', () => {
    el.style.transform = 'scale(1)';
  });
  
  return el;
}

function getCategoryColor(category: string): string {
  switch (category) {
    case 'VIP': return '#8b5cf6';
    case 'Strong': return '#10b981';
    case 'Moderate': return '#f97316';
    case 'Sporadic': return '#ef4444';
    default: return '#9ca3af';
  }
}

function getCategorySize(category: string) {
  switch (category) {
    case 'VIP': return { width: 48, height: 48, iconSize: 24 };
    case 'Strong': return { width: 48, height: 48, iconSize: 24 };
    case 'Moderate': return { width: 36, height: 36, iconSize: 18 };
    case 'Sporadic': return { width: 28, height: 28, iconSize: 14 };
    default: return { width: 28, height: 28, iconSize: 14 };
  }
}