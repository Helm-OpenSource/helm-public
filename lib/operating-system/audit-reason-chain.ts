import type { AuditReasonChainItem } from "@/lib/operating-system/types";
import { safeParseJson } from "@/lib/utils";

type AuditLogLike = {
  id: string;
  actionType: string;
  summary: string;
  payload: string | null;
};

export function buildAuditReasonChain(
  log: AuditLogLike,
  english = false,
): AuditReasonChainItem[] {
  const payload = safeParseJson<Record<string, unknown>>(log.payload, {});
  const sourcePage =
    typeof payload.sourcePage === "string" ? payload.sourcePage : null;
  const result =
    typeof payload.result === "string"
      ? payload.result
      : typeof payload.status === "string"
        ? payload.status
        : null;
  const actorNote =
    typeof payload.actorName === "string" ? payload.actorName : null;

  return [
    {
      id: `${log.id}-action`,
      label: english ? "Action" : "动作",
      summary: log.summary,
    },
    {
      id: `${log.id}-source`,
      label: english ? "Source" : "来源",
      summary: sourcePage
        ? english
          ? `This change was emitted from ${sourcePage}, so it is tied to a real working surface rather than a floating background mutation.`
          : `这次变化来自 ${sourcePage}，说明它是从真实工作界面发出来的，不是漂浮的后台改动。`
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
          ? `${actorNote} is recorded as the actor in the payload.`
          : `记录到的执行者是 ${actorNote}。`
        : english
          ? "The audit event still needs a richer actor note."
          : "这类审计还值得补更丰富的执行者说明。",
    },
  ];
}
