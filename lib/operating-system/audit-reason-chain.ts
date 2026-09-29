import type { AuditReasonChainItem } from "@/lib/operating-system/types";
import {
  formatAuditActorType,
  pickAuditDisplayLabel,
  type AuditLogDisplayLabels,
} from "@/lib/audit/display-labels";
import { safeParseJson } from "@/lib/utils";

type AuditLogLike = {
  id: string;
  actionType: string;
  summary: string;
  payload: string | null;
  // Real AuditLog columns. Optional so older callers that only pass the
  // payload keep compiling; when present they back-fill what the payload lacks.
  sourcePage?: string | null;
  actor?: string | null;
  actorType?: string | null;
  displayLabels?: AuditLogDisplayLabels | null;
};

function nonEmpty(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function buildAuditReasonChain(
  log: AuditLogLike,
  english = false,
): AuditReasonChainItem[] {
  const payload = safeParseJson<Record<string, unknown>>(log.payload, {});
  const labels = log.displayLabels ?? {};
  // Source: payload → AuditLog.sourcePage column; a registered label names it.
  // The label is resolved from the column, so it only names the column value.
  const payloadSource = nonEmpty(payload.sourcePage);
  const columnSource = nonEmpty(log.sourcePage);
  const sourcePage =
    payloadSource ??
    (columnSource
      ? (pickAuditDisplayLabel(labels.sourcePage, english) ?? columnSource)
      : null);
  // Result stays payload-derived: there is no result column to fall back to.
  const result =
    typeof payload.result === "string"
      ? payload.result
      : typeof payload.status === "string"
        ? payload.status
        : null;
  // Actor: payload.actorName → registered actor label → AuditLog.actor column.
  const columnActor = nonEmpty(log.actor);
  const actorNote =
    nonEmpty(payload.actorName) ??
    (columnActor
      ? (pickAuditDisplayLabel(labels.actor, english) ?? columnActor)
      : null);
  const actorType = formatAuditActorType(log.actorType, english);

  return [
    {
      id: `${log.id}-action`,
      label: english ? "Action" : "动作",
      // A registered Chinese action label replaces a (possibly English) stored
      // summary in the Chinese chain; the card keeps the summary as detail.
      summary: english
        ? log.summary
        : (pickAuditDisplayLabel(labels.action, false) ?? log.summary),
    },
    {
      id: `${log.id}-source`,
      label: english ? "Source" : "来源",
      summary: sourcePage
        ? english
          ? `This change is recorded as coming from ${sourcePage}.`
          : `这次变化记录的来源是 ${sourcePage}。`
        : english
          ? "The audit payload does not yet expose an explicit source page."
          : "这条审计暂未标出具体来源页面。",
    },
    {
      id: `${log.id}-result`,
      label: english ? "Result" : "结果",
      summary: result
        ? english
          ? `The resulting state recorded in payload is ${result}.`
          : `记录到的结果状态是 ${result}。`
        : english
          ? "The result is only visible in the summary right now."
          : "这次动作的结果目前主要体现在上方说明里。",
    },
    {
      id: `${log.id}-actor`,
      label: english ? "Actor" : "执行者",
      summary: actorNote
        ? english
          ? `${actorNote}${actorType ? ` (${actorType})` : ""} is recorded as the actor.`
          : `记录到的执行者是 ${actorNote}${actorType ? `（${actorType}）` : ""}。`
        : english
          ? "The audit event still needs a richer actor note."
          : "这类审计还值得补更丰富的执行者说明。",
    },
  ];
}
