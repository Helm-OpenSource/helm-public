import { notFound } from "next/navigation";
import {
  canManageWorkspaceImports,
  getImportManagementDeniedMessage,
} from "@/lib/auth/import-governance";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { ImportJobDetailClient } from "@/features/imports/import-job-detail-client";
import { getImportJobDetail } from "@/features/imports/queries";

export default async function ImportJobPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentWorkspaceSession();
  const workspace = session.workspace;
  const { id } = await params;
  const job = await getImportJobDetail(workspace.id, id);

  if (!job) {
    notFound();
  }

  return (
    <ImportJobDetailClient
      job={job}
      canManageImports={canManageWorkspaceImports(session.membership.role)}
      importManagementDeniedMessage={getImportManagementDeniedMessage(
        workspace.defaultLocale === "en-US",
      )}
    />
  );
}
