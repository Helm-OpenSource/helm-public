import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { WorkspaceSelectorPanel } from "@/features/auth/workspace-selector-panel";
import { getCurrentUser } from "@/lib/auth/session";
import {
  resolveDeploymentPostLoginPath,
} from "@/lib/auth/deployment-entry";
import { resolvePostLoginRedirectPath } from "@/lib/auth/first-login-identity-completion";
import { resolveUiLocale } from "@/lib/i18n/config";
import { getWorkspaceChoices } from "@/lib/auth/workspace-choices";

export default async function LoginWorkspaceSelectionPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const locale = resolveUiLocale((await cookies()).get("helm-ui-locale")?.value);
  const choices = getWorkspaceChoices(user.memberships, locale);
  const memberships = user.memberships.filter((membership) =>
    choices.some((choice) => choice.workspaceId === membership.workspaceId),
  );

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
          options={choices}
        />
      </div>
    </div>
  );
}
