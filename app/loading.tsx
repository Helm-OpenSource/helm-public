import Link from "next/link";
import { getDemoModeProfiles } from "@/lib/demo/demo-modes";
import { resolveRequestUiLocale } from "@/lib/i18n/request-locale.server";
import { getLoadingRecoveryCopy } from "@/lib/presentation/loading-recovery";

export default async function Loading() {
  const locale = await resolveRequestUiLocale();
  const english = locale === "en-US";
  const copy = getLoadingRecoveryCopy(english);
  const demoModes = getDemoModeProfiles(locale);
  const dashboardRecoveryBaseHref = "/dashboard";
  const demoRecoveryBaseHref = "/demo";
  const publicRecoveryHref = copy.publicHref;
  const currentPageRetryHref = "";
  const dashboardRecoveryHref = copy.dashboardHref || dashboardRecoveryBaseHref;
  const demoRecoveryHref = copy.demoHref || demoRecoveryBaseHref;
  const workspaceRecoveryShortcuts = [
    {
      href: "/search",
      label: english ? "Open global search" : "打开全局搜索",
    },
    {
      href: "/operating",
      label: english ? "Open operating board" : "打开经营总盘",
    },
    {
      href: "/approvals#approval-queue",
      label: english ? "Open review queue" : "查看复核队列",
    },
    {
      href: "/memory#memory-work-timeline",
      label: english ? "Open memory timeline" : "打开经营记忆",
    },
    {
      href: "/opportunities?mine=1&action=priority#opportunity-judgement-workspace",
      label: english ? "Open opportunity order" : "查看机会推进",
    },
  ];

  return (
    <main className="surface-grid flex min-h-screen items-center justify-center px-6 py-10">
      <section className="workspace-shell-panel w-full max-w-3xl rounded-[28px] border px-6 py-6 shadow-sm backdrop-blur md:px-7">
        <div className="mb-5 flex items-center gap-3 text-xs font-medium text-[color:var(--accent)]">
          <span
            className="h-2.5 w-2.5 rounded-full bg-[color:var(--accent)]"
            aria-hidden="true"
          />
          {copy.eyebrow}
        </div>
        <h1 className="text-2xl font-semibold text-[color:var(--foreground)]">
          {copy.title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
          {copy.summary}
        </p>
        <nav
          aria-label={english ? "Loading recovery actions" : "加载恢复操作"}
          className="mt-6 grid gap-3 sm:grid-cols-2"
          data-testid="loading-recovery-actions"
        >
          <a
            role="button"
            aria-label={copy.secondaryCta}
            className="theme-primary-action inline-flex min-h-11 items-center justify-center rounded-2xl px-4 text-sm font-semibold text-[color:var(--accent-foreground)] transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]"
            href={currentPageRetryHref}
          >
            {copy.secondaryCta}
          </a>
          <a
            role="button"
            aria-label={copy.dashboardCta}
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 text-sm font-semibold text-[color:var(--foreground)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]"
            href={dashboardRecoveryHref}
          >
            {copy.dashboardCta}
          </a>
          <a
            role="button"
            aria-label={copy.demoCta}
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 text-sm font-semibold text-[color:var(--foreground)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]"
            href={demoRecoveryHref}
          >
            {copy.demoCta}
          </a>
          <a
            role="button"
            aria-label={copy.publicCta}
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 text-sm font-semibold text-[color:var(--foreground)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]"
            href={publicRecoveryHref}
          >
            {copy.publicCta}
          </a>
        </nav>
        <div
          className="mt-4 grid gap-2 sm:grid-cols-3"
          data-testid="loading-recovery-demo-choices"
        >
          {demoModes.map((mode) => (
            <form key={mode.mode} action="/demo/start" method="post">
              <input type="hidden" name="mode" value={mode.mode} />
              <button
                type="submit"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-semibold text-[color:var(--foreground)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]"
                data-testid={`loading-demo-entry-${mode.mode}`}
              >
                {english ? `Enter ${mode.badge}` : `进入${mode.badge}`}
              </button>
            </form>
          ))}
        </div>
        <nav
          aria-label={
            english ? "Workspace recovery shortcuts" : "工作区恢复捷径"
          }
          className="mt-4 grid gap-2 sm:grid-cols-2"
          data-testid="loading-recovery-workspace-shortcuts"
        >
          {workspaceRecoveryShortcuts.map((shortcut) => (
            <Link
              key={shortcut.href}
              className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 text-sm font-semibold text-[color:var(--foreground)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]"
              href={shortcut.href}
            >
              {shortcut.label}
            </Link>
          ))}
        </nav>
        <div className="mt-5 border-t border-[color:var(--border)] pt-4">
          <p className="text-xs leading-5 text-[color:var(--muted-foreground)]">
            {copy.assurance}
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
            <Link
              className="inline-flex text-xs font-semibold text-[color:var(--accent)] underline-offset-4 hover:underline"
              href="/login"
            >
              {copy.primaryCta}
            </Link>
            <Link
              className="inline-flex text-xs font-semibold text-[color:var(--accent)] underline-offset-4 hover:underline"
              href={publicRecoveryHref}
            >
              {copy.publicCta}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
