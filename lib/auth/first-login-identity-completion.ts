import { WorkspaceRole, type MembershipStatus, type Workspace } from "@prisma/client";
import { normalizeEmailAddress, normalizePhoneNumber } from "@/lib/auth/formal-auth";
import { normalizeWorkspaceUiConfig } from "@/lib/workspace-ops";

type UserIdentitySnapshot = {
  email: string;
  phone: string | null;
  passwordHash: string | null;
  lastLoginAt: Date | null;
};

type MembershipSnapshot = {
  role: WorkspaceRole;
  status: MembershipStatus;
  workspace: Pick<
    Workspace,
    | "profileType"
    | "defaultLocale"
    | "pilotMode"
    | "captureConsentRequired"
    | "dataRetentionDays"
    | "featureFlagsJson"
    | "configuration"
  >;
};

export const FIRST_LOGIN_IDENTITY_SETUP_PATH = "/getting-started?mode=identity-completion";

export function hasMissingIdentityFields(user: Pick<UserIdentitySnapshot, "email" | "phone">) {
  const normalizedEmail = normalizeEmailAddress(user.email ?? "");
  const normalizedPhone = normalizePhoneNumber(user.phone ?? "");
  return !normalizedEmail || !normalizedPhone;
}

export function shouldRequireFirstLoginIdentityCompletion(user: UserIdentitySnapshot) {
  const firstLogin = user.lastLoginAt === null;
  if (!firstLogin) {
    return false;
  }
  return !user.passwordHash || hasMissingIdentityFields(user);
}

export function resolvePostLoginRedirectPath(membership: MembershipSnapshot) {
  const demoMode = Boolean(normalizeWorkspaceUiConfig(membership.workspace).demoMode);
  return !demoMode &&
    membership.role === WorkspaceRole.OWNER &&
    !membership.workspace.profileType
    ? "/setup"
    : "/dashboard";
}
