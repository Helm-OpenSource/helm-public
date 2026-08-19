import { getCurrentUser, getCurrentWorkspaceSession, getSessionId } from "@/lib/auth/session";
import { logEvent, type AnalyticsEventInput } from "@/lib/analytics";

// Session-bound analytics helpers: they resolve the acting user, workspace and
// session id from the current request. Importing this module pulls in
// `@/lib/auth/session` (and therefore `next/navigation`), so it is only usable
// from inside the Next.js request lifecycle — page loaders, server components
// and server actions. Callers that already hold a workspace id use
// `logEvent` from `@/lib/analytics` instead.

export async function logCurrentWorkspaceEvent(
  input: Omit<AnalyticsEventInput, "workspaceId" | "userId" | "sessionId">,
) {
  const user = await getCurrentUser();
  const session = user ? await getCurrentWorkspaceSession().catch(() => null) : null;
  const workspace = session?.workspace;

  if (!user || !workspace) {
    return;
  }

  await logEvent({
    workspaceId: workspace.id,
    userId: user.id,
    sessionId: await getSessionId(),
    ...input,
  });
}

export async function logPageViewEvent(input: {
  eventName: string;
  sourcePage: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await logCurrentWorkspaceEvent({
    eventName: input.eventName,
    eventCategory: "page_view",
    targetType: input.targetType ?? "Page",
    targetId: input.targetId ?? input.sourcePage,
    metadata: input.metadata,
    sourcePage: input.sourcePage,
  });
}
