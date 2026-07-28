import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { WorkspaceSelectorPanel } from "@/features/auth/workspace-selector-panel";
import { getCurrentUser } from "@/lib/auth/session";
import {
  filterDeploymentMemberships,
  resolveDeploymentPostLoginPath,
} from "@/lib/auth/deployment-entry";
import { resolvePostLoginRedirectPath } from "@/lib/auth/first-login-identity-completion";
import { resolveUiLocale } from "@/lib/i18n/config";
import { getLocalizedRoleLabels } from "@/lib/i18n/labels";

export default async function LoginWorkspaceSelectionPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const locale = resolveUiLocale((await cookies()).get("helm-ui-locale")?.value);
  const roleLabels = getLocalizedRoleLabels(locale);

  const memberships = filterDeploymentMemberships(
    user.memberships.filter((membership) => membership.status !== "INACTIVE"),
  )
    .sort((left, right) => {
      if (left.status !== right.status) {
        return left.status === "ACTIVE" ? -1 : 1;
      }
      return left.workspace.name.localeCompare(right.workspace.name);
    });

  if (memberships.length <= 1) {
    const membership = memberships[0];
    redirect(
      membership
        ? resolveDeploymentPostLoginPath(
            resolvePostLoginRedirectPath(membership),
          )
        : "/login",
    );
  }

  return (
    <div className="min-h-screen bg-[color:var(--background)] px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <WorkspaceSelectorPanel
          locale={locale}
          options={memberships.map((membership) => ({
            workspaceId: membership.workspaceId,
            workspaceName: membership.workspace.name,
            roleLabel: roleLabels[membership.role],
            status: membership.status === "ACTIVE" ? "ACTIVE" : "INVITED",
          }))}
        />
      </div>
    </div>
  );
}
