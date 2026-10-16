import { ConnectorProvider, type Prisma, RecordSource } from "@prisma/client";
import { db } from "@/lib/db";

export function buildInboxThreadWhere(
  workspaceId: string,
  viewerEmail?: string | null,
): Prisma.EmailThreadWhereInput {
  const normalizedEmail = viewerEmail?.trim().toLowerCase() ?? null;

  if (!normalizedEmail) {
    return {
      workspaceId,
      source: {
        not: RecordSource.GMAIL,
      },
    };
  }

  return {
    workspaceId,
    OR: [
      {
        source: {
          not: RecordSource.GMAIL,
        },
      },
      {
        source: RecordSource.GMAIL,
        participants: {
          contains: normalizedEmail,
        },
      },
    ],
  };
}

/**
 * The current user's connected mailbox address, which scopes which mailbox
 * threads they may read (see buildInboxThreadWhere). Inbox, contact and
 * company pages all read threads through this same rule.
 */
export async function getInboxViewerEmail(workspaceId: string, userId: string) {
  const connector = await db.connector.findUnique({
    where: {
      workspaceId_userId_provider: {
        workspaceId,
        userId,
        provider: ConnectorProvider.GMAIL,
      },
    },
    select: { externalAccountEmail: true },
  });
  return connector?.externalAccountEmail ?? null;
}

export async function getInboxData(
  workspaceId: string,
  options?: {
    selectedThreadId?: string;
    viewerEmail?: string | null;
  },
) {
  const selectedThreadId = options?.selectedThreadId;
  const threads = await db.emailThread.findMany({
    where: buildInboxThreadWhere(workspaceId, options?.viewerEmail),
    include: {
      contact: true,
      company: true,
      opportunity: true,
      messages: {
        orderBy: { sentAt: "asc" },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  const selected = threads.find((thread) => thread.id === selectedThreadId) ?? threads[0] ?? null;

  return {
    threads,
    selected,
  };
}
