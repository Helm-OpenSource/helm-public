import { createHash } from "node:crypto";
import { MemberActivationError } from "./member-activation-error";

type MembershipScope = { id: string; userId: string; workspaceId: string; status: string };
export function assertActivationTarget(target: MembershipScope | null, passwordHash: string | null, memberships: MembershipScope[], workspaceId: string) {
  // Same predicate as before, split only to name the failing clause; every clause is side-effect free.
  if (!target || target.workspaceId !== workspaceId || target.status !== "INVITED") throw new MemberActivationError("target_membership_invalid");
  if (passwordHash) throw new MemberActivationError("target_already_activated");
  if (memberships.some(m => m.status !== "INACTIVE" && (m.id !== target.id || m.workspaceId !== workspaceId || m.userId !== target.userId))) throw new MemberActivationError("target_membership_invalid");
}
export function assertActivationIssuer(membership: { role: string; status: string; workspaceId: string } | null, provider: string | null, workspaceStatus: string | undefined, workspaceId: string) {
  if (!membership || membership.workspaceId !== workspaceId || membership.status !== "ACTIVE" || !["OWNER", "ADMIN"].includes(membership.role) || provider !== "PASSWORD" || workspaceStatus !== "ACTIVE") throw new MemberActivationError("issuer_membership_invalid");
}
export function activationTokenDigest(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token) || Buffer.from(token, "base64url").length !== 32 || Buffer.from(token, "base64url").toString("base64url") !== token) throw new MemberActivationError("token_invalid");
  return createHash("sha256").update(token).digest("hex");
}
export function requireMemberActivationEnabled() {
  if (process.env.HELM_AUTH_MEMBER_ACTIVATION_ENABLED !== "true") throw new MemberActivationError("activation_disabled");
}
