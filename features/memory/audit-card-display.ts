import {
  pickAuditDisplayLabel,
  type AuditLogDisplayLabels,
} from "@/lib/audit/display-labels";

type AuditCardLog = {
  actionType: string;
  actor: string;
  targetType: string;
  summary: string;
  displayLabels?: AuditLogDisplayLabels | null;
};

export type AuditCardDisplay = {
  /** Card headline. */
  title: string;
  /** Original stored summary, shown under a label-derived headline. */
  detail: string | null;
  /** Action badge; null when the headline already is the action label. */
  badge: string | null;
  /** Raw action code, kept for tooltips / debugging. */
  actionCode: string;
  actor: string;
  targetType: string;
};

/**
 * Resolve what the memory audit-replay card shows for one AuditLog row.
 *
 * Registered labels (contributed by Packs/Overlays) are used verbatim; only
 * unlabeled raw codes/summaries go through `formatText` (the frontstage copy
 * normalizer), so a Chinese label is never mangled by keyword replacement.
 * In Chinese, a registered action label becomes the headline and the stored
 * summary (which may predate Chinese copy) is kept as secondary detail.
 */
export function buildAuditCardDisplay(
  log: AuditCardLog,
  english: boolean,
  formatText: (value: string) => string,
): AuditCardDisplay {
  const labels = log.displayLabels ?? {};
  const actionLabel = pickAuditDisplayLabel(labels.action, english);
  const useActionHeadline = !english && Boolean(actionLabel);

  return {
    title: useActionHeadline ? actionLabel! : formatText(log.summary),
    detail: useActionHeadline ? formatText(log.summary) : null,
    badge: useActionHeadline ? null : (actionLabel ?? formatText(log.actionType)),
    actionCode: log.actionType,
    actor: pickAuditDisplayLabel(labels.actor, english) ?? formatText(log.actor),
    targetType:
      pickAuditDisplayLabel(labels.targetType, english) ??
      formatText(log.targetType),
  };
}
