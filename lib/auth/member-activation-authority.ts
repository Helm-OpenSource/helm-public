import "server-only";
import type { Prisma } from "@prisma/client";
import { MemberActivationError } from "./member-activation-error";
export type MemberActivationAuthorityContext = Readonly<{
  phase: "issue" | "consume";
  issuerWorkspaceId: string; issuerUserId: string; issuerSessionId: string;
  targetWorkspaceId: string; targetMembershipId: string; targetUserId: string;
}>;
export type MemberActivationBinding = { bindingRef: string; bindingVersion: number };
export type MemberActivationAuthorizer = (tx: Prisma.TransactionClient, context: MemberActivationAuthorityContext) => Promise<MemberActivationBinding>;
const key = Symbol.for("helm.member-activation-authority");
const store = globalThis as typeof globalThis & { [key]?: MemberActivationAuthorizer };
/** Composition-root registration only; never populated by request input. */
export function registerMemberActivationAuthority(authorizer: MemberActivationAuthorizer) {
  if (typeof authorizer !== "function" || (store[key] && store[key] !== authorizer)) throw new Error("Member activation authority already registered");
  store[key] = authorizer;
}
/** Caller must pass its current transaction; a separate approval read is not sufficient.
 * Errors thrown by the registered authorizer propagate unchanged (their own `code` is preserved). */
export async function authorizeMemberActivation(tx: Prisma.TransactionClient, context: MemberActivationAuthorityContext): Promise<MemberActivationBinding> {
  const authorizer = store[key];
  if (!authorizer) throw new MemberActivationError("authority_unavailable");
  const result = await authorizer(tx, Object.freeze({ ...context }));
  if (!result || typeof result.bindingRef !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,190}$/.test(result.bindingRef) || !Number.isSafeInteger(result.bindingVersion) || result.bindingVersion < 1) throw new MemberActivationError("authority_result_invalid");
  return { bindingRef: result.bindingRef, bindingVersion: result.bindingVersion };
}
