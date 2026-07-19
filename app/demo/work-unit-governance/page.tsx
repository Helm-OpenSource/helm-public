import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { BoundaryBar } from "@/components/shared/boundary-bar";
import { Badge } from "@/components/ui/badge";
import { WorkUnitActivationHandoffPanel } from "@/features/work-unit-governance/work-unit-activation-handoff-panel";
import { WorkUnitMainlineLedgerPanel } from "@/features/work-unit-governance/work-unit-mainline-ledger-panel";
import { WorkUnitOwnerLifecyclePanel } from "@/features/work-unit-governance/work-unit-owner-lifecycle-panel";
import { WorkUnitReviewConsole } from "@/features/work-unit-governance/work-unit-review-console";
import { resolveUiLocale } from "@/lib/i18n/config";
import { buildActivationHandoffReadout } from "@/lib/work-unit-governance/activation-handoff";
import { buildPrivateMainlineLedgerReadout } from "@/lib/work-unit-governance/mainline-ledger";
import { buildOwnerLifecycleReadout } from "@/lib/work-unit-governance/owner-lifecycle";
import { buildWorkUnitRuntimeReadout } from "@/lib/work-unit-governance/runtime";
import {
  buildSyntheticActivationHandoffRequest,
  buildSyntheticOwnerLifecyclePolicy,
  buildSyntheticPromotedWorkUnit,
  buildSyntheticPrivateMainlineLedger,
  buildSyntheticWorkUnit,
  WORK_UNIT_SYNTHETIC_TIME,
} from "@/lib/work-unit-governance/synthetic-fixtures";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  const locale = resolveUiLocale((await cookies()).get("helm-ui-locale")?.value);
  const english = locale === "en-US";

  return {
    title: english
      ? "Helm Work Package Review | Public synthetic"
      : "Helm 工作包复核 | 公开合成证据",
    description: english
      ? "A public synthetic, read-only Work Unit review surface for owner-gated mainline governance."
      : "公开合成、只读的工作包复核界面，用于展示负责人门控的公司主线治理。",
  };
}

export default async function WorkUnitGovernanceDemoPage() {
  const locale = resolveUiLocale((await cookies()).get("helm-ui-locale")?.value);
  const english = locale === "en-US";
  const syntheticWorkUnit = buildSyntheticWorkUnit();
  const readout = buildWorkUnitRuntimeReadout(syntheticWorkUnit);
  const ownerReadout = buildOwnerLifecycleReadout({
    workUnit: syntheticWorkUnit,
    policy: buildSyntheticOwnerLifecyclePolicy(),
    receipts: [],
    now: WORK_UNIT_SYNTHETIC_TIME,
  });
  const ledgerReadout = buildPrivateMainlineLedgerReadout(
    buildSyntheticPrivateMainlineLedger(),
  );
  const promotedWorkUnit = buildSyntheticPromotedWorkUnit({
    activationScope: "production_runtime",
  });
  const activationReadout = buildActivationHandoffReadout({
    workUnit: promotedWorkUnit,
    request: buildSyntheticActivationHandoffRequest(promotedWorkUnit),
  });

  return (
    <div className="surface-grid min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <header className="mx-auto flex w-full max-w-[1180px] items-center justify-between gap-4 px-5 py-5 sm:px-6 lg:px-10">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Helm</p>
          <p className="text-xs text-[color:var(--muted-foreground)]">
            {english ? "Work package review" : "工作包复核"}
          </p>
        </div>
        <Link
          href="/demo"
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-medium hover:bg-[color:var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {english ? "Demo index" : "演示首页"}
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-5 pb-16 sm:px-6 lg:px-10">
        <section className="border-b border-[color:var(--border)] pb-6 pt-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant="info">PUBLIC SYNTHETIC</Badge>
            <Badge variant="neutral">READ ONLY</Badge>
            <Badge variant="approval">REVIEW FIRST</Badge>
          </div>
          <h1 className="mt-4 text-3xl font-semibold leading-tight md:text-4xl">
            {english ? "Helm Work Package Review" : "Helm 工作包复核"}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[color:var(--muted-foreground)] sm:text-base">
            {english
              ? "Inspect one synthetic work package from candidate review to owner-gated company mainline planning. The page reads committed synthetic data only and cannot approve, send, write back, or activate anything."
              : "查看一个合成工作包如何从候选复核进入负责人门控的公司主线计划。本页只读取仓库里的合成数据，不能批准、外发、写回或生效。"}
          </p>
        </section>

        <BoundaryBar
          english={english}
          copy={{
            observed: {
              zh: "一个公开合成工作包、检查回执、负责人动作计划、公司主线投影形状和生效交接包。",
              en: "One public synthetic work package, check receipt, owner action plan, company-mainline projection shape, and activation handoff.",
            },
            wontDo: {
              zh: "不保存真实批准、不写私有主线、不触发运行时、不连接客户系统。",
              en: "No real approval, private mainline write, runtime activation, or customer-system connection.",
            },
            decider: {
              zh: "负责人在私有平面确认；公开 Core 只提供契约、守卫、界面和动作计划。",
              en: "The owner decides in the private plane; public Core provides contracts, guards, UI, and action plans.",
            },
            negatives: [
              { zh: "无真实客户数据", en: "No real customer data" },
              { zh: "无自动批准", en: "No automatic approval" },
              { zh: "无自动外发", en: "No automatic send" },
              { zh: "无自动生效", en: "No automatic activation" },
            ],
          }}
        />

        <WorkUnitReviewConsole readout={readout} english={english} />

        <WorkUnitOwnerLifecyclePanel readout={ownerReadout} english={english} />

        <WorkUnitMainlineLedgerPanel readout={ledgerReadout} english={english} />

        <WorkUnitActivationHandoffPanel readout={activationReadout} english={english} />

        <footer className="flex items-start gap-2 border-t border-[color:var(--border)] py-5 text-xs leading-6 text-[color:var(--muted-foreground)]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--accent)]" aria-hidden />
          <p>
            {english
              ? "Synthetic proof only. This is not production readiness, customer approval, deployment authorization, or commercial commitment."
              : "仅为合成证明。它不是生产就绪、客户批准、部署授权或商业承诺。"}
          </p>
        </footer>
      </main>
    </div>
  );
}
