import { cookies } from "next/headers";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TrialApplicationStatus } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { PublicLocaleSwitcher } from "@/components/shared/public-locale-switcher";
import { Button } from "@/components/ui/button";
import { TrialDecisionForm } from "@/features/trial/decision-form.client";
import { getTrialApplicationById } from "@/features/trial/queries";
import { TRIAL_ROLE_LABELS, type TrialRoleOption } from "@/features/trial/data";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { resolveUiLocale } from "@/lib/i18n/config";
import { isHelmReservedWorkspace } from "@/lib/workspace-identity";

export async function generateMetadata(): Promise<Metadata> {
  const locale = resolveUiLocale((await cookies()).get("helm-ui-locale")?.value);
  const english = locale === "en-US";

  return {
    title: english ? "Trial application | Helm" : "试用申请详情 | Helm 掌舵者",
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

function formatDate(value: Date, english: boolean) {
  return value.toLocaleString(english ? "en-US" : "zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function TrialApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getCurrentWorkspaceSession();

  if (!isHelmReservedWorkspace(session.workspace)) {
    redirect("/dashboard");
  }

  const { id } = await params;
  const application = await getTrialApplicationById(id);

  if (!application) {
    notFound();
  }

  const locale = resolveUiLocale((await cookies()).get("helm-ui-locale")?.value);
  const english = locale === "en-US";
  const roleLabel = TRIAL_ROLE_LABELS[application.role as TrialRoleOption];

  return (
    <div className="surface-grid min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <header className="mx-auto flex w-full max-w-[960px] flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{english ? "Helm" : "Helm 掌舵者"}</p>
          <p className="max-w-[28rem] text-xs text-[color:var(--muted-foreground)]">
            {english ? "Trial application detail" : "试用申请详情"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <PublicLocaleSwitcher locale={locale} variant="compact" />
          <ThemeToggle locale={locale} />
          <Button asChild variant="ghost">
            <Link href="/admin/trials" data-testid="trial-detail-back">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {english ? "Back to queue" : "返回复核队列"}
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[960px] flex-col gap-8 px-6 pb-20 lg:px-10">
        <section className="space-y-3" data-testid="trial-detail-summary">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_TONE[application.status]}`}
          >
            {english ? STATUS_COPY[application.status].en : STATUS_COPY[application.status].zh}
          </span>
          <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            {application.email}
          </h1>
          <p className="text-sm text-[color:var(--muted)]">
            {english
              ? `${application.organizationName} · ${roleLabel ? roleLabel.en : application.role}`
              : `${application.organizationName} · ${roleLabel ? roleLabel.zh : application.role}`}
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div className="space-y-5 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-[var(--shadow-card)]">
            <div>
              <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                {english ? "Use case" : "使用场景"}
              </p>
              <p
                className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[color:var(--foreground)]"
                data-testid="trial-detail-use-case"
              >
                {application.useCase}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                  {english ? "Submitted at" : "提交时间"}
                </p>
                <p className="mt-1 text-sm">{formatDate(application.createdAt, english)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                  {english ? "Submitted locale" : "提交语言"}
                </p>
                <p className="mt-1 text-sm">{application.submittedLocale ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                  {english ? "Decided at" : "复核时间"}
                </p>
                <p className="mt-1 text-sm">
                  {application.decidedAt ? formatDate(application.decidedAt, english) : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                  {english ? "Decided by" : "复核人"}
                </p>
                <p className="mt-1 font-mono text-xs text-[color:var(--muted)]">
                  {application.decidedByUserId ?? "—"}
                </p>
              </div>
            </div>

            {application.decisionReason && (
              <div>
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                  {english ? "Last decision reason" : "上次复核理由"}
                </p>
                <p className="mt-2 whitespace-pre-wrap rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3 text-sm leading-6 text-[color:var(--muted)]">
                  {application.decisionReason}
                </p>
              </div>
            )}
          </div>

          <TrialDecisionForm
            applicationId={application.id}
            english={english}
            defaultStatus={application.status}
            defaultReason={application.decisionReason ?? null}
          />
        </section>
      </main>
    </div>
  );
}
