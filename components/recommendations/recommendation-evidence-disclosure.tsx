"use client";

import { useEffect, useMemo, useRef } from "react";
import { FileSearch, Sparkles } from "lucide-react";
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";
import { formatRoleDetailDisplayText } from "@/lib/presentation/role-detail-display-copy";
import { formatSeededBusinessCopy } from "@/lib/presentation/seeded-business-copy";

type RecommendationEvidenceDisclosureProps = {
  recommendationId: string;
  sourcePage?: string | null;
  evidenceSummary: string;
  explanation: string;
  supportingHighlights: string[];
  briefingSummary: string | null;
  ifNoAction: string;
};

function isTrackableRecommendation(recommendationId: string) {
  return !(
    recommendationId.startsWith("preview-") ||
    recommendationId.startsWith("fallback-")
  );
}

async function trackRecommendationEvent(
  recommendationId: string,
  eventName: "recommendation_card_viewed" | "recommendation_explanation_viewed",
  sourcePage?: string | null,
) {
  if (!isTrackableRecommendation(recommendationId)) return;

  try {
    await fetch(`/api/recommendations/${recommendationId}/track`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        eventName,
        sourcePage: sourcePage ?? null,
      }),
    });
  } catch {
    // Never block the main recommendation flow because telemetry failed.
  }
}

export function RecommendationEvidenceDisclosure({
  recommendationId,
  sourcePage,
  evidenceSummary,
  explanation,
  supportingHighlights,
  briefingSummary,
  ifNoAction,
}: RecommendationEvidenceDisclosureProps) {
  const { locale } = useWorkspaceUi();
  const english = locale === "en-US";
  const text = (value: string | null | undefined) =>
    formatRoleDetailDisplayText(
      formatSeededBusinessCopy(value, english),
      english,
    );
  const viewedRef = useRef(false);
  const explanationOpenedRef = useRef(false);
  const viewedStorageKey = useMemo(
    () =>
      `recommendation:viewed:${recommendationId}:${sourcePage ?? "unknown"}`,
    [recommendationId, sourcePage],
  );

  useEffect(() => {
    if (!isTrackableRecommendation(recommendationId)) return;
    if (viewedRef.current) return;

    try {
      if (
        typeof window !== "undefined" &&
        window.sessionStorage.getItem(viewedStorageKey)
      ) {
        viewedRef.current = true;
        return;
      }
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(viewedStorageKey, "1");
      }
    } catch {
      // Ignore storage failures and still attempt telemetry.
    }

    viewedRef.current = true;
    void trackRecommendationEvent(
      recommendationId,
      "recommendation_card_viewed",
      sourcePage,
    );
  }, [recommendationId, sourcePage, viewedStorageKey]);

  return (
    <details
      className="workspace-note-card mt-4"
      data-tone="slate"
      onToggle={(event) => {
        const target = event.currentTarget;
        if (!target.open || explanationOpenedRef.current) return;
        explanationOpenedRef.current = true;
        void trackRecommendationEvent(
          recommendationId,
          "recommendation_explanation_viewed",
          sourcePage,
        );
      }}
    >
      <summary className="workspace-note-title flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 text-sm font-medium">
        <span className="inline-flex items-center gap-2">
          <div className="workspace-note-icon-shell p-2 text-[color:var(--muted-foreground)]">
            <FileSearch className="h-4 w-4" />
          </div>
          {english ? "Expand evidence and consequence" : "展开依据与后果"}
        </span>
        <span className="workspace-note-meta text-xs">
          {text(evidenceSummary)}
        </span>
      </summary>
      <div className="space-y-4 border-t border-[color:color-mix(in_oklab,var(--border)_78%,transparent)] px-4 py-4 dark:border-white/10">
        <div className="workspace-note-card px-4 py-4" data-tone="slate">
          <p className="workspace-note-meta text-xs font-medium">
            {english ? "Evidence" : "依据"}
          </p>
          <p className="workspace-note-body mt-2 text-sm leading-7">
            {text(explanation)}
          </p>
        </div>
        {supportingHighlights.length ? (
          <div className="workspace-note-card px-4 py-4" data-tone="sky">
            <p className="workspace-note-meta text-xs font-medium">
              {english ? "Supporting memory" : "支持性记忆"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {supportingHighlights.map((item) => (
                <span key={item} className="workspace-note-chip">
                  {text(item)}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {briefingSummary ? (
          <div className="workspace-note-card px-4 py-4" data-tone="violet">
            <p className="workspace-note-meta text-xs font-medium">
              {english ? "Recent briefing signal" : "最近简报判断"}
            </p>
            <p className="workspace-note-body mt-2 text-sm leading-7">
              {text(briefingSummary)}
            </p>
          </div>
        ) : null}
        <div className="workspace-note-card px-4 py-4" data-tone="amber">
          <div className="flex items-start gap-3">
            <div className="workspace-note-icon-shell p-2 text-[color:var(--status-warning-text)]0">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="workspace-note-meta text-xs font-medium">
                {english ? "If you still do nothing" : "如果继续不推进"}
              </p>
              <p className="workspace-note-body mt-2 text-sm leading-7">
                {text(ifNoAction)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </details>
  );
}
