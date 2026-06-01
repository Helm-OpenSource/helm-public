/**
 * EnterpriseSurfaceShell
 *
 * 企业可信度（D5）+ 边界声明（D3）合一的 surface 外壳，专门用于
 * admin / governance / reserved-workspace surface。
 *
 * 抽象自 app/admin/trials/page.tsx 的"四处边界声明合一"pattern
 * （eyebrow 标 internal/governance + title 直接给当前要求 +
 * subtitle 含承诺与边界 + 底部 ShieldCheck note）。
 *
 * 何时用：
 * - admin 控制台（如 /admin/trials、/admin/{owner,observability,...}）
 * - governance / 审计 / 复核类 surface
 * - reserved workspace 内部经营面
 *
 * 何时不用：
 * - 普通客户面（用 PageHeader）
 * - 演示 / 营销面（用 marketing-specific layout）
 * - dashboard 主屏（dashboard 已有自己的 PageHeader 与 disclosure 系统）
 *
 * 不在范围：
 * - 不抽客户名 / 站点 logo / locale switcher / theme toggle 等
 *   surface-level chrome（保留给 page 级 layout）
 * - 不抽 main content 区域（counts / table / form 等保留 page 自己渲染）
 */

import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

export function EnterpriseSurfaceShell({
  eyebrow,
  title,
  subtitle,
  shieldNote,
  children,
  testId,
}: {
  /** 顶部小标，例如 "Internal · pilot intake review" / "内部 · 试点申请人工复核"。 */
  eyebrow: string;
  /** 主 title，直接给当前要求，避免类似 "Admin console" 这种工具感命名。 */
  title: string;
  /** 副标，应同时含「承诺 + 边界」一句话，例如 "1 个工作日内拍板... Helm 不会自动通知"。 */
  subtitle: string;
  /** 底部 ShieldCheck 边界声明 footer 文案；空字符串则不渲染 footer。 */
  shieldNote: string;
  /** 主内容区，由调用方渲染（counts / table / form / list 等）。 */
  children: ReactNode;
  /** 可选 data-testid，用于 e2e。 */
  testId?: string;
}) {
  return (
    <div className={"flex w-full flex-col gap-8"} data-testid={testId}>
      <section className="space-y-3">
        <p className="inline-flex rounded-full border border-[color:var(--border)] bg-[color:var(--accent-soft)] px-3 py-1 text-xs font-medium text-[color:var(--accent)]">
          {eyebrow}
        </p>
        <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
          {title}
        </h1>
        <p className="max-w-2xl text-sm leading-7 text-[color:var(--muted)]">
          {subtitle}
        </p>
      </section>

      {children}

      {shieldNote ? (
        <section className="flex items-start gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-4 text-xs leading-5 text-[color:var(--muted)]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--accent)]" />
          <p>{shieldNote}</p>
        </section>
      ) : null}
    </div>
  );
}
