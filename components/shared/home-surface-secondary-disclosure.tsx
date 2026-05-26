"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { ControlledDisclosure } from "@/components/shared/controlled-disclosure";
import type { HomeSurfaceArrivalKind } from "@/components/shared/home-surface-arrival-banner";

export function HomeSurfaceSecondaryDisclosure({
  kind,
  english,
  title,
  summary,
  children,
}: {
  kind: HomeSurfaceArrivalKind;
  english: boolean;
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <ControlledDisclosure
      className="workspace-panel-muted rounded-[24px] border border-[color:var(--border)]"
      data-home-surface-secondary={kind}
      summaryLabel={title}
      summaryClassName="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-4"
      bodyClassName="space-y-4 border-t border-[color:var(--border)] px-4 py-4"
      summary={
        <>
          <div className="space-y-2">
            <p className="workspace-eyebrow">
              {english ? "Next layer" : "下一层"}
            </p>
            <p className="text-lg font-semibold tracking-tight text-[color:var(--foreground)]">
              {title}
            </p>
            <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">
              {summary}
            </p>
          </div>
          <span className="mt-1 rounded-full border border-[color:var(--border)] bg-[color:var(--background-elevated)] p-2 text-[color:var(--muted-foreground)]">
            <ChevronDown className="h-4 w-4" />
          </span>
        </>
      }
    >
      {children}
    </ControlledDisclosure>
  );
}
