import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { getAuditWriteFailureSummary } from "@/lib/audit";
import {
  buildPublicHealthReadout,
  type PublicHealthRow,
  type PublicHealthState,
} from "@/lib/production-health/public-health";
import { resolveUiLocale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export async function generateMetadata(): Promise<Metadata> {
  // Public /health should never fail due to per-request cookie parsing.
  // Keep metadata deterministic and locale-neutral to avoid runtime crashes in production.
  const english = false;

  return {
    title: english ? "Helm Health | Public Safe" : "Helm Health | 公开安全",
    description: english
      ? "Public-safe production health posture for Helm controlled pilots."
      : "Helm 受控试点的公开安全生产健康姿态。",
  };
}

function stateCopy(state: PublicHealthState, english: boolean): string {
  if (state === "healthy") {
    return english ? "Public-safe" : "可公开演示";
  }
  if (state === "degraded") {
    return english ? "Private review" : "内部复核";
  }
  return english ? "Workspace-scoped" : "工作区内查看";
}

function stateClassName(state: PublicHealthState): string {
  if (state === "healthy") {
    return "border-[color:var(--status-success-border)] bg-[color:var(--status-success-bg)] text-[color:var(--status-success-text)]";
  }
  if (state === "degraded") {
    return "border-[color:var(--status-warning-border)] bg-[color:var(--status-warning-bg)] text-[color:var(--status-warning-text)]";
  }
  return "border-[color:var(--border)] bg-[color:var(--surface-muted)] text-[color:var(--muted-foreground)]";
}

function HealthIcon({ row }: { readonly row: PublicHealthRow }) {
  if (row.state === "degraded") {
    return <AlertTriangle className="h-5 w-5 text-[color:var(--status-warning-text)]" />;
  }
  if (row.key === "workspace-boundary") {
    return <LockKeyhole className="h-5 w-5 text-[color:var(--accent)]" />;
  }
  if (row.key === "review-first-authority") {
    return <ClipboardCheck className="h-5 w-5 text-[color:var(--accent)]" />;
  }
  if (row.key === "audit-write-guard") {
    return <ShieldCheck className="h-5 w-5 text-[color:var(--accent)]" />;
  }
  return <CheckCircle2 className="h-5 w-5 text-[color:var(--status-success-text)]" />;
}

export default async function HealthPage() {
  // Keep /health robust: it must render even when request-scoped helpers throw.
  // Locale is best-effort only; never fail rendering because of it.
  const english = resolveUiLocale(undefined) === "en-US";

  const readout = (() => {
    try {
      return buildPublicHealthReadout({
        english,
        auditWriteFailureSummary: getAuditWriteFailureSummary(),
      });
    } catch (error) {
      process.stderr.write(
        `[helm.health_readout_failure] ${error instanceof Error ? error.message : String(error)}\n`,
      );
      return buildPublicHealthReadout({
        english,
        auditWriteFailureSummary: { totalCount: 1 },
      });
    }
  })();

  return (
    <main className="min-h-screen bg-[color:var(--background)] px-6 py-10 text-[color:var(--foreground)]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <section className="border-b border-[color:var(--border)] pb-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="max-w-3xl space-y-4">
              <p className="text-xs font-medium uppercase text-[color:var(--accent)]">
                {readout.eyebrow}
              </p>
              <h1 className="text-3xl font-semibold md:text-5xl">
                {readout.title}
              </h1>
              <p className="text-base leading-7 text-[color:var(--muted-foreground)]">
                {readout.summary}
              </p>
            </div>
            <div className="flex min-w-56 flex-col gap-3 border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
              <span className={`w-fit border px-3 py-1 text-xs font-semibold ${stateClassName(readout.overallState)}`}>
                {readout.overallLabel}
              </span>
              <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                {readout.overallDescription}
              </p>
            </div>
          </div>
        </section>

        <section className="border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-[color:var(--foreground)]">
                {readout.boundaryLabel}
              </p>
              <p className="max-w-4xl text-sm leading-6 text-[color:var(--muted-foreground)]">
                {readout.boundaryCopy}
              </p>
            </div>
            <Link
              className="inline-flex items-center justify-center border border-[color:var(--border)] px-4 py-2 text-sm font-medium hover:bg-[color:var(--surface-muted)]"
              href="/"
            >
              {english ? "Open Helm" : "打开 Helm"}
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {readout.rows.map((row) => (
            <article
              key={row.key}
              className="min-w-0 border border-[color:var(--border)] bg-[color:var(--surface)] p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <HealthIcon row={row} />
                  <h2 className="min-w-0 text-lg font-semibold">{row.title}</h2>
                </div>
                <span className={`shrink-0 border px-3 py-1 text-xs font-semibold ${stateClassName(row.state)}`}>
                  {stateCopy(row.state, english)}
                </span>
              </div>
              <p className="mt-5 text-sm leading-6 text-[color:var(--muted-foreground)]">
                {row.body}
              </p>
              <p className="mt-4 border-t border-[color:var(--border)] pt-4 text-sm leading-6">
                {row.nextStep}
              </p>
            </article>
          ))}
        </section>

        <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
          {readout.footerNote}
        </p>
      </div>
    </main>
  );
}
