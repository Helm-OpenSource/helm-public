/**
 * Must Push List Component
 *
 * Displays the list of Must Push items with overflow handling.
 */

import { AlertTriangle, ChevronDown, MoreHorizontal } from "lucide-react";
import type { MustPushItem } from "../types";
import { MustPushCard } from "./must-push-card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface MustPushListProps {
  items: MustPushItem[];
  totalCount?: number;
  foldedCount?: number;
  hasCriticalFolded?: boolean;
  english?: boolean;
}

export function MustPushList({
  items,
  totalCount,
  foldedCount = 0,
  hasCriticalFolded = false,
  english = false,
}: MustPushListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-4 py-8 text-center">
        <p className="text-sm text-[color:var(--muted-foreground)]">
          {english ? "No urgent items right now" : "暂无紧急事项"}
        </p>
      </div>
    );
  }

  const primaryItem = items[0];
  const supportingItems = items.slice(1);

  return (
    <div className="space-y-4" data-testid="mobile-must-push-list">
      {/* Section header */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-base font-semibold text-[color:var(--foreground)]">
          {english ? "Must Push" : "必须推进"}
        </h2>
        {totalCount !== undefined && totalCount > items.length && (
          <Badge variant="neutral" className="text-xs">
            {totalCount}
          </Badge>
        )}
      </div>

      {/* Primary item */}
      {primaryItem && (
        <MustPushCard item={primaryItem} variant="primary" english={english} />
      )}

      {/* Supporting items */}
      {supportingItems.length > 0 && (
        <div className="space-y-3">
          {supportingItems.map((item) => (
            <MustPushCard key={item.id} item={item} variant="supporting" english={english} />
          ))}
        </div>
      )}

      {/* Overflow indicator */}
      {foldedCount > 0 && (
        <div
          className={cn(
            "flex items-center justify-between rounded-2xl px-4 py-3 border",
            hasCriticalFolded
              ? "bg-[color:var(--status-danger-bg)] border-[color:var(--status-danger-border)]"
              : "bg-[color:var(--surface-subtle)] border-[color:var(--border)]"
          )}
        >
          <div className="flex items-center gap-2">
            {hasCriticalFolded ? (
              <AlertTriangle className="h-4 w-4 text-[color:var(--accent-danger)]" />
            ) : (
              <MoreHorizontal className="h-4 w-4 text-[color:var(--muted-foreground)]" />
            )}
            <span className={cn(
              "text-sm",
              hasCriticalFolded ? "text-[color:var(--status-danger-text)]" : "text-[color:var(--muted)]"
            )}>
              {english
                ? `${foldedCount} more item${foldedCount > 1 ? "s" : ""}`
                : `还有 ${foldedCount} 项`}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 text-[color:var(--muted-foreground)]" />
        </div>
      )}
    </div>
  );
}
