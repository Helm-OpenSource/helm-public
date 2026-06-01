import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "min-w-0 max-w-full rounded-[26px] border border-[color:var(--border)] bg-[image:var(--surface-card-gradient)] text-[color:var(--foreground)] shadow-[var(--shadow-card)] backdrop-blur supports-[backdrop-filter]:bg-[color:color-mix(in_oklab,var(--surface)_84%,white_16%)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex min-w-0 flex-col gap-2 px-5 pt-5 md:px-6 md:pt-6", className)}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "min-w-0 break-words text-base font-semibold tracking-tight text-[color:var(--foreground)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        "min-w-0 max-w-3xl break-words text-sm leading-6 text-[color:var(--muted-foreground)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("min-w-0 px-5 pb-5 md:px-6 md:pb-6", className)} {...props} />
  );
}

export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center px-5 pb-5 md:px-6 md:pb-6", className)}
      {...props}
    />
  );
}
