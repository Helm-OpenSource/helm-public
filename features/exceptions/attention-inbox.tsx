import "server-only";

import type {
  ShellRuntimeContext,
  WorkspaceLike,
} from "@/lib/extensions/registry-types";
import { resolveShellAttention } from "@/lib/shell/resolve-shell-experience";
import type { AttentionItem } from "@/lib/shell/attention-feed";

import { AttentionItemCard } from "./attention-item-card";
import { ATTENTION_SECTION_COPY, severityRank, t } from "./attention-copy";

/**
 * 异常工作台 · Agent 收件箱（read-only 消费者）—— 蓝图 Phase 2b attention surface 的
 * **首个 Core 渲染消费者**（方法论 v2 §1 五主面之"异常工作台"）。
 *
 * 只读:resolveShellAttention 并发聚合各 provider 的异常条目(fail-closed 拒 PII、去重、
 * 超时源出"来源未返回"条目),按 severity 升序稳定排序展示。**不代执行、不自动处置**——
 * 导航到既有人审流程。空 store → 诚实空态,如实反映"契约就绪、真实 provider 待接"。
 */
export async function AttentionInbox({
  workspace,
  english,
  roleCategory,
  runtimeContext,
  items: resolvedItems,
}: {
  workspace: WorkspaceLike;
  english: boolean;
  roleCategory?: string | null;
  runtimeContext?: ShellRuntimeContext;
  /** Reuse a page-level resolution so providers are not queried twice. */
  items?: ReadonlyArray<AttentionItem>;
}) {
  const items =
    resolvedItems ??
    (
      await resolveShellAttention({
        workspace,
        english,
        roleCategory,
        runtimeContext,
      })
    ).items;
  const sorted = [...items].sort(
    (a, b) => severityRank(a.severity) - severityRank(b.severity) || a.key.localeCompare(b.key),
  );

  return (
    <section className="space-y-3" aria-label={t(ATTENTION_SECTION_COPY.title, english)}>
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-[color:var(--foreground)]">{t(ATTENTION_SECTION_COPY.title, english)}</h2>
        <p className="text-sm text-[color:var(--muted-foreground)]">{t(ATTENTION_SECTION_COPY.subtitle, english)}</p>
      </header>

      <p className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-2.5 text-xs text-[color:var(--muted-foreground)]" role="note">
        {t(ATTENTION_SECTION_COPY.boundary, english)}
      </p>

      {sorted.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[color:var(--border)] px-4 py-6 text-center text-sm text-[color:var(--muted-foreground)]">
          {t(ATTENTION_SECTION_COPY.empty, english)}
        </p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((item) => (
            <AttentionItemCard key={`${item.roleCategory}:${item.key}`} item={item} english={english} />
          ))}
        </ul>
      )}
    </section>
  );
}
