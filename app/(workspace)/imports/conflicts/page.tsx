import {
  canResolveWorkspaceImportConflicts,
  getImportConflictResolutionDeniedMessage,
} from "@/lib/auth/import-governance";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { ImportConflictsClient } from "@/features/imports/import-conflicts-client";
import { getImportConflicts } from "@/features/imports/queries";

export default async function ImportConflictsPage() {
  const session = await getCurrentWorkspaceSession();
  const workspace = session.workspace;
  const conflicts = await getImportConflicts(workspace.id);

  return (
    <ImportConflictsClient
      conflicts={conflicts}
      canResolveConflicts={canResolveWorkspaceImportConflicts(session.membership.role)}
      conflictResolutionDeniedMessage={getImportConflictResolutionDeniedMessage(
        workspace.defaultLocale === "en-US",
      )}
    />
  );
}
