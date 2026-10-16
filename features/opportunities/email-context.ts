import "server-only";

import { db } from "@/lib/db";
import { buildInboxThreadWhere } from "@/features/inbox/queries";

/**
 * Email context for the customer-first opportunities page.
 *
 * Reply state ("still waiting for us?") and first-contact time come from an
 * aggregate over every visible message, never from the truncated body slice.
 * Bodies are loaded newest-first (latest N per thread, latest-active threads
 * first) and returned in chronological order; older pages are fetched on demand.
 *
 * Visibility: same rule as the inbox for a viewer without a connected Gmail
 * account — personal GMAIL threads never show on this shared page.
 */

export const OPPORTUNITY_THREAD_PAGE_SIZE = 10;
export const OPPORTUNITY_MESSAGE_PAGE_SIZE = 50;

export const OPPORTUNITY_EMAIL_MESSAGE_SELECT = {
  id: true,
  sender: true,
  senderEmail: true,
  body: true,
  snippet: true,
  isInbound: true,
  sentAt: true,
} as const;

/** Newest first; `id` breaks ties so cursor pagination is deterministic. */
export const OPPORTUNITY_EMAIL_MESSAGE_ORDER = [
  { sentAt: "desc" as const },
  { id: "desc" as const },
];

export type OpportunityEmailMessage = {
  id: string;
  sender: string;
  senderEmail: string;
  body: string;
  snippet: string | null;
  isInbound: boolean;
  sentAt: Date;
};

export type OpportunityEmailThread = {
  id: string;
  subject: string;
  /** JSON array / delimited addresses; used only to name the receiving mailbox. */
  participants: string | null;
  source: string;
  createdAt: Date;
  /** Total messages in the thread (not just the loaded page). */
  messageCount: number;
  lastActivityAt: Date;
  /** Latest page of messages, chronological. */
  messages: OpportunityEmailMessage[];
};

export type OpportunityEmailActivity = {
  firstInboundAt: Date | null;
  latestInboundAt: Date | null;
  latestOutboundAt: Date | null;
  latestInboundThreadId: string | null;
};

export type OpportunityEmailContext = {
  emailThreads: OpportunityEmailThread[];
  /** Total visible threads linked to the opportunity. */
  emailThreadCount: number;
  emailActivity: OpportunityEmailActivity;
};

export type ThreadActivityRow = {
  threadId: string;
  isInbound: boolean;
  _count: { _all: number };
  _min: { sentAt: Date | null };
  _max: { sentAt: Date | null };
};

export type ThreadActivity = {
  messageCount: number;
  firstInboundAt: Date | null;
  latestInboundAt: Date | null;
  latestOutboundAt: Date | null;
};

export const EMPTY_OPPORTUNITY_EMAIL_CONTEXT: OpportunityEmailContext = {
  emailThreads: [],
  emailThreadCount: 0,
  emailActivity: {
    firstInboundAt: null,
    latestInboundAt: null,
    latestOutboundAt: null,
    latestInboundThreadId: null,
  },
};

function laterOf(left: Date | null, right: Date | null) {
  if (!left) return right;
  if (!right) return left;
  return right.getTime() > left.getTime() ? right : left;
}

function earlierOf(left: Date | null, right: Date | null) {
  if (!left) return right;
  if (!right) return left;
  return right.getTime() < left.getTime() ? right : left;
}

export function summarizeThreadActivity(rows: ThreadActivityRow[]) {
  const byThread = new Map<string, ThreadActivity>();
  for (const row of rows) {
    const current = byThread.get(row.threadId) ?? {
      messageCount: 0,
      firstInboundAt: null,
      latestInboundAt: null,
      latestOutboundAt: null,
    };
    current.messageCount += row._count._all;
    if (row.isInbound) {
      current.firstInboundAt = earlierOf(current.firstInboundAt, row._min.sentAt);
      current.latestInboundAt = laterOf(current.latestInboundAt, row._max.sentAt);
    } else {
      current.latestOutboundAt = laterOf(current.latestOutboundAt, row._max.sentAt);
    }
    byThread.set(row.threadId, current);
  }
  return byThread;
}

export function threadLastActivityAt(
  thread: { createdAt: Date },
  activity: ThreadActivity | undefined,
) {
  return (
    laterOf(activity?.latestInboundAt ?? null, activity?.latestOutboundAt ?? null) ??
    thread.createdAt
  );
}

/** Latest activity first; id breaks ties. */
export function rankThreadsByActivity<T extends { id: string; createdAt: Date }>(
  threads: T[],
  activity: Map<string, ThreadActivity>,
) {
  return [...threads].sort((left, right) => {
    const delta =
      threadLastActivityAt(right, activity.get(right.id)).getTime() -
      threadLastActivityAt(left, activity.get(left.id)).getTime();
    if (delta !== 0) return delta;
    return right.id.localeCompare(left.id);
  });
}

export function rollupOpportunityActivity(
  threadIds: string[],
  activity: Map<string, ThreadActivity>,
): OpportunityEmailActivity {
  let result = { ...EMPTY_OPPORTUNITY_EMAIL_CONTEXT.emailActivity };
  for (const threadId of threadIds) {
    const thread = activity.get(threadId);
    if (!thread) continue;
    const latestInboundAt = laterOf(result.latestInboundAt, thread.latestInboundAt);
    result = {
      firstInboundAt: earlierOf(result.firstInboundAt, thread.firstInboundAt),
      latestInboundAt,
      latestOutboundAt: laterOf(result.latestOutboundAt, thread.latestOutboundAt),
      latestInboundThreadId:
        thread.latestInboundAt && latestInboundAt === thread.latestInboundAt
          ? threadId
          : result.latestInboundThreadId,
    };
  }
  return result;
}

export async function loadOpportunityEmailContext(
  workspaceId: string,
  opportunityIds: string[],
  options: { threadOffset?: number } = {},
) {
  const contexts = new Map<string, OpportunityEmailContext>();
  if (!opportunityIds.length) return contexts;

  const threadRows = await db.emailThread.findMany({
    where: {
      ...buildInboxThreadWhere(workspaceId, null),
      opportunityId: { in: opportunityIds },
    },
    select: { id: true, opportunityId: true, createdAt: true },
  });
  if (!threadRows.length) return contexts;

  const activityRows = await db.emailMessage.groupBy({
    by: ["threadId", "isInbound"],
    where: { threadId: { in: threadRows.map((thread) => thread.id) } },
    _count: { _all: true },
    _min: { sentAt: true },
    _max: { sentAt: true },
  });
  const activity = summarizeThreadActivity(activityRows);

  const offset = Math.max(0, options.threadOffset ?? 0);
  const pages = new Map<string, { threadIds: string[]; page: string[] }>();
  for (const opportunityId of opportunityIds) {
    const threads = threadRows.filter((thread) => thread.opportunityId === opportunityId);
    if (!threads.length) continue;
    pages.set(opportunityId, {
      threadIds: threads.map((thread) => thread.id),
      page: rankThreadsByActivity(threads, activity)
        .slice(offset, offset + OPPORTUNITY_THREAD_PAGE_SIZE)
        .map((thread) => thread.id),
    });
  }

  const pageThreadIds = [...pages.values()].flatMap((entry) => entry.page);
  const details = pageThreadIds.length
    ? await db.emailThread.findMany({
        where: { id: { in: pageThreadIds } },
        select: {
          id: true,
          subject: true,
          participants: true,
          source: true,
          createdAt: true,
          messages: {
            select: OPPORTUNITY_EMAIL_MESSAGE_SELECT,
            orderBy: OPPORTUNITY_EMAIL_MESSAGE_ORDER,
            take: OPPORTUNITY_MESSAGE_PAGE_SIZE,
          },
        },
      })
    : [];
  const detailById = new Map(details.map((detail) => [detail.id, detail]));

  for (const [opportunityId, entry] of pages) {
    contexts.set(opportunityId, {
      emailThreadCount: entry.threadIds.length,
      emailActivity: rollupOpportunityActivity(entry.threadIds, activity),
      emailThreads: entry.page.flatMap((threadId) => {
        const detail = detailById.get(threadId);
        if (!detail) return [];
        const threadActivity = activity.get(threadId);
        return [
          {
            id: detail.id,
            subject: detail.subject,
            participants: detail.participants,
            source: detail.source,
            createdAt: detail.createdAt,
            messageCount: threadActivity?.messageCount ?? detail.messages.length,
            lastActivityAt: threadLastActivityAt(detail, threadActivity),
            messages: [...detail.messages].reverse(),
          },
        ];
      }),
    });
  }

  return contexts;
}

/** One older page of a visible thread, chronological. */
export async function loadEarlierOpportunityThreadMessages(
  workspaceId: string,
  input: { threadId: string; beforeMessageId: string },
) {
  const thread = await db.emailThread.findFirst({
    where: {
      ...buildInboxThreadWhere(workspaceId, null),
      id: input.threadId,
      opportunityId: { not: null },
    },
    select: { id: true },
  });
  if (!thread) return null;

  const anchor = await db.emailMessage.findFirst({
    where: { id: input.beforeMessageId, threadId: thread.id },
    select: { id: true },
  });
  if (!anchor) return null;

  const rows = await db.emailMessage.findMany({
    where: { threadId: thread.id },
    cursor: { id: anchor.id },
    skip: 1,
    orderBy: OPPORTUNITY_EMAIL_MESSAGE_ORDER,
    take: OPPORTUNITY_MESSAGE_PAGE_SIZE,
    select: OPPORTUNITY_EMAIL_MESSAGE_SELECT,
  });
  return rows.reverse();
}
