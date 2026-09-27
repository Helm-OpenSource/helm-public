"use server";
import { z } from "zod";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { getLoginLockStatus, recordFailedLogin, clearFailedLogins } from "@/lib/auth/login-rate-limit.service";
import { consumeMemberActivation, issueMemberActivation } from "@/lib/auth/member-activation.service";
const failure = { ok: false as const, error: "无法完成成员激活。请检查凭证或联系组织管理员重新发放。" };
export async function issueMemberActivationAction(input: { membershipId: string; password: string }) {
  const parsed = z.object({ membershipId: z.string().min(1).max(191), password: z.string().min(8).max(256) }).strict().safeParse(input);
  if (!parsed.success || process.env.HELM_AUTH_MEMBER_ACTIVATION_ENABLED !== "true") return failure;
  const session = await getCurrentWorkspaceSession();
  const limiter = `member-activation:${session.user.id}`;
  try {
    if ((await getLoginLockStatus(limiter)).locked) return failure;
    const result = await issueMemberActivation({ ...parsed.data, issuerUserId: session.user.id, issuerSessionId: session.authSessionId, workspaceId: session.workspace.id });
    await clearFailedLogins(limiter);
    return { ok: true as const, ...result };
  } catch { await recordFailedLogin(limiter); return failure; }
}
export async function consumeMemberActivationAction(input: { token: string; password: string }) {
  const parsed = z.object({ token: z.string().length(43), password: z.string().min(8).max(256) }).strict().safeParse(input);
  if (!parsed.success) return failure;
  try { return await consumeMemberActivation(parsed.data); }
  catch { return failure; }
}
