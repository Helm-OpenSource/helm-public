import type { WorkspaceRole } from "@prisma/client";
import { filterDeploymentMemberships } from "@/lib/auth/deployment-entry";
import type { UiLocale } from "@/lib/i18n/config";
import { getLocalizedRoleLabels } from "@/lib/i18n/labels";

export type WorkspaceChoice = {
  workspaceId: string;
  workspaceName: string;
  roleLabel: string;
  status: "ACTIVE" | "INVITED";
};

export function getWorkspaceChoices(
  memberships: Array<{
    workspaceId: string;
    role: WorkspaceRole;
    status: string;
    workspace: { name: string; slug: string; systemKey?: string | null };
  }>,
  locale: UiLocale,
): WorkspaceChoice[] {
  const roleLabels = getLocalizedRoleLabels(locale);
  return filterDeploymentMemberships(memberships)
    .filter(({ status }) => status === "ACTIVE" || status === "INVITED")
    .sort((left, right) => {
      if (left.status !== right.status) return left.status === "ACTIVE" ? -1 : 1;
      return left.workspace.name.localeCompare(right.workspace.name, locale);
    })
    .map((membership) => ({
      workspaceId: membership.workspaceId,
      workspaceName: membership.workspace.name,
      roleLabel: roleLabels[membership.role],
      status: membership.status === "ACTIVE" ? "ACTIVE" : "INVITED",
    }));
}
