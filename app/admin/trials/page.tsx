import { cookies } from "next/headers";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TrialApplicationStatus } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import { EnterpriseSurfaceShell } from "@/components/shared/enterprise-surface-shell";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { PublicLocaleSwitcher } from "@/components/shared/public-locale-switcher";
import { Button } from "@/components/ui/button";
import {
  getTrialApplicationStatusCounts,
  listTrialApplications,
} from "@/features/trial/queries";
import { TRIAL_ROLE_LABELS, type TrialRoleOption } from "@/features/trial/data";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { resolveUiLocale } from "@/lib/i18n/config";
import { isHelmReservedWorkspace } from "@/lib/workspace-identity";

export async function generateMetadata(): Promise<Metadata> {
  const locale = resolveUiLocale((await cookies()).get("helm-ui-locale")?.value);
  const english = locale === "en-US";

  return {
    title: english ? "Trial review queue | Helm" : "试用申请复核 | Helm 掌舵者",
  };
}

const STATUS_COPY: Record<TrialApplicationStatus, { zh: string; en: string }> = {
  PENDING: { zh: "待复核", en: "Pending" },
  CONTACTED: { zh: "已联系", en: "Contacted" },
  APPROVED: { zh: "已通过", en: "Approved" },
  REJECTED: { zh: "已拒绝", en: "Rejected" },
};

const STATUS_TONE: Record<TrialApplicationStatus, string> = {
  PENDING:
    "border border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]",
  CONTACTED:
    "border border-[color:var(--border)] bg-[color:var(--status-info-bg)] text-[color:var(--status-info-text)]",
  APPROVED:
    "border border-[color:var(--border)] bg-[color:var(--status-success-bg)] text-[color:var(--status-success-text)]",
  REJECTED:
    "border border-[color:var(--border)] bg-[color:var(--status-danger-bg)] text-[color:var(--status-danger-text)]",
};

function formatRoleLabel(role: string, english: boolean) {
  const known = TRIAL_ROLE_LABELS[role as TrialRoleOption];
  if (!known) return role;
  return english ? known.en : known.zh;
}

function formatDate(value: Date, english: boolean) {
  return value.toLocaleString(english ? "en-US" : "zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function TrialReviewQueuePage() {
  const session = await getCurrentWorkspaceSession();

  if (!isHelmReservedWorkspace(session.workspace)) {
    redirect("/dashboard");
  }

  const locale = resolveUiLocale((await cookies()).get("helm-ui-locale")?.value);
  const english = locale === "en-US";

  const [items, counts] = await Promise.all([
    listTrialApplications({ limit: 200 }),
    getTrialApplicationStatusCounts(),
  ]);

  return (
    <div className="surface-grid min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <header className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{english ? "Helm" : "Helm 掌舵者"}</p>
          <p className="max-w-[28rem] text-xs text-[color:var(--muted-foreground)]">
            {english ? "Trial review queue" : "试用申请复核队列"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <PublicLocaleSwitcher locale={locale} variant="compact" />
          <ThemeToggle locale={locale} />
          <Button asChild variant="ghost">
            <Link href="/dashboard" data-testid="admin-trials-back-dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {english ? "Back to workspace" : "返回工作区"}
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1280px] px-6 pb-20 lg:px-10">
        <EnterpriseSurfaceShell
          eyebrow={english ? "Internal · pilot intake review" : "内部 · 试点申请人工复核"}
          title={english ? "Pilot applications waiting on you" : "等你处理的试点申请"}
          subtitle={
            english
              ? "Every public application lands here. Decide within 1 business day to keep the public promise. The applicant is never auto-notified — outreach stays manual."
              : "每份公开申请都落在这里。1 个工作日内拍板，才能守住对外的承诺。申请人不会被自动通知——对外联系一律手动。"
          }
          shieldNote={
            english
              ? "Decisions here are audit trail only. Reach out to applicants by hand — Helm never auto-emails from this page."
              : "这里点的「通过 / 不合适」只是审计留痕。给申请人回信仍要手动发——Helm 不会从这页给任何人自动发邮件。"
          }
        >
        <section
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          data-testid="admin-trials-counts"
        >
          {(Object.keys(counts) as TrialApplicationStatus[]).map((statusKey) => (
            <div
              key={statusKey}
              className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-card)]"
            >
              <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                {english ? STATUS_COPY[statusKey].en : STATUS_COPY[statusKey].zh}
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">{counts[statusKey]}</p>
            </div>
          ))}
        </section>

        <section className="space-y-3" data-testid="admin-trials-list">
          <div className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-[color:var(--surface-subtle)] text-xs font-medium text-[color:var(--muted-foreground)]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">
                    {english ? "Applicant" : "申请人"}
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    {english ? "Organization" : "组织"}
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    {english ? "Role" : "角色"}
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    {english ? "Status" : "状态"}
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    {english ? "Submitted" : "提交时间"}
                  </th>
                </tr>
              </thead>
              <tbody className="text-[color:var(--foreground)]">
                {items.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-6 text-center text-sm text-[color:var(--muted)]"
                      data-testid="admin-trials-empty"
                    >
                      {english
                        ? "Inbox is empty. Nice."
                        : "队列是空的，挺好。"}
                    </td>
                  </tr>
                )}
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-t border-[color:var(--border)] transition hover:bg-[color:var(--surface-subtle)]"
                    data-testid={`admin-trials-row-${item.id}`}
                  >
                    <td className="px-4 py-3 align-top">
                      <Link
                        href={`/admin/trials/${item.id}`}
                        className="text-sm font-semibold text-[color:var(--accent)] underline-offset-4 hover:underline"
                      >
                        {item.email}
                      </Link>
                    </td>
                    <td className="px-4 py-3 align-top text-sm">{item.organizationName}</td>
                    <td className="px-4 py-3 align-top text-sm">
                      {formatRoleLabel(item.role, english)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_TONE[item.status]}`}
                      >
                        {english ? STATUS_COPY[item.status].en : STATUS_COPY[item.status].zh}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-[color:var(--muted)]">
                      {formatDate(item.createdAt, english)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        </EnterpriseSurfaceShell>
      </main>
    </div>
  );
}
