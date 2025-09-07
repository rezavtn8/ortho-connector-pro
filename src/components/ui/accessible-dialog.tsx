import * as React from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from "@/components/ui/dialog";
import { useAccessibility } from "@/hooks/useAccessibility";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AccessibleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  showCloseButton?: boolean;
}

export function AccessibleDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  showCloseButton = true
}: AccessibleDialogProps) {
  const { containerRef, handleEscape } = useAccessibility({
    trapFocus: true,
    restoreFocus: true,
    escapeCloses: true
  });

  // Handle escape key
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      handleEscape(event, () => onOpenChange(false));
    };

    if (open) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, handleEscape, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        ref={containerRef}
        className={className}
        aria-describedby={description ? undefined : 'dialog-description'}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription id="dialog-description">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="py-4">
          {children}
        </div>

        {footer && (
          <DialogFooter>
            {footer}
          </DialogFooter>
        )}

        {showCloseButton && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-4 top-4 h-auto p-1"
            onClick={() => onOpenChange(false)}
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}