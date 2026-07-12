import Link from "next/link";
import type {
  MainlineNode,
  MainlineNodeStage,
  MainlineReadout,
} from "@/lib/shell/operating-mainline";
import { validateMainlineReadout } from "@/lib/shell/operating-mainline";

const STAGE_COPY: Record<MainlineNodeStage, { zh: string; en: string }> = {
  unbound: { zh: "未接入", en: "Unbound" },
  observing: { zh: "观察中", en: "Observing" },
  suggesting: { zh: "建议中", en: "Suggesting" },
  suggestion_ready_pending_human: {
    zh: "建议已就绪·待人工确认",
    en: "Suggestion ready · pending human",
  },
};

function NodeCard({ node, english }: { node: MainlineNode; english: boolean }) {
  const stage = STAGE_COPY[node.stage];
  const body = (
    <div className="flex min-w-[150px] flex-col gap-1 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-[color:var(--foreground)]">
          {node.label}
        </span>
        <span className="rounded-full border border-[color:var(--border)] px-2 py-0.5 text-[10px] text-[color:var(--muted-foreground)]">
          {english ? stage.en : stage.zh}
        </span>
      </div>
      {node.status === "measured" ? (
        <div className="text-xs text-[color:var(--muted-foreground)]">
          {english ? "In flight" : "在途"}{" "}
          <span className="font-semibold text-[color:var(--foreground)]">
            {node.inFlightCount ?? "—"}
          </span>
          {node.needsHuman !== null ? (
            <>
              {" · "}
              {english ? "needs human" : "需人"}{" "}
              <span className="font-semibold text-[color:var(--foreground)]">
                {node.needsHuman}
              </span>
            </>
          ) : null}
        </div>
      ) : (
        <div className="text-xs text-[color:var(--muted-foreground)]">
          {node.pendingSourceNote ??
            (english ? "Data source pending" : "数据源接入中")}
        </div>
      )}
    </div>
  );
  return node.href ? (
    <Link href={node.href} className="shrink-0">
      {body}
    </Link>
  ) : (
    <div className="shrink-0">{body}</div>
  );
}

/**
 * 段①经营主线（顶部摘要）。conformance 不通过时整体降级为
 * "主线暂不可用"卡（fail-open 不空屏、不部分渲染）。
 */
export function MainlineStrip({
  readout,
  english,
}: {
  readout: MainlineReadout;
  english: boolean;
}) {
  const issues = validateMainlineReadout(readout);
  if (issues.length > 0) {
    return (
      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-3 text-sm text-[color:var(--muted-foreground)]">
        {english
          ? "Operating mainline is temporarily unavailable."
          : "经营主线暂不可用。"}
      </div>
    );
  }
  return (
    <div
      className="flex gap-3 overflow-x-auto pb-1"
      data-shell-mainline
      aria-label={english ? "Operating mainline" : "经营主线"}
    >
      {readout.nodes.map((node) => (
        <NodeCard key={node.key} node={node} english={english} />
      ))}
    </div>
  );
}
