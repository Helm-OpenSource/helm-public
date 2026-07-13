import "server-only";

import type { WorkspaceLike } from "@/lib/extensions/registry-types";
import {
  resolveShellRoleHomeRouting,
  resolveShellWorkstations,
} from "@/lib/shell/resolve-shell-experience";

import { ROUTING_SECTION_COPY, destinationLabel, t } from "./routing-copy";

/**
 * 工位与角色路由（read-only 消费者）—— 蓝图 Phase 3 roleHomeRouting + workstations surface
 * 的**首个 Core 渲染消费者**（方法论 v2 §1 IA 路由的可见性面）。
 *
 * 只读:roleHomeRouting 单一生效(binding=null → Core 默认路由);workstations concat 聚合。
 * **不授权、不改路由**。空/默认 → 诚实展示 Core 默认(无工位)。
 */
export async function WorkspaceRoutingView({
  workspace,
  english,
}: {
  workspace: WorkspaceLike;
  english: boolean;
}) {
  const [{ table }, { workstations }] = await Promise.all([
    resolveShellRoleHomeRouting({ workspace, english, binding: null }),
    resolveShellWorkstations({ workspace, english }),
  ]);
  const c = ROUTING_SECTION_COPY;

  return (
    <section className="space-y-3" aria-label={t(c.title, english)}>
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-[color:var(--foreground)]">{t(c.title, english)}</h2>
        <p className="text-sm text-[color:var(--muted-foreground)]">{t(c.subtitle, english)}</p>
      </header>

      <p className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-2.5 text-xs text-[color:var(--muted-foreground)]" role="note">
        {t(c.boundary, english)}
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 角色家路由 */}
        <div className="space-y-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
          <h3 className="text-sm font-semibold text-[color:var(--foreground)]">{t(c.routingTitle, english)}</h3>
          <ul className="space-y-1 text-sm">
            {table.routes.map((route) => (
              <li key={route.roleCategory} className="flex items-center justify-between gap-3">
                <span className="text-[color:var(--muted-foreground)]">{route.roleCategory}</span>
                <span className="font-medium text-[color:var(--foreground)]">{destinationLabel(route.destination, english)}</span>
              </li>
            ))}
            <li className="flex items-center justify-between gap-3 border-t border-[color:var(--border)] pt-1 text-[color:var(--muted-foreground)]">
              <span>{t(c.fallbackLabel, english)}</span>
              <span className="font-medium text-[color:var(--foreground)]">{destinationLabel(table.fallback, english)}</span>
            </li>
          </ul>
        </div>

        {/* 工位登记 */}
        <div className="space-y-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
          <h3 className="text-sm font-semibold text-[color:var(--foreground)]">{t(c.workstationTitle, english)}</h3>
          {workstations.length === 0 ? (
            <p className="text-sm text-[color:var(--muted-foreground)]">{t(c.workstationEmpty, english)}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {workstations.map((ws) => (
                <li key={ws.key}>
                  {ws.href ? (
                    <a href={ws.href} className="font-medium text-[color:var(--accent)] hover:underline">
                      {ws.label}
                    </a>
                  ) : (
                    <span className="font-medium text-[color:var(--foreground)]">{ws.label}</span>
                  )}
                  {ws.roleCategories.length > 0 ? (
                    <span className="text-xs text-[color:var(--muted-foreground)]">
                      {" "}
                      · {t(c.rolesLabel, english)}: {ws.roleCategories.join(", ")}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
