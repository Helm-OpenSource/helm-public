import { ConnectorProvider } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentWorkspace, requireCurrentUser } from "@/lib/auth/session";
import { logPageViewEvent } from "@/lib/analytics";
import { getWorkspaceBusinessLoopGapReadout } from "@/lib/helm-v2/runtime-upgrade";
import { getInboxData } from "@/features/inbox/queries";
import { InboxClient } from "@/features/inbox/inbox-client";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{
    threadId?: string;
    status?: string;
    relationship?: string;
  }>;
}) {
  const { threadId, status, relationship } = await searchParams;
  const workspace = await getCurrentWorkspace();
  const user = await requireCurrentUser();
  const initialStatusFilter =
    status === "OPEN" ||
    status === "WAITING_US" ||
    status === "WAITING_THEM" ||
    status === "CLOSED"
      ? status
      : "all";
  const initialRelationshipFilter =
    relationship === "attached" ||
    relationship === "unattached" ||
    relationship === "upgrade"
      ? relationship
      : "all";
  const [opportunities, businessLoopGapReadout, connector] = await Promise.all([
    db.opportunity.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { updatedAt: "desc" },
    }),
    getWorkspaceBusinessLoopGapReadout(workspace.id),
    db.connector.findUnique({
      where: {
        workspaceId_userId_provider: {
          workspaceId: workspace.id,
          userId: user.id,
          provider: ConnectorProvider.GMAIL,
        },
      },
    }),
  ]);

  const inbox = await getInboxData(workspace.id, {
    selectedThreadId: threadId,
    viewerEmail: connector?.externalAccountEmail ?? null,
  });

  if (inbox.selected) {
    await logPageViewEvent({
      eventName: "inbox_thread_opened",
      sourcePage: `/inbox?threadId=${inbox.selected.id}`,
      targetType: "EmailThread",
      targetId: inbox.selected.id,
      metadata: {
        source: inbox.selected.source,
      },
    });
  }

  return (
    <InboxClient
      threads={inbox.threads}
      selected={inbox.selected}
      opportunities={opportunities}
      businessLoopGapSummary={businessLoopGapReadout.businessLoopGapSummary}
      connector={connector}
      initialStatusFilter={initialStatusFilter}
      initialRelationshipFilter={initialRelationshipFilter}
    />
  );
}
