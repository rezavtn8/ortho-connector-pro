import React from 'react';
import { checkPasswordStrength } from '@/lib/validation';
import { cn } from '@/lib/utils';
import { Check, X } from 'lucide-react';

interface PasswordStrengthIndicatorProps {
  password: string;
  className?: string;
}

export function PasswordStrengthIndicator({ password, className }: PasswordStrengthIndicatorProps) {
  const { strength, message, checks, score } = checkPasswordStrength(password);

  if (!password) return null;

  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'weak':
        return 'text-destructive';
      case 'fair':
        return 'text-orange-500';
      case 'good':
        return 'text-yellow-500';
      case 'strong':
        return 'text-green-500';
      default:
        return 'text-muted-foreground';
    }
  };

  const getBarColor = (index: number) => {
    if (index < score) {
      switch (strength) {
        case 'weak':
          return 'bg-destructive';
        case 'fair':
          return 'bg-orange-500';
        case 'good':
          return 'bg-yellow-500';
        case 'strong':
          return 'bg-green-500';
        default:
          return 'bg-muted';
      }
    }
    return 'bg-muted';
  };

  return (
    <div className={cn('space-y-2', className)}>
      {/* Strength bars */}
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((index) => (
          <div
            key={index}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              getBarColor(index)
            )}
          />
        ))}
      </div>

      {/* Strength text */}
      <p className={cn('text-sm font-medium', getStrengthColor(strength))}>
        {message}
      </p>

      {/* Requirements checklist */}
      <div className="grid grid-cols-2 gap-1 text-xs">
        <div className={cn('flex items-center gap-1', checks.minLength ? 'text-green-600' : 'text-muted-foreground')}>
          {checks.minLength ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
          <span>8+ characters</span>
        </div>
        <div className={cn('flex items-center gap-1', checks.hasUpper ? 'text-green-600' : 'text-muted-foreground')}>
          {checks.hasUpper ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
          <span>Uppercase</span>
        </div>
        <div className={cn('flex items-center gap-1', checks.hasLower ? 'text-green-600' : 'text-muted-foreground')}>
          {checks.hasLower ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
          <span>Lowercase</span>
        </div>
        <div className={cn('flex items-center gap-1', checks.hasNumber ? 'text-green-600' : 'text-muted-foreground')}>
          {checks.hasNumber ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
          <span>Number</span>
        </div>
      </div>
    </div>
  );
}