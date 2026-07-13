import "server-only";

import type { WorkspaceLike } from "@/lib/extensions/registry-types";
import { resolveShellOperationSuggestions } from "@/lib/shell/resolve-shell-experience";

import { ChangePacketCard } from "./change-packet-card";
import { BOUNDARY_NOTE, SECTION_COPY, t } from "./change-packet-copy";

/**
 * 实施队列 · 变更包（read-only 消费者）—— 蓝图 Phase 4 operation-suggestion surface 的
 * **首个 Core 渲染消费者**（方法论 v2 §1 五主面之"实施队列"；§8 L1 生成变更包）。
 *
 * 只读:resolveShellOperationSuggestions 聚合各 provider 的变更包并展示;**不代执行**
 * (边界横幅置顶)。空 store(无 provider 注册)→ 诚实空态,不造数——这也如实反映当前
 * "契约就绪、真实 provider/UI 消费待接"的阶段(不夸大)。
 */
export async function OperationSuggestionQueue({
  workspace,
  english,
}: {
  workspace: WorkspaceLike;
  english: boolean;
}) {
  const { suggestions } = await resolveShellOperationSuggestions({ workspace, english });

  return (
    <section className="space-y-4" aria-label={t(SECTION_COPY.title, english)}>
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-[color:var(--foreground)]">{t(SECTION_COPY.title, english)}</h2>
        <p className="text-sm text-[color:var(--muted-foreground)]">{t(SECTION_COPY.subtitle, english)}</p>
      </header>

      {/* 边界横幅:准备与监督,不代执行——用户可能误当执行面时必须可见 */}
      <p
        className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-3 text-sm text-[color:var(--muted-foreground)]"
        role="note"
      >
        {t(BOUNDARY_NOTE, english)}
      </p>

      {suggestions.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[color:var(--border)] px-4 py-8 text-center text-sm text-[color:var(--muted-foreground)]">
          {t(SECTION_COPY.empty, english)}
        </p>
      ) : (
        <div className="space-y-4">
          {suggestions.map((suggestion) => (
            <ChangePacketCard key={suggestion.key} suggestion={suggestion} english={english} />
          ))}
        </div>
      )}
    </section>
  );
}
