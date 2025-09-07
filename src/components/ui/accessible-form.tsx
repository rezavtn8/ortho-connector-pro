import * as React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useId } from "@/hooks/useAccessibility";
import { cn } from "@/lib/utils";

interface AccessibleFormFieldProps {
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactElement;
}

export function AccessibleFormField({
  label,
  description,
  error,
  required = false,
  className,
  children
}: AccessibleFormFieldProps) {
  const fieldId = useId('field');
  const descriptionId = useId('description');
  const errorId = useId('error');

  // Clone the child element and add accessibility props
  const childWithProps = React.cloneElement(children, {
    id: fieldId,
    'aria-describedby': cn(
      description && descriptionId,
      error && errorId
    ).trim() || undefined,
    'aria-invalid': error ? 'true' : undefined,
    'aria-required': required,
    ...children.props
  });

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={fieldId} className={cn(required && "after:content-['*'] after:ml-0.5 after:text-destructive")}>
        {label}
      </Label>
      
      {description && (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      )}
      
      {childWithProps}
      
      {error && (
        <p id={errorId} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

interface AccessibleInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  description?: string;
  error?: string;
}

export const AccessibleInput = React.forwardRef<HTMLInputElement, AccessibleInputProps>(
  ({ label, description, error, required, className, ...props }, ref) => {
    return (
      <AccessibleFormField label={label} description={description} error={error} required={required}>
        <Input ref={ref} className={className} {...props} />
      </AccessibleFormField>
    );
  }
);

AccessibleInput.displayName = "AccessibleInput";

interface AccessibleTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  description?: string;
  error?: string;
}

export const AccessibleTextarea = React.forwardRef<HTMLTextAreaElement, AccessibleTextareaProps>(
  ({ label, description, error, required, className, ...props }, ref) => {
    return (
      <AccessibleFormField label={label} description={description} error={error} required={required}>
        <Textarea ref={ref} className={className} {...props} />
      </AccessibleFormField>
    );
  }
);

AccessibleTextarea.displayName = "AccessibleTextarea";

interface AccessibleSelectProps {
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  placeholder?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

export function AccessibleSelect({
  label,
  description,
  error,
  required,
  placeholder,
  value,
  onValueChange,
  children
}: AccessibleSelectProps) {
  return (
    <AccessibleFormField label={label} description={description} error={error} required={required}>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {children}
        </SelectContent>
      </Select>
    </AccessibleFormField>
  );
}