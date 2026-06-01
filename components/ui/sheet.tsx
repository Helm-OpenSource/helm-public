"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

type SheetContentProps = React.ComponentProps<typeof DialogPrimitive.Content> & {
  closeLabel?: string;
};

export function SheetContent({
  className,
  children,
  closeLabel = "Close panel",
  ...props
}: SheetContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[color:color-mix(in_oklab,var(--foreground)_35%,transparent)] backdrop-blur-sm" />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-full max-w-[540px] overflow-y-auto border-l border-[color:var(--border)] bg-[color:var(--surface)] p-0 shadow-2xl",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          type="button"
          aria-label={closeLabel}
          className="absolute right-4 top-4 rounded-full p-2 text-[color:var(--muted-foreground)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--foreground)]"
        >
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function SheetHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "border-b border-[color:var(--border)] px-5 py-4",
        className,
      )}
      {...props}
    />
  );
}

export const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-base font-semibold text-[color:var(--foreground)]",
      className,
    )}
    {...props}
  />
));
SheetTitle.displayName = DialogPrimitive.Title.displayName;

export const SheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn(
      "mt-1 text-sm text-[color:var(--muted-foreground)]",
      className,
    )}
    {...props}
  />
));
SheetDescription.displayName = DialogPrimitive.Description.displayName;
