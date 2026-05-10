import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-9 items-center justify-center gap-1 rounded-xl bg-muted/90 p-1 text-muted-foreground shadow-inner [perspective:1200px]",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "relative inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-1 text-sm font-medium ring-offset-background",
      "transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] will-change-transform",
      "hover:z-20 hover:-translate-y-1.5 hover:scale-[1.06] hover:-rotate-x-2",
      "hover:bg-gradient-to-br hover:from-fuchsia-500/30 hover:via-violet-500/25 hover:to-cyan-400/25",
      "hover:shadow-[0_20px_50px_-12px_rgba(168,85,247,0.55),0_12px_28px_-10px_rgba(34,211,238,0.4),inset_0_1px_0_rgba(255,255,255,0.25)]",
      "hover:ring-1 hover:ring-white/25 hover:brightness-110",
      "active:translate-y-0 active:scale-[1.02]",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "disabled:pointer-events-none disabled:opacity-50",
      "data-[state=active]:translate-y-0 data-[state=active]:scale-100 data-[state=active]:rotate-0 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=active]:ring-0",
      className
    )}
    style={{ transformStyle: "preserve-3d" }}
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
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
