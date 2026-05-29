import Link from "next/link";
import {
  GtmLeadPipelinePage,
  type GtmLeadPipelineData,
} from "@/features/gtm-lead/gtm-lead-pipeline-page";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import {
  GtmLeadReservedOnlyError,
  countGtmLeadsByStage,
  listGtmLeadsForReservedWorkspace,
} from "@/lib/gtm-lead/queries";
import { isEnglishLocale } from "@/lib/i18n/config";
import { resolveWorkspaceUiLocaleForRequest } from "@/lib/i18n/request-locale.server";
import type { GtmLeadStage } from "@/lib/gtm-lead/types";

export default async function OperatingGtmLeadsPage() {
  const session = await getCurrentWorkspaceSession();
  const locale = await resolveWorkspaceUiLocaleForRequest({
    workspaceDefaultLocale: session.workspace.defaultLocale,
  });
  const english = isEnglishLocale(locale);

  let data: GtmLeadPipelineData;
  try {
    const [leads, stageCounts] = await Promise.all([
      listGtmLeadsForReservedWorkspace({
        workspace: session.workspace,
        workspaceId: session.workspace.id,
        take: 50,
      }),
      countGtmLeadsByStage({
        workspace: session.workspace,
        workspaceId: session.workspace.id,
      }),
    ]);
    data = {
      leads,
      stageCounts: stageCounts as Record<GtmLeadStage, number>,
      workspaceName: session.workspace.name,
    };
  } catch (error) {
    if (error instanceof GtmLeadReservedOnlyError) {
      return (
        <GtmLeadsUnavailable
          english={english}
          title={english ? "No growth leads in this workspace" : "这里没有增长线索"}
          detail={
            english
              ? "The current workspace has no growth-lead queue to show. Return to customer work and continue with active accounts."
              : "当前工作区没有可展示的增长线索队列。先回到客户推进，处理正在发生的客户事项。"
          }
        />
      );
    }
    throw error;
  }

  return <GtmLeadPipelinePage data={data} english={english} />;
}

function GtmLeadsUnavailable({
  english,
  title,
  detail,
}: {
  english: boolean;
  title: string;
  detail: string;
}) {
  return (
    <div className="workspace-surface-stack" data-source-page="/operating/gtm-leads">
      <section className="mx-auto max-w-2xl rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] px-6 py-6 text-center shadow-[0_18px_60px_-46px_rgba(15,23,42,0.45)]">
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--mode-link)]">
          {english ? "Growth leads" : "增长线索"}
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">
          {title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[color:var(--muted-foreground)]">
          {detail}
        </p>
        <Link
          href="/operating"
          className="mt-5 inline-flex items-center justify-center rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-[color:var(--accent-foreground)]"
        >
          {english ? "Back to customer work" : "回到客户推进"}
        </Link>
      </section>
    </div>
  );
}
