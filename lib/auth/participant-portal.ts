import { createHash, randomBytes } from "node:crypto";
import { ParticipantPortalAccessStatus, RevenueBeneficiaryType } from "@prisma/client";
export {
  canManageParticipantPortal,
  getParticipantPortalManagementDeniedMessage,
} from "@/lib/auth/commercial-governance";
export {
  buildParticipantPortalInviteExpiresAt,
  getParticipantPortalInviteStateCopy,
  isParticipantPortalInviteExpired,
  isParticipantPortalInviteUsable,
  resolveParticipantPortalInviteState,
} from "@/lib/auth/participant-portal-invite-state";

export const PARTICIPANT_PORTAL_BENEFICIARY_TYPES = new Set<RevenueBeneficiaryType>([
  RevenueBeneficiaryType.WORKER_PUBLISHER,
  RevenueBeneficiaryType.SALES_REFERRAL,
  RevenueBeneficiaryType.CUSTOM_SERVICES,
]);

export function beneficiarySupportsParticipantPortal(beneficiaryType: RevenueBeneficiaryType) {
  return PARTICIPANT_PORTAL_BENEFICIARY_TYPES.has(beneficiaryType);
}

export function generateParticipantPortalToken() {
  return randomBytes(24).toString("base64url");
}

export function hashParticipantPortalToken(token: string) {
  return createHash("sha256").update(token.trim()).digest("hex");
}

export function resolvePreferredParticipantAccess<T extends { id: string; status: ParticipantPortalAccessStatus }>(
  accesses: T[],
  selectedAccessId: string | undefined,
) {
  if (selectedAccessId) {
    const matched = accesses.find((access) => access.id === selectedAccessId);
    if (matched) {
      return matched;
    }
  }

  return (
    accesses.find((access) => access.status === ParticipantPortalAccessStatus.ACTIVE) ??
    accesses.find((access) => access.status === ParticipantPortalAccessStatus.INVITED) ??
    accesses.find((access) => access.status === ParticipantPortalAccessStatus.SUSPENDED) ??
    accesses[0] ??
    null
  );
}
