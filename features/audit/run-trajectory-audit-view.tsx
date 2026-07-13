import "server-only";

import type { WorkspaceLike } from "@/lib/extensions/registry-types";
import { resolveShellRunTrajectoryAudit } from "@/lib/shell/resolve-shell-experience";

import { AuditEntryCard } from "./audit-entry-card";
import { AUDIT_SECTION_COPY, t } from "./audit-copy";

/**
 * 回执与审计 · 运行轨迹（read-only 消费者）—— 蓝图 Phase 5 run-trajectory-audit surface
 * 的**首个 Core 渲染消费者**（方法论 v2 §1 五主面之"回执与审计"，§7 语义事件非模型思维）。
 *
 * 只读:resolveShellRunTrajectoryAudit 聚合各 provider 的审计条目(fail-closed 拒 PII/secret、
 * 按 runId 去重)。**无 approve/stop/rerun 控制动作**。空 store → 诚实空态。
 */
export async function RunTrajectoryAuditView({
  workspace,
  english,
}: {
  workspace: WorkspaceLike;
  english: boolean;
}) {
  const { entries } = await resolveShellRunTrajectoryAudit({ workspace, english });

  return (
    <section className="space-y-3" aria-label={t(AUDIT_SECTION_COPY.title, english)}>
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-[color:var(--foreground)]">{t(AUDIT_SECTION_COPY.title, english)}</h2>
        <p className="text-sm text-[color:var(--muted-foreground)]">{t(AUDIT_SECTION_COPY.subtitle, english)}</p>
      </header>

      <p className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-2.5 text-xs text-[color:var(--muted-foreground)]" role="note">
        {t(AUDIT_SECTION_COPY.boundary, english)}
      </p>

      {entries.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[color:var(--border)] px-4 py-6 text-center text-sm text-[color:var(--muted-foreground)]">
          {t(AUDIT_SECTION_COPY.empty, english)}
        </p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <AuditEntryCard key={entry.runId} entry={entry} english={english} />
          ))}
        </ul>
      )}
    </section>
  );
}
