import React from 'react';

interface LeafIconProps {
  className?: string;
  size?: number;
}

export const LeafIcon: React.FC<LeafIconProps> = ({ className = '', size = 24 }) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M17 8c0-3.866-3.582-7-8-7S1 4.134 1 8c0 2.577 1.372 4.832 3.445 6.124C5.329 15.188 6.125 16 7 16c.563 0 1.063-.281 1.369-.724C9.134 14.473 10 13.5 10 12.5c0-.866-.623-1.582-1.445-1.726C7.372 10.168 6 8.577 6 8c0-1.657 1.79-3 4-3s4 1.343 4 3c0 .577-1.372 2.168-2.555 2.774C10.623 10.918 10 11.634 10 12.5c0 1 .866 1.973 1.631 2.776C11.937 15.719 12.437 16 13 16c.875 0 1.671-.812 2.555-1.876C17.628 12.832 19 10.577 19 8h-2z"
        fill="currentColor"
        opacity="0.8"
      />
      <path
        d="M12 8c0 2-2 4-2 4s-2-2-2-4 2-4 4-2c1 1 0 2 0 2z"
        fill="currentColor"
        opacity="0.6"
      />
    </svg>
  );
};