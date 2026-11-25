"use server";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { changeMemberPassword, passwordCommand, type PasswordCommand } from "@/lib/auth/password-management";

export async function changePasswordAction(input: PasswordCommand) {
  const parsed = passwordCommand.safeParse(input);
  if (!parsed.success) return { ok: false as const };
  const session = await getCurrentWorkspaceSession();
  try {
    return await changeMemberPassword({ userId: session.user.id, sessionId: session.authSessionId, workspaceId: session.workspace.id }, parsed.data);
  } catch {
    // No database error, identifier, password or hash is returned or logged.
    return { ok: false as const };
  }
}
