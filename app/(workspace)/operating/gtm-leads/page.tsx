import { notFound } from "next/navigation";
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
      notFound();
    }
    throw error;
  }

  return <GtmLeadPipelinePage data={data} english={english} />;
}
