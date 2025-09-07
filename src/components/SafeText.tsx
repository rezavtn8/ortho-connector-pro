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
  const safeContent = escapeHTML(children || '');
  
  return (
    <Component 
      className={className}
      dangerouslySetInnerHTML={{ __html: safeContent }}
    />
  );
};

/**
 * Hook for safely using text in attributes or other contexts
 */
export const useSafeText = (text: string): string => {
  return escapeHTML(text || '');
};