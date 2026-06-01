"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { recordFirstLoopAdoptionEventAction } from "@/features/first-loop/actions";

type FirstLoopHandoffEntryTrackerProps = {
  href: string;
  label: string;
  summary: string;
  stepId:
    | "role-goal"
    | "signal"
    | "suggestion"
    | "review"
    | "follow-through"
    | "write-back"
    | "anchor";
};

function getSourcePage(pathname: string | null, search: string) {
  const base = pathname || "/dashboard";
  return search ? `${base}?${search}` : base;
}

export function FirstLoopHandoffEntryTracker({
  href,
  label,
  summary,
  stepId,
}: FirstLoopHandoffEntryTrackerProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const trackedRef = useRef(false);

  useEffect(() => {
    if (trackedRef.current) {
      return;
    }
    trackedRef.current = true;

    void recordFirstLoopAdoptionEventAction({
      kind: "setup-handoff-entered",
      href,
      label,
      summary,
      sourcePage: getSourcePage(pathname, searchParams.toString()),
      sourceArea: "dashboard-handoff",
      stepId,
    });
  }, [href, label, pathname, searchParams, stepId, summary]);

  return null;
}
