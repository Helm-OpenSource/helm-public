import { ImportsClient } from "@/features/imports/imports-client";
import { getCrmImportData } from "@/features/imports/queries";
import {
  canManageWorkspaceImports,
  getImportManagementDeniedMessage,
} from "@/lib/auth/import-governance";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { getWorkspaceBusinessLoopGapReadout } from "@/lib/helm-v2/runtime-upgrade";
import { getImportConfig } from "@/lib/imports";
import { resolveImportsExtensions } from "@/lib/extensions/registry";

export default async function ImportsPage() {
  const session = await getCurrentWorkspaceSession();
  const workspace = session.workspace;
  const english = workspace.defaultLocale === "en-US";
  const canManageImports = canManageWorkspaceImports(session.membership.role);
  const importsExtensions = await resolveImportsExtensions({ workspace });
  const [crmData, businessLoopGapReadout] = await Promise.all([
    getCrmImportData(workspace.id),
    getWorkspaceBusinessLoopGapReadout(workspace.id),
  ]);

  const accountBindingSlot = importsExtensions.accountBinding
    ? importsExtensions.accountBinding.entryButton({ english })
    : null;

  return (
    <ImportsClient
      crmSummary={{
        sourceCount: crmData.sources.length,
        connectedCount: crmData.sources.filter((source) => source.status === "CONNECTED").length,
        openConflicts: crmData.openConflicts,
        latestJobId: crmData.jobs[0]?.id ?? null,
      }}
      capability={{
        canManageImports,
        importManagementDeniedMessage: getImportManagementDeniedMessage(english),
      }}
      accountBindingSlot={accountBindingSlot}
      businessLoopGapSummary={businessLoopGapReadout.businessLoopGapSummary}
      configs={{
        contacts: getImportConfig("contacts"),
        opportunities: getImportConfig("opportunities"),
        meetings: getImportConfig("meetings"),
      }}
    />
  );
}
