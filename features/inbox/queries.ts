import { type Prisma, RecordSource } from "@prisma/client";
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
