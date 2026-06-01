import Link from "next/link";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { resolveRequestUiLocale } from "@/lib/i18n/request-locale.server";

export default async function MeetingDetailLoading() {
  const locale = await resolveRequestUiLocale();
  const english = locale === "en-US";
  const shortcuts = [
    {
      href: "/meetings",
      label: english ? "Back to meetings" : "返回会议列表",
    },
    {
      href: "/approvals#approval-queue",
      label: english ? "Open review queue" : "查看复核队列",
    },
  ];

  return (
    <div
      className="space-y-6"
      data-testid="meeting-detail-loading"
      aria-busy="true"
    >
      <section className="workspace-shell-panel rounded-[28px] border px-6 py-5 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.38)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <p className="workspace-eyebrow">
              {english ? "Meeting detail" : "会议详情"}
            </p>
            <h1 className="text-2xl font-semibold text-[color:var(--foreground)]">
              {english ? "Loading the meeting loop" : "正在加载会议闭环"}
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-[color:var(--muted)]">
              {english
                ? "Pulling the note, runtime signals, follow-ups, what's still in review, and the memory tied to this meeting."
                : "正在拉取这场会议的纪要、运行态信号、跟进项、待复核内容和已沉淀的经营记忆。"}
            </p>
            <p className="text-xs leading-5 text-[color:var(--muted-foreground)]">
              {english
                ? "This loading screen does not approve, send, or write externally."
                : "这个加载页面不会审批、发送或对外写入。"}
            </p>
          </div>
          <nav
            aria-label={
              english
                ? "Meeting detail loading shortcuts"
                : "会议详情加载捷径"
            }
            className="flex min-w-0 flex-wrap gap-2"
          >
            {shortcuts.map((shortcut) => (
              <Link
                key={shortcut.href}
                className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-semibold text-[color:var(--foreground)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]"
                href={shortcut.href}
              >
                {shortcut.label}
              </Link>
            ))}
          </nav>
        </div>
      </section>
      <PageSkeleton columns={3} rows={3} />
    </div>
  );
}
