"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { recordFirstLoopAdoptionEventAction } from "@/features/first-loop/actions";
import { Button, type ButtonProps } from "@/components/ui/button";

type FirstLoopTrackedActionButtonProps = {
  href: string;
  label: string;
  summary: string;
  ctaLabel: string;
  ariaLabel?: string;
  sourceArea:
    | "dashboard-handoff"
    | "first-loop-summary"
    | "dashboard-work-entry";
  eventKind: "primary-action-opened" | "anchor-resumed";
  stepId:
    | "role-goal"
    | "signal"
    | "suggestion"
    | "review"
    | "follow-through"
    | "write-back"
    | "anchor";
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
};

function getSourcePage(pathname: string | null, search: string) {
  const base = pathname || "/dashboard";
  return search ? `${base}?${search}` : base;
}

export function FirstLoopTrackedActionButton({
  href,
  label,
  summary,
  ctaLabel,
  ariaLabel,
  sourceArea,
  eventKind,
  stepId,
  variant = "default",
  size = "sm",
}: FirstLoopTrackedActionButtonProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sourcePage = getSourcePage(pathname, searchParams.toString());

  return (
    <Button asChild variant={variant} size={size}>
      <Link
        href={href}
        aria-label={ariaLabel ?? ctaLabel}
        data-first-loop-tracked-action-link="true"
        onClick={() => {
          void recordFirstLoopAdoptionEventAction({
            kind: eventKind,
            href,
            label,
            summary,
            sourcePage,
            sourceArea,
            stepId,
          }).catch(() => {
            // Do not block the first loop on trace delivery failure.
          });
        }}
      >
        {ctaLabel}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </Button>
  );
}
