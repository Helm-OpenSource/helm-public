"use client";

import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";
import { Badge } from "@/components/ui/badge";
import {
  getLocalizedActionModeLabels,
  getLocalizedApprovalStatusLabels,
  getLocalizedStageLabels,
  getLocalizedThreadStatusLabels,
} from "@/lib/i18n/labels";

export function StageBadge({ stage }: { stage: string }) {
  const { locale } = useWorkspaceUi();
  const stageLabels = getLocalizedStageLabels(locale);
  return <Badge variant="info">{stageLabels[stage] ?? stage}</Badge>;
}

export function ApprovalBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const { locale } = useWorkspaceUi();
  const approvalStatusLabels = getLocalizedApprovalStatusLabels(locale);
  const variant =
    status === "PENDING"
      ? "approval"
      : status === "EXECUTED"
        ? "success"
        : "danger";
  return (
    <Badge variant={variant} className={className}>
      {approvalStatusLabels[status] ?? status}
    </Badge>
  );
}

export function ActionModeBadge({
  mode,
  className,
}: {
  mode: string;
  className?: string;
}) {
  const { locale } = useWorkspaceUi();
  const actionModeLabels = getLocalizedActionModeLabels(locale);
  const variant =
    mode === "AUTO_WITHIN_THRESHOLD"
      ? "success"
      : mode === "REQUIRES_APPROVAL"
        ? "approval"
        : "default";
  return (
    <Badge variant={variant} className={className}>
      {actionModeLabels[mode] ?? mode}
    </Badge>
  );
}

export function ThreadStatusBadge({ status }: { status: string }) {
  const { locale } = useWorkspaceUi();
  const threadStatusLabels = getLocalizedThreadStatusLabels(locale);
  const variant =
    status === "WAITING_US"
      ? "warning"
      : status === "WAITING_THEM"
        ? "info"
        : "default";
  return (
    <Badge variant={variant}>{threadStatusLabels[status] ?? status}</Badge>
  );
}
