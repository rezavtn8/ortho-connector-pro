import * as React from "react";
import { Button, ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AccessibleButtonProps extends ButtonProps {
  loading?: boolean;
  loadingText?: string;
  'aria-describedby'?: string;
  'aria-label'?: string;
  shortcut?: string;
}

export const AccessibleButton = React.forwardRef<
  HTMLButtonElement,
  AccessibleButtonProps
>(({ 
  children, 
  loading, 
  loadingText, 
  disabled, 
  className,
  shortcut,
  ...props 
}, ref) => {
  const isDisabled = disabled || loading;

  return (
    <Button
      ref={ref}
      disabled={isDisabled}
      className={cn(
        // Enhanced focus styles for accessibility
        "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring",
        className
      )}
      aria-busy={loading}
      {...props}
    >
      <span className={loading ? "opacity-0" : ""}>
        {children}
        {shortcut && (
          <kbd className="ml-2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            {shortcut}
          </kbd>
        )}
      </span>
      
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span className="sr-only">
            {loadingText || 'Loading...'}
          </span>
        </div>
      )}
    </Button>
  );
});

AccessibleButton.displayName = "AccessibleButton";