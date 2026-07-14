import "server-only";

import type {
  ShellRuntimeContext,
  WorkspaceLike,
} from "@/lib/extensions/registry-types";
import { resolveShellNorthstarKpis } from "@/lib/shell/resolve-shell-experience";

import { DIRECTION_COPY, KPI_SECTION_COPY, formatKpiValue, t } from "./kpi-copy";

const DIRECTION_CLASS: Record<"up" | "down" | "neutral", string> = {
  up: "text-[color:var(--status-success-text,#166534)]",
  down: "text-[color:var(--status-success-text,#166534)]",
  neutral: "text-[color:var(--muted-foreground)]",
};

/**
 * 北极星 KPI 面板（read-only 消费者）—— 蓝图 Phase 2b northstarKpiSources surface 的
 * **首个 Core 渲染消费者**（方法论 v2 §1 五主面之"经营控制塔"的指标行）。
 *
 * 只读:resolveShellNorthstarKpis 并发聚合各 provider 的 KPI(逐条 conformance 过滤/去重)。
 * 金额只给分档、三态禁造数。空 store → 诚实空态。
 */
export async function NorthstarKpiPanel({
  workspace,
  english,
  runtimeContext,
}: {
  workspace: WorkspaceLike;
  english: boolean;
  runtimeContext?: ShellRuntimeContext;
}) {
  const { kpis } = await resolveShellNorthstarKpis({
    workspace,
    english,
    runtimeContext,
  });
  if (kpis.length === 0) {
    // 空态克制:控制塔已有主线,KPI 无源时不占版面,仅一行诚实说明。
    return (
      <p className="text-xs text-[color:var(--muted-foreground)]">{t(KPI_SECTION_COPY.empty, english)}</p>
    );
  }
  return (
    <section className="space-y-2" aria-label={t(KPI_SECTION_COPY.title, english)}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const { text, muted } = formatKpiValue(kpi, english);
          const dir = DIRECTION_COPY[kpi.direction];
          return (
            <div key={kpi.key} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
              <p className="truncate text-xs text-[color:var(--muted-foreground)]">{kpi.label}</p>
              <p className="mt-1 flex items-baseline gap-1">
                <span className={`text-lg font-semibold ${muted ? "text-[color:var(--muted-foreground)]" : "text-[color:var(--foreground)]"}`}>
                  {text}
                </span>
                {!muted && dir ? <span className={`text-sm ${DIRECTION_CLASS[dir.tone]}`}>{dir.arrow}</span> : null}
              </p>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-[color:var(--muted-foreground)]">{t(KPI_SECTION_COPY.boundary, english)}</p>
    </section>
  );
}
