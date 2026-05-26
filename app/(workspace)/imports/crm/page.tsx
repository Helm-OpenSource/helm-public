import {
  canManageWorkspaceConnectors,
  canManageWorkspaceImports,
  canResolveWorkspaceImportConflicts,
  getConnectorManagementDeniedMessage,
  getImportConflictResolutionDeniedMessage,
  getImportManagementDeniedMessage,
} from "@/lib/auth/import-governance";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { isHubSpotConfigured } from "@/lib/connectors/hubspot";
import { isSalesforceConfigured } from "@/lib/connectors/salesforce";
import { CrmImportClient } from "@/features/imports/crm-import-client";
import { getCrmImportData } from "@/features/imports/queries";

export default async function CrmImportsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getCurrentWorkspaceSession();
  const workspace = session.workspace;
  const english = workspace.defaultLocale === "en-US";
  const fallbackParams: Record<string, string | string[] | undefined> = {};
  const [data, params] = await Promise.all([
    getCrmImportData(workspace.id),
    searchParams ?? Promise.resolve(fallbackParams),
  ]);

  return (
    <CrmImportClient
      data={data}
      config={{
        hubspotReady: isHubSpotConfigured(),
        salesforceReady: isSalesforceConfigured(),
      }}
      capability={{
        canManageConnectors: canManageWorkspaceConnectors(session.membership.role),
        canManageImports: canManageWorkspaceImports(session.membership.role),
        canResolveImportConflicts: canResolveWorkspaceImportConflicts(
          session.membership.role,
        ),
        connectorManagementDeniedMessage: getConnectorManagementDeniedMessage(english),
        importManagementDeniedMessage: getImportManagementDeniedMessage(english),
        importConflictResolutionDeniedMessage:
          getImportConflictResolutionDeniedMessage(english),
      }}
      connectorState={{
        provider: typeof params.provider === "string" ? params.provider : undefined,
        status: typeof params.status === "string" ? params.status : undefined,
        message: typeof params.message === "string" ? params.message : undefined,
        sourceId: typeof params.sourceId === "string" ? params.sourceId : undefined,
      }}
    />
  );
}
