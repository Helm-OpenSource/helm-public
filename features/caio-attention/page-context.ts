import { MembershipStatus, WorkspaceRole } from "@prisma/client";

import { canReviewWorkspaceGovernedActions } from "@/lib/auth/action-governance";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { isEnglishLocale } from "@/lib/i18n/config";
import { resolveWorkspaceUiLocaleForRequest } from "@/lib/i18n/request-locale.server";

import type { CaioAttentionViewer } from "./service-contract";

/**
 * Session snapshot handed to the loader. It is a hint, not an authorization: the loader and every command
 * re-read membership status and role inside their own transaction. Navigation never gates these pages; a
 * viewer with no readable case simply sees an empty list or a not-found page.
 */
export async function getCaioAttentionPageContext(): Promise<{ english: boolean; viewer: CaioAttentionViewer }> {
  const session = await getCurrentWorkspaceSession();
  const locale = await resolveWorkspaceUiLocaleForRequest({ workspaceDefaultLocale: session.workspace.defaultLocale });
  const role = session.membership.role;
  return {
    english: isEnglishLocale(locale),
    viewer: {
      workspaceId: session.workspace.id,
      actor: {
        userId: session.user.id,
        sameWorkspace: true,
        active: session.membership.status === MembershipStatus.ACTIVE,
        role: role === WorkspaceRole.OWNER ? "OWNER" : role === WorkspaceRole.ADMIN ? "ADMIN" : "OTHER",
        canReviewGovernedActions: canReviewWorkspaceGovernedActions(role),
      },
    },
  };
}
