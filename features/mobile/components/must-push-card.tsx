/**
 * Must Push Card Component
 *
 * Displays a single Must Push item with title, reason, action, and boundary.
 */

import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import type { MustPushItem } from "../types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface MustPushCardProps {
  item: MustPushItem;
  variant?: "primary" | "supporting";
  english?: boolean;
}

function getSeverityColor(severity: MustPushItem["severity"]) {
  switch (severity) {
    case "critical":
      return "bg-[color:var(--status-danger-bg)] text-[color:var(--status-danger-text)] border-[color:var(--status-danger-border)]";
    case "high":
      return "bg-[color:var(--status-warning-bg)] text-[color:var(--status-warning-text)] border-[color:var(--status-warning-border)]";
    case "medium":
      return "bg-[color:var(--status-warning-bg)] text-[color:var(--status-warning-text)] border-[color:var(--status-warning-border)]";
    case "low":
      return "bg-[color:var(--surface-subtle)] text-[color:var(--foreground)] border-[color:var(--border)]";
  }
}

function getTypeLabel(type: MustPushItem["type"], english: boolean): string {
  const labels: Record<MustPushItem["type"], { zh: string; en: string }> = {
    overdue_commitment: { zh: "逾期", en: "Overdue" },
    blocked_decision: { zh: "待复核", en: "Review" },
    stalled_opportunity: { zh: "停滞", en: "Stalled" },
    meeting_follow_up: { zh: "会待跟进", en: "Follow-up" },
    customer_waiting: { zh: "客户等待", en: "Waiting" },
    proof_or_review_required: { zh: "待补凭证", en: "Proof" },
  };
  return english ? labels[type].en : labels[type].zh;
}

export function MustPushCard({ item, variant = "supporting", english = false }: MustPushCardProps) {
  const isPrimary = variant === "primary";
  const severityColor = getSeverityColor(item.severity);

  return (
    <Link
      href={item.primaryAction.href}
      data-testid="mobile-must-push-card"
      className={cn(
        "block rounded-2xl border p-4 transition active:scale-[0.98] touch-manipulation",
        isPrimary
          ? "bg-[color:var(--surface)] border-[color:var(--border-strong)] shadow-sm"
          : "bg-[color:var(--surface-subtle)] border-[color:var(--border)]"
      )}
    >
      {/* Header: type badge + severity indicator */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <Badge variant="neutral" className="text-xs">
          {getTypeLabel(item.type, english)}
        </Badge>
        {item.severity === "critical" && (
          <div className="flex items-center gap-1 text-[color:var(--accent-danger)]">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">
              {english ? "Urgent" : "紧急"}
            </span>
          </div>
        )}
      </div>

      {/* Title */}
      <h3 className={cn(
        "font-semibold text-[color:var(--foreground)] mb-1.5",
        isPrimary ? "text-lg" : "text-base"
      )}>
        {item.title}
      </h3>

      {/* Reason */}
      <p className="text-sm text-[color:var(--muted)] leading-snug mb-3">
        {item.reason}
      </p>

      {/* Outcome checkpoint */}
      {item.outcomeCheckpoint && (
        <div
          className="mb-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2"
          data-testid="mobile-must-push-outcome"
        >
          <p className="text-xs font-medium text-[color:var(--foreground)]">
            {english ? "Outcome check" : "结果回收"}
          </p>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            {item.outcomeCheckpoint.dueHint}
          </p>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            {item.outcomeCheckpoint.expectedSignal}
          </p>
        </div>
      )}

      {/* Primary action */}
      <div className="flex items-center justify-between">
        <span className={cn(
          "text-sm font-medium text-[var(--accent)]",
          isPrimary ? "text-base" : "text-sm"
        )}>
          {item.primaryAction.label}
        </span>
        <ArrowRight className="h-4 w-4 text-[var(--accent)]" />
      </div>

      {/* Boundary note */}
      {item.boundaryNote && (
        <div className={cn(
          "mt-3 pt-3 border-t border-[color:var(--border)]",
          "rounded-xl px-3 py-2",
          severityColor
        )}>
          <p className="text-xs leading-snug">
            {item.boundaryNote.message}
          </p>
        </div>
      )}
    </Link>
  );
}
