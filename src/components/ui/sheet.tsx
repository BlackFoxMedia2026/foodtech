"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetPortal = DialogPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-carbon-900/35 backdrop-blur-[2px] data-[state=open]:animate-fade-in",
      className,
    )}
    {...props}
  />
));
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName;

export const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    side?: "right" | "left";
    width?: string;
  }
>(({ className, children, side = "right", width = "480px", ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed top-0 z-50 flex h-screen flex-col border-border bg-card shadow-elevated transition-transform data-[state=open]:animate-slide-in",
        side === "right" ? "right-0 border-l" : "left-0 border-r",
        className,
      )}
      style={{ width }}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = DialogPrimitive.Content.displayName;

export function SheetHeader({
  title,
  description,
  action,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-3 border-b border-border px-6 py-5">
      <div className="min-w-0">
        <DialogPrimitive.Title className="text-display text-lg font-medium tracking-tight">
          {title}
        </DialogPrimitive.Title>
        {description && (
          <DialogPrimitive.Description className="mt-1 text-sm text-secondary">
            {description}
          </DialogPrimitive.Description>
        )}
      </div>
      <div className="flex items-center gap-2">
        {action}
        <DialogPrimitive.Close className="rounded-md p-1 text-tertiary transition hover:bg-secondary hover:text-foreground">
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
      </div>
    </header>
  );
}

export function SheetBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex-1 overflow-y-auto px-6 py-5", className)}>{children}</div>
  );
}

export function SheetFooter({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <footer
      className={cn(
        "flex items-center justify-end gap-2 border-t border-border bg-[hsl(var(--surface-sunken))] px-6 py-4",
        className,
      )}
    >
      {children}
    </footer>
  );
}
