import React from 'react';
import { escapeHTML } from '@/lib/sanitize';

interface SafeTextProps {
  children: string;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

/**
 * Component for safely displaying user-generated text content
 * Automatically escapes HTML entities to prevent XSS attacks
 */
export const SafeText: React.FC<SafeTextProps> = ({ 
  children, 
  className, 
  as: Component = 'span' 
}) => {
  return (
    <Component className={className}>
      {children || ''}
    </Component>
  );
};

/**
 * Hook for safely using text in attributes or other contexts
 */
export const useSafeText = (text: string): string => {
  return escapeHTML(text || '');
};