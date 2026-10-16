import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type ThreadRow = {
  id: string;
  workspaceId: string;
  opportunityId: string | null;
  source: string;
  subject: string;
  participants: string | null;
  createdAt: Date;
};

type MessageRow = {
  id: string;
  threadId: string;
  sender: string;
  senderEmail: string;
  body: string;
  snippet: string | null;
  isInbound: boolean;
  sentAt: Date;
};

const store: { threads: ThreadRow[]; messages: MessageRow[] } = {
  threads: [],
  messages: [],
};

type Where = Record<string, unknown>;

function matches(row: Record<string, unknown>, where: Where = {}): boolean {
  return Object.entries(where).every(([key, condition]) => {
    const value = row[key];
    if (condition && typeof condition === "object" && !(condition instanceof Date)) {
      const clause = condition as { in?: unknown[]; not?: unknown };
      if ("in" in clause) return (clause.in ?? []).includes(value);
      if ("not" in clause) return clause.not === null ? value !== null : value !== clause.not;
    }
    return value === condition;
  });
}

function pick<T extends Record<string, unknown>>(row: T, select: Record<string, unknown>) {
  return Object.fromEntries(
    Object.keys(select)
      .filter((key) => select[key] === true)
      .map((key) => [key, row[key]]),
  );
}

function newestFirst(left: MessageRow, right: MessageRow) {
  const delta = right.sentAt.getTime() - left.sentAt.getTime();
  return delta !== 0 ? delta : right.id.localeCompare(left.id);
}

// Minimal Prisma stand-in: only the calls email-context.ts makes, with the
// same ordering / take / cursor semantics.
const fakeDb = {
  emailThread: {
    findMany: vi.fn(async ({ where, select }: { where: Where; select: Record<string, unknown> }) =>
      store.threads
        .filter((thread) => matches(thread, where))
        .map((thread) => {
          const base = pick(thread, select);
          const nested = select.messages as
            | { select: Record<string, unknown>; take: number }
            | undefined;
          if (!nested) return base;
          return {
            ...base,
            messages: store.messages
              .filter((message) => message.threadId === thread.id)
              .sort(newestFirst)
              .slice(0, nested.take)
              .map((message) => pick(message, nested.select)),
          };
        }),
    ),
    findFirst: vi.fn(async ({ where, select }: { where: Where; select: Record<string, unknown> }) => {
      const thread = store.threads.find((row) => matches(row, where));
      return thread ? pick(thread, select) : null;
    }),
  },
  emailMessage: {
    groupBy: vi.fn(async ({ where }: { where: Where }) => {
      const groups = new Map<string, MessageRow[]>();
      for (const message of store.messages.filter((row) => matches(row, where))) {
        const key = `${message.threadId}|${message.isInbound}`;
        groups.set(key, [...(groups.get(key) ?? []), message]);
      }
      return [...groups.values()].map((rows) => {
        const times = rows.map((row) => row.sentAt.getTime());
        return {
          threadId: rows[0].threadId,
          isInbound: rows[0].isInbound,
          _count: { _all: rows.length },
          _min: { sentAt: new Date(Math.min(...times)) },
          _max: { sentAt: new Date(Math.max(...times)) },
        };
      });
    }),
    findFirst: vi.fn(async ({ where, select }: { where: Where; select: Record<string, unknown> }) => {
      const message = store.messages.find((row) => matches(row, where));
      return message ? pick(message, select) : null;
    }),
    findMany: vi.fn(
      async ({
        where,
        cursor,
        skip = 0,
        take,
        select,
      }: {
        where: Where;
        cursor?: { id: string };
        skip?: number;
        take: number;
        select: Record<string, unknown>;
      }) => {
        const ordered = store.messages.filter((row) => matches(row, where)).sort(newestFirst);
        const start = cursor ? ordered.findIndex((row) => row.id === cursor.id) : 0;
        return ordered.slice(start + skip, start + skip + take).map((row) => pick(row, select));
      },
    ),
  },
};

vi.mock("@/lib/db", () => ({ db: fakeDb }));

const {
  OPPORTUNITY_MESSAGE_PAGE_SIZE,
  loadEarlierOpportunityThreadMessages,
  loadOpportunityEmailContext,
} = await import("@/features/opportunities/email-context");
const {
  buildOriginalDemandThreads,
  getReplyStatus,
  resolveReplyTarget,
  selectOriginalDemandText,
} = await import("@/features/opportunities/customer-first");
const { OpportunityOriginalDemand } = await import(
  "@/features/opportunities/opportunity-original-demand"
);

const WORKSPACE = "ws_1";
const OPPORTUNITY = "opp_1";
const base = new Date("2026-09-01T00:00:00Z").getTime();
const at = (minutes: number) => new Date(base + minutes * 60_000);

function addThread(id: string, createdMinute: number, overrides: Partial<ThreadRow> = {}) {
  store.threads.push({
    id,
    workspaceId: WORKSPACE,
    opportunityId: OPPORTUNITY,
    source: "IMPORT",
    subject: `Subject ${id}`,
    participants: JSON.stringify(["alex@example.com", "inbox@example.com"]),
    createdAt: at(createdMinute),
    ...overrides,
  });
}

function addMessage(threadId: string, index: number, minute: number, isInbound: boolean, body?: string) {
  store.messages.push({
    id: `${threadId}_m${String(index).padStart(3, "0")}`,
    threadId,
    sender: isInbound ? "Alex Doe" : "Support",
    senderEmail: isInbound ? "alex@example.com" : "support@example.com",
    body: body ?? `${isInbound ? "Customer" : "Reply"} message ${index}`,
    snippet: null,
    isInbound,
    sentAt: at(minute),
  });
}

/** 50 alternating messages, then a 51st from `lastIsInbound`. */
function seedLongThread(lastIsInbound: boolean) {
  addThread("thread_long", 0);
  for (let index = 1; index <= 50; index += 1) {
    addMessage("thread_long", index, index, index % 2 === 1);
  }
  addMessage(
    "thread_long",
    51,
    51,
    lastIsInbound,
    lastIsInbound ? "Newest customer question" : "Our newest reply",
  );
}

async function loadView() {
  const context = (await loadOpportunityEmailContext(WORKSPACE, [OPPORTUNITY])).get(OPPORTUNITY)!;
  const opportunity = {
    nextStepSummary: null,
    description: null,
    contacts: [],
    emailThreads: context.emailThreads,
    emailActivity: context.emailActivity,
  };
  const replyStatus = getReplyStatus(context.emailActivity);
  const html = renderToStaticMarkup(
    createElement(OpportunityOriginalDemand, {
      english: false,
      threads: buildOriginalDemandThreads(opportunity),
      threadTotal: context.emailThreadCount,
      fallback: selectOriginalDemandText(opportunity),
      replyStatus,
      onLoadEarlierMessages: () => undefined,
      onLoadMoreThreads: () => undefined,
    }),
  );
  return { context, opportunity, replyStatus, html };
}

beforeEach(() => {
  store.threads = [];
  store.messages = [];
});

describe("loadOpportunityEmailContext", () => {
  it("shows the customer's 51st (newest) message and marks the thread awaiting reply", async () => {
    seedLongThread(true);
    const { context, replyStatus, html } = await loadView();

    const messages = context.emailThreads[0].messages;
    expect(messages).toHaveLength(OPPORTUNITY_MESSAGE_PAGE_SIZE);
    expect(messages.at(-1)?.body).toBe("Newest customer question");
    expect(messages[0].id).toBe("thread_long_m002");
    expect(context.emailThreads[0].messageCount).toBe(51);
    expect(replyStatus).toBe("awaiting");
    expect(html).toContain("Newest customer question");
    expect(html).toContain("待回复");
    expect(html).not.toContain("已回复");
  });

  it("shows our 51st (newest) reply and marks the thread replied", async () => {
    seedLongThread(false);
    const { replyStatus, html } = await loadView();

    expect(replyStatus).toBe("replied");
    expect(html).toContain("Our newest reply");
    expect(html).toContain("已回复");
    expect(html).not.toContain("待回复");
  });

  it("shows the truncation marker with the real total and the loaded count", async () => {
    seedLongThread(true);
    const { html } = await loadView();

    expect(html).toContain("已截断，共 51 封，显示最近 50 封");
    expect(html).toContain("加载更早");
  });

  it("surfaces the 11th thread when it holds the newest customer message", async () => {
    for (let index = 1; index <= 11; index += 1) {
      const id = `thread_${String(index).padStart(2, "0")}`;
      addThread(id, index);
      addMessage(id, 1, index, true, `Customer mail in ${id}`);
      addMessage(id, 2, index + 0.5, false, `Reply in ${id}`);
    }
    addMessage("thread_11", 3, 500, true, "Newest customer mail");

    const { context, opportunity, replyStatus, html } = await loadView();

    expect(context.emailThreadCount).toBe(11);
    expect(context.emailThreads).toHaveLength(10);
    expect(context.emailThreads[0].id).toBe("thread_11");
    expect(context.emailThreads.map((thread) => thread.id)).not.toContain("thread_01");
    expect(context.emailActivity.latestInboundThreadId).toBe("thread_11");
    expect(resolveReplyTarget(opportunity)).toEqual({
      kind: "thread",
      threadId: "thread_11",
      href: "/inbox/thread_11",
    });
    expect(replyStatus).toBe("awaiting");
    expect(html).toContain("Newest customer mail");
    expect(html).toContain("共 11 个邮件线程，显示最近活跃的 10 个");
    expect(html).toContain("加载更早的线程");
  });

  it("ranks by latest activity, not creation time", async () => {
    for (let index = 1; index <= 11; index += 1) {
      const id = `thread_${String(index).padStart(2, "0")}`;
      addThread(id, index);
      addMessage(id, 1, index, true);
    }
    addMessage("thread_01", 2, 900, true, "Oldest thread, newest mail");

    const { context } = await loadView();

    expect(context.emailThreads[0].id).toBe("thread_01");
    expect(context.emailThreads.map((thread) => thread.id)).not.toContain("thread_02");
    expect(context.emailActivity.latestInboundThreadId).toBe("thread_01");
  });

  it("pages the next threads in the same activity order", async () => {
    for (let index = 1; index <= 11; index += 1) {
      const id = `thread_${String(index).padStart(2, "0")}`;
      addThread(id, index);
      addMessage(id, 1, index, true);
    }

    const page = (await loadOpportunityEmailContext(WORKSPACE, [OPPORTUNITY], { threadOffset: 10 })).get(
      OPPORTUNITY,
    )!;

    expect(page.emailThreads.map((thread) => thread.id)).toEqual(["thread_01"]);
    expect(page.emailThreadCount).toBe(11);
  });

  it("never reads personal GMAIL threads or other workspaces", async () => {
    addThread("thread_gmail", 0, { source: "GMAIL" });
    addMessage("thread_gmail", 1, 1, true, "Private mailbox content");
    addThread("thread_other_ws", 0, { workspaceId: "ws_2" });
    addMessage("thread_other_ws", 1, 1, true, "Other workspace");

    const contexts = await loadOpportunityEmailContext(WORKSPACE, [OPPORTUNITY]);

    expect(contexts.get(OPPORTUNITY)).toBeUndefined();
  });
});

describe("loadEarlierOpportunityThreadMessages", () => {
  it("returns the page before the oldest loaded message, chronological", async () => {
    seedLongThread(true);

    const older = await loadEarlierOpportunityThreadMessages(WORKSPACE, {
      threadId: "thread_long",
      beforeMessageId: "thread_long_m002",
    });

    expect(older?.map((message) => message.id)).toEqual(["thread_long_m001"]);
  });

  it("refuses threads outside the visible set", async () => {
    addThread("thread_gmail", 0, { source: "GMAIL" });
    addMessage("thread_gmail", 1, 1, true);
    addMessage("thread_gmail", 2, 2, true);

    await expect(
      loadEarlierOpportunityThreadMessages(WORKSPACE, {
        threadId: "thread_gmail",
        beforeMessageId: "thread_gmail_m002",
      }),
    ).resolves.toBeNull();
    await expect(
      loadEarlierOpportunityThreadMessages("ws_2", {
        threadId: "thread_long",
        beforeMessageId: "thread_long_m002",
      }),
    ).resolves.toBeNull();
  });
});
