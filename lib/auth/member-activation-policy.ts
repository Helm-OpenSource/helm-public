import { createHash } from "node:crypto";

type MembershipScope = { id: string; userId: string; workspaceId: string; status: string };
export function assertActivationTarget(target: MembershipScope | null, passwordHash: string | null, memberships: MembershipScope[], workspaceId: string) {
  if (!target || target.workspaceId !== workspaceId || target.status !== "INVITED" || passwordHash ||
    memberships.some(m => m.status !== "INACTIVE" && (m.id !== target.id || m.workspaceId !== workspaceId || m.userId !== target.userId))) {
    throw new Error("Member activation unavailable");
  }
}
export function assertActivationIssuer(membership: { role: string; status: string; workspaceId: string } | null, provider: string | null, workspaceStatus: string | undefined, workspaceId: string) {
  if (!membership || membership.workspaceId !== workspaceId || membership.status !== "ACTIVE" || !["OWNER", "ADMIN"].includes(membership.role) || provider !== "PASSWORD" || workspaceStatus !== "ACTIVE") throw new Error("Member activation unavailable");
}
export function activationTokenDigest(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token) || Buffer.from(token, "base64url").length !== 32 || Buffer.from(token, "base64url").toString("base64url") !== token) throw new Error("Member activation unavailable");
  return createHash("sha256").update(token).digest("hex");
}
export function requireMemberActivationEnabled() {
  if (process.env.HELM_AUTH_MEMBER_ACTIVATION_ENABLED !== "true") throw new Error("Member activation unavailable");
}
