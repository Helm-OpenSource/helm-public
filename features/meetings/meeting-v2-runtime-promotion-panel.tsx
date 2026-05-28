import { Badge } from "@/components/ui/badge";
import type { MeetingRuntimeSummary } from "@/lib/helm-v2/meeting-action-pack-runtime";
import { renderStatusVariant } from "@/features/meetings/meeting-v2-runtime-shared";

type MeetingV2RuntimePromotionPanelProps = {
  runtime: MeetingRuntimeSummary;
  english: boolean;
};

export function MeetingV2RuntimePromotionPanel({
  runtime,
  english,
}: MeetingV2RuntimePromotionPanelProps) {
  return (
    <>
      <div className="theme-surface-panel rounded-2xl px-4 py-4">
        <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Memory promotion posture" : "记忆提升状态"}</p>
        <ul className="mt-3 space-y-2 text-sm text-[color:var(--muted)]">
          {runtime.promotedMemory.map((item) => (
            <li key={item.id}>- {item.summary}</li>
          ))}
          {!runtime.promotedMemory.length ? <li>- {english ? "No promoted memory yet." : "当前还没有已提升记忆。"}</li> : null}
        </ul>
        <p className="mt-3 text-sm leading-6 text-[color:var(--muted-foreground)]">
          {english
            ? "Promoted items are only human-confirmed object facts and checkpoint memory. Inferred items remain draft unless a human turns them into facts."
            : "当前只会提升人工确认的对象事实和检查点记忆。推断项仍保持草稿，除非人工把它改成事实。"}
        </p>
      </div>

      {runtime.v21 ? (
        <div className="theme-surface-panel rounded-2xl px-4 py-4">
          <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Verification and promotion queue" : "验证与提升队列"}</p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
            {runtime.v21.verification?.summary ??
              (english
                ? "Verification has not run yet."
                : "当前验证还没有跑起来。")}
          </p>
          <p className="mt-3 text-sm text-[color:var(--muted-foreground)]">
            {english
              ? `${runtime.v21.promotionQueue.candidates} candidates, ${runtime.v21.promotionQueue.promoted} promoted, ${runtime.v21.promotionQueue.deferred} deferred, ${runtime.v21.promotionQueue.rejected} rejected`
              : `${runtime.v21.promotionQueue.candidates} 个候选，${runtime.v21.promotionQueue.promoted} 个 promoted，${runtime.v21.promotionQueue.deferred} 个 deferred，${runtime.v21.promotionQueue.rejected} 个 rejected`}
          </p>
          {runtime.v21.verification?.blockedReasons.length ? (
            <ul className="mt-3 space-y-1 text-sm text-[color:var(--muted)]">
              {runtime.v21.verification.blockedReasons.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          ) : null}
          {runtime.v21.promotionDecisions.length ? (
            <ul className="mt-4 space-y-3">
              {runtime.v21.promotionDecisions.map((item) => (
                <li key={item.id} className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={renderStatusVariant(item.disposition)}>{item.disposition}</Badge>
                    {item.verificationStatus ? (
                      <Badge variant={renderStatusVariant(item.verificationStatus)}>{item.verificationStatus}</Badge>
                    ) : null}
                    {item.truthConflictStatus !== "NONE" ? (
                      <Badge variant={item.truthConflictStatus === "OPEN" ? "danger" : "neutral"}>
                        {item.truthConflictStatus}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm font-medium text-[color:var(--foreground)]">{item.summary}</p>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">{item.rationale}</p>
                  <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                    {[
                      item.sourceClasses.length
                        ? `${english ? "sources" : "sources"}: ${item.sourceClasses.join(" / ")}`
                        : null,
                      item.confidence !== null ? `${english ? "confidence" : "confidence"}: ${item.confidence}` : null,
                      item.evidenceRefs.length ? `${english ? "evidence" : "evidence"}: ${item.evidenceRefs.join(" / ")}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {item.truthConflictSummary ? (
                    <p className="mt-2 text-xs leading-5 text-[color:var(--status-warning-text)]">
                      {english ? "Conflict" : "冲突"}: {item.truthConflictSummary}
                    </p>
                  ) : null}
                  {item.blockedReasons.length ? (
                    <p className="mt-1 text-xs leading-5 text-[color:var(--muted-foreground)]">
                      {item.blockedReasons.join(" ")}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
