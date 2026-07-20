import { resolveRequestUiLocale } from "@/lib/i18n/request-locale.server";

export default async function Loading() {
  const locale = await resolveRequestUiLocale();
  const english = locale === "en-US";

  return (
    <main
      className="surface-grid flex min-h-screen items-center justify-center px-6 py-10"
      data-testid="global-route-loading"
      aria-busy="true"
      aria-live="polite"
    >
      <section className="w-full max-w-xl" aria-labelledby="global-route-loading-title">
        <div className="flex items-center gap-3 text-xs font-medium text-[color:var(--accent)]">
          <span
            className="h-2.5 w-2.5 rounded-full bg-[color:var(--accent)]"
            aria-hidden="true"
          />
          {english ? "Helm workspace" : "Helm 工作区"}
        </div>
        <h1
          id="global-route-loading-title"
          className="mt-4 text-2xl font-semibold text-[color:var(--foreground)]"
        >
          {english ? "Loading this page" : "正在读取当前页面"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[color:var(--muted-foreground)]">
          {english
            ? "Checking your workspace, access scope, and the latest read-only view."
            : "正在核对工作区、访问范围和最新只读视图。"}
        </p>

        <div className="mt-7 animate-pulse space-y-3" aria-hidden="true">
          <div className="h-3 w-40 rounded bg-[color:var(--muted)]" />
          <div className="h-3 w-full rounded bg-[color:var(--muted)]" />
          <div className="h-3 w-4/5 rounded bg-[color:var(--muted)]" />
        </div>

        <p className="mt-7 text-xs leading-5 text-[color:var(--muted-foreground)]">
          {english
            ? "This loading state does not approve, send, or write business data."
            : "这个加载状态不会审批、发送或写入业务数据。"}
        </p>
      </section>
    </main>
  );
}
