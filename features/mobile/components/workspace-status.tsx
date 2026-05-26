/**
 * Workspace Status Component
 *
 * Displays workspace name, today's summary, and top alert at the top of mobile screen.
 */

import type { WorkspaceStatus } from "../types";

export interface WorkspaceStatusProps {
  status: WorkspaceStatus;
  english?: boolean;
}

export function WorkspaceStatus({ status, english = false }: WorkspaceStatusProps) {
  return (
    <div className="sticky top-0 z-10 bg-[color:var(--surface)]/95 backdrop-blur-sm border-b border-[color:var(--border)] px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[color:var(--foreground)] truncate">
            {status.workspaceName}
          </p>
          <p className="mt-0.5 text-sm text-[color:var(--muted)] truncate">
            {status.todaySummary}
          </p>
        </div>
        <div className="flex max-w-[48%] shrink-0 flex-wrap justify-end gap-1.5">
          {status.topAlert && (
            <div className="rounded-full bg-[color:var(--status-danger-bg)] px-2.5 py-1">
              <span className="whitespace-nowrap text-xs font-medium text-[color:var(--status-danger-text)]">
                {status.topAlert}
              </span>
            </div>
          )}
          {status.reviewCount > 0 && (
            <div className="rounded-full bg-[color:var(--status-warning-bg)] px-2.5 py-1">
              <span className="whitespace-nowrap text-xs font-medium text-[color:var(--status-warning-text)]">
                {status.reviewCount} {english ? "review" : "待复核"}
              </span>
            </div>
          )}
          {(status.outcomeCheckpointCount ?? 0) > 0 && (
            <div className="rounded-full bg-[color:var(--surface-subtle)] px-2.5 py-1">
              <span className="whitespace-nowrap text-xs font-medium text-[color:var(--muted-foreground)]">
                {status.outcomeCheckpointCount} {english ? "outcome" : "结果"}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
