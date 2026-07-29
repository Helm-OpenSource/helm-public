import { WorkspaceRole } from "@prisma/client";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Stage1OwnerLoopConsole } from "@/features/dashboard/stage1-owner-loop-console";
import { getWorkspaceStage1OwnerLoopReadout } from "@/features/dashboard/stage1-owner-loop-query";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { isEnglishLocale } from "@/lib/i18n/config";
import { resolveWorkspaceUiLocaleForRequest } from "@/lib/i18n/request-locale.server";

export default async function CaioPage() {
  const session = await getCurrentWorkspaceSession();

  // Navigation is presentation metadata, never authorization. The dedicated
  // route independently preserves the existing OWNER-only read boundary.
  if (session.membership.role !== WorkspaceRole.OWNER) {
    notFound();
  }

  const locale = await resolveWorkspaceUiLocaleForRequest({
    workspaceDefaultLocale: session.workspace.defaultLocale,
  });
  const english = isEnglishLocale(locale);
  const readout = await getWorkspaceStage1OwnerLoopReadout({
    workspaceId: session.workspace.id,
    membershipRole: session.membership.role,
  });

  return (
    <div
      className="space-y-6"
      data-source-page="/caio"
      data-caio-owner-surface="true"
    >
      <PageHeader
        english={english}
        eyebrow={english ? "CEO-direct AI" : "CEO 直属 AI"}
        title={
          english
            ? "Helm CAIO — the AI executive reporting to the CEO"
            : "Helm CAIO｜一号位 AI 经营中枢"
        }
        description={
          english
            ? "CEO-owned, read-only and review-first. This surface does not execute, send, or create commitments."
            : "由一把手负责的独立 AI 经营监督面。当前只读、复核优先，不执行、不外发、不产生承诺。"
        }
      />

      {readout ? (
        <Stage1OwnerLoopConsole readout={readout} english={english} />
      ) : (
        <section
          aria-labelledby="caio-empty-title"
          className="border-y border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-5 py-6"
          data-caio-empty-state="true"
        >
          <h2
            id="caio-empty-title"
            className="text-base font-semibold text-[color:var(--foreground)]"
          >
            {english
              ? "No governed CAIO operating readout yet"
              : "尚无受治理的 CAIO 经营读数"}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--muted-foreground)]">
            {english
              ? "The navigation entry is available, but no valid owner-loop evidence can be projected. No runtime or production state is inferred."
              : "导航入口已就位，但当前没有可投影的有效一把手闭环证据；系统不会据此推断运行态或生产状态。"}
          </p>
        </section>
      )}
    </div>
  );
}
