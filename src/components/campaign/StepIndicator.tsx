import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface StepIndicatorProps {
  /** 1-based. */
  step: number;
  labels: string[];
}

/** Shared wizard header for the three campaign creators. */
export function StepIndicator({ step, labels }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-2 mb-1">
      {labels.map((label, index) => {
        const n = index + 1;
        const done = step > n;
        const current = step === n;
        return (
          <React.Fragment key={label}>
            <div className="flex items-center gap-2 shrink-0">
              <div
                className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium transition-colors ${
                  current
                    ? 'bg-primary text-primary-foreground'
                    : done
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {done ? <CheckCircle2 className="w-4 h-4" /> : n}
              </div>
              <span
                className={`text-xs font-medium hidden sm:block ${
                  current ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {label}
              </span>
            </div>
            {n < labels.length && (
              <div className={`flex-1 h-0.5 rounded ${done ? 'bg-primary/40' : 'bg-muted'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
