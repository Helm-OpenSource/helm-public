import type { MeetingRuntimeSummary } from "@/lib/helm-v2/meeting-action-pack-runtime";
import { formatDateLabel } from "@/lib/utils";

type MeetingV2RuntimeActionPackPanelProps = {
  runtime: MeetingRuntimeSummary;
  english: boolean;
  text: (value: string) => string;
};

export function MeetingV2RuntimeActionPackPanel({
  runtime,
  english,
  text,
}: MeetingV2RuntimeActionPackPanelProps) {
  return (
    <>
      <div className="theme-surface-panel min-w-0 max-w-full overflow-hidden rounded-2xl px-4 py-4">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 text-sm font-semibold text-[color:var(--foreground)]">{english ? "Action pack preview" : "行动包预览"}</p>
          {runtime.latestMeetingEndedEvent ? (
            <p className="min-w-0 break-words text-xs text-[color:var(--muted-foreground)]">
              {english ? "latest run" : "最近运行"} · {formatDateLabel(runtime.latestMeetingEndedEvent.createdAt)}
            </p>
          ) : null}
        </div>
        <pre className="mt-3 max-w-full whitespace-pre-wrap break-words text-sm leading-6 text-[color:var(--foreground)]">
          {text(runtime.actionPack?.markdown ?? (english ? "No action pack yet." : "当前还没有行动包。"))}
        </pre>
      </div>

      <div className="theme-surface-panel min-w-0 max-w-full overflow-hidden rounded-2xl px-4 py-4">
        <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Evidence, open questions, and shadow write boundary" : "依据、待确认问题与影子写入边界"}</p>
        <div className="mt-3 grid min-w-0 gap-4 md:grid-cols-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "evidence refs" : "依据引用"}</p>
            <ul className="mt-2 space-y-1 text-sm text-[color:var(--muted)]">
              {(runtime.analystRun?.evidenceRefs ?? []).map((item) => (
                <li key={item} className="break-all">- {item}</li>
              ))}
            </ul>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "open questions" : "待确认问题"}</p>
            <ul className="mt-2 space-y-1 text-sm text-[color:var(--muted)]">
              {(runtime.actionPack?.openQuestions ?? []).map((item) => (
                <li key={item} className="break-words">- {text(item)}</li>
              ))}
              {!runtime.actionPack?.openQuestions.length ? <li>- {english ? "No open questions." : "当前无额外待确认问题。"}</li> : null}
            </ul>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "shadow boundary" : "影子写入边界"}</p>
            <ul className="mt-2 space-y-1 text-sm text-[color:var(--muted)]">
              <li>- {english ? "Shadow stage / risk / next action only." : "只更新影子阶段、风险和下一步。"}</li>
              <li>- {english ? "No official CRM state writeback happens here." : "这里不会写入正式 CRM 状态。"}</li>
              <li>- {english ? "No external send or commitment is created." : "这里不会生成外发或正式承诺。"}</li>
            </ul>
          </div>
        </div>
      </div>

      {runtime.opportunityShadow ? (
        <div className="theme-surface-panel min-w-0 max-w-full overflow-hidden rounded-2xl px-4 py-4">
          <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Latest shadow update" : "最近的影子更新"}</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "stage / risk" : "阶段 / 风险"}</p>
              <p className="mt-2 text-sm text-[color:var(--foreground)]">
                {runtime.opportunityShadow.stage ?? "-"} / {runtime.opportunityShadow.riskLevel ?? "-"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "manager attention" : "管理者关注"}</p>
              <p className="mt-2 text-sm text-[color:var(--foreground)]">{runtime.opportunityShadow.managerAttentionFlag ? (english ? "yes" : "是") : (english ? "no" : "否")}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "next action / blockers" : "下一步 / 阻塞"}</p>
              <p className="mt-2 text-sm text-[color:var(--foreground)]">{runtime.opportunityShadow.nextAction ? text(runtime.opportunityShadow.nextAction) : "-"}</p>
              <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{runtime.opportunityShadow.blockersSummary ? text(runtime.opportunityShadow.blockersSummary) : "-"}</p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
