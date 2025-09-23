import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const tabsListVariants = cva(
  "inline-flex items-center justify-center rounded-lg bg-gradient-card border border-border p-1 text-muted-foreground shadow-card backdrop-blur-sm transition-smooth",
  {
    variants: {
      variant: {
        default: "h-11 gap-1 bg-gradient-card border-border/50",
        compact: "h-9 gap-0.5 p-0.5 bg-muted/20 border-border/40",
        pills: "h-12 gap-2 p-1.5 bg-gradient-subtle border-border/30 shadow-elegant",
        underline: "h-12 gap-0 p-0 bg-transparent border-0 shadow-none border-b border-border/60 rounded-none",
      },
      size: {
        sm: "h-9",
        default: "h-11", 
        lg: "h-13",
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const tabsTriggerVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap font-medium ring-offset-background transition-spring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 relative overflow-hidden",
  {
    variants: {
      variant: {
        default: "rounded-md px-4 py-2 text-sm hover:bg-accent/60 hover:scale-[1.02] data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-card data-[state=active]:shadow-primary/20 hover:text-foreground data-[state=active]:scale-[1.02] before:absolute before:inset-0 before:bg-gradient-primary before:opacity-0 before:transition-opacity before:duration-300 data-[state=active]:before:opacity-10",
        compact: "rounded px-3 py-1.5 text-xs hover:bg-accent/60 hover:scale-[1.02] data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-card data-[state=active]:scale-[1.02]",
        pills: "rounded-full px-5 py-2.5 text-sm font-semibold hover:bg-primary/15 hover:text-primary hover:scale-[1.05] hover:shadow-glow/50 data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-elegant data-[state=active]:scale-[1.05] transition-all duration-500",
        underline: "rounded-none px-4 py-3 text-sm border-b-2 border-transparent hover:text-primary hover:border-primary/50 hover:bg-primary/5 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-primary/10 data-[state=active]:shadow-glow/30 transition-all duration-400",
      }
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>
>(({ className, variant, size, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(tabsListVariants({ variant, size }), className)}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & VariantProps<typeof tabsTriggerVariants>
>(({ className, variant, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(tabsTriggerVariants({ variant }), className)}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-6 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
      "data-[state=active]:animate-fade-in-up data-[state=inactive]:animate-fade-out-down",
      "transition-all duration-300 ease-in-out",
      "data-[state=active]:opacity-100 data-[state=inactive]:opacity-0",
      "data-[state=active]:transform data-[state=active]:translate-y-0 data-[state=inactive]:translate-y-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
