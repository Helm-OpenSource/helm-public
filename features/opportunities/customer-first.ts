import { format, startOfWeek } from "date-fns";

/**
 * Customer-first view helpers for the opportunities page (owner-approved
 * redesign 2026-10-15): the page shows who the customer is, what the customer
 * actually said, and what to do next. These helpers are pure so the selection
 * rules can be tested without rendering.
 */

type DateValue = Date | string;

export type CustomerFirstContact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  channel: string | null;
  tags: string | null;
};

export type CustomerFirstEmailMessage = {
  id: string;
  sender: string;
  senderEmail: string;
  body: string;
  snippet: string | null;
  isInbound: boolean;
  sentAt: DateValue;
};

export type CustomerFirstEmailThread = {
  id: string;
  subject: string;
  /**
   * Raw participants column (JSON array or delimited addresses). For
   * mailbox-imported website inquiries it holds [customer, receiving mailbox].
   * `counterpart` is deliberately not loaded: it is the customer's address,
   * not a source.
   */
  participants: string | null;
  source: string;
  createdAt: DateValue;
  /** Total messages in the thread; the loaded page may be shorter. */
  messageCount?: number;
  lastActivityAt?: DateValue;
  /** Loaded messages (the latest page plus any older pages), chronological. */
  messages: CustomerFirstEmailMessage[];
};

/** Aggregate over every visible message (not the loaded slice). */
export type CustomerFirstEmailActivity = {
  firstInboundAt: DateValue | null;
  latestInboundAt: DateValue | null;
  latestOutboundAt: DateValue | null;
  latestInboundThreadId: string | null;
};

export type ReplyStatus = "awaiting" | "replied" | null;

export type OriginalDemandInput = {
  nextStepSummary: string | null;
  description: string | null;
  emailThreads: CustomerFirstEmailThread[];
};

export type OriginalDemandSource = "full-text" | "thread" | "description" | "none";

export type OriginalDemandEntry = {
  id: string;
  sender: string;
  senderEmail: string;
  sentAt: DateValue;
  isInbound: boolean;
  body: string;
  fromFullText: boolean;
};

export type OriginalDemandThread = {
  id: string;
  subject: string;
  messageCount: number;
  loadedCount: number;
  oldestLoadedMessageId: string | null;
  entries: OriginalDemandEntry[];
};

export type OpportunitySourceKind =
  | "website-inquiry"
  | "recording"
  | "imported"
  | "email"
  | "manual";

export type OpportunityReplyTarget =
  | { kind: "thread"; threadId: string; href: string }
  | { kind: "mailto"; address: string }
  | null;

/**
 * Mailbox-imported leads store the full inbound mail in
 * `Opportunity.nextStepSummary`, prefixed with 「来信全文（sender，time）：」,
 * because the EmailMessage body column is truncated.
 */
const INBOUND_FULL_TEXT_PREFIX = /^\s*来信全文(?:[（(][^）)]*[）)])?\s*[：:]\s*/u;

const WEBSITE_INQUIRY_TAG = "官网咨询";
const MAILBOX_CHANNEL = "邮箱";

function toTime(value: DateValue) {
  return (typeof value === "string" ? new Date(value) : value).getTime();
}

function sortMessages(thread: CustomerFirstEmailThread) {
  return [...thread.messages].sort(
    (left, right) => toTime(left.sentAt) - toTime(right.sentAt),
  );
}

/** Latest activity first, messages chronological inside each thread. */
function sortThreadsByActivity(threads: CustomerFirstEmailThread[]) {
  return [...threads]
    .map((thread) => ({ ...thread, messages: sortMessages(thread) }))
    .sort(
      (left, right) =>
        toTime(right.lastActivityAt ?? right.createdAt) -
        toTime(left.lastActivityAt ?? left.createdAt),
    );
}

/** True when every message of the thread is loaded. */
export function isThreadFullyLoaded(thread: CustomerFirstEmailThread) {
  return thread.messageCount === undefined || thread.messages.length >= thread.messageCount;
}

export function extractInboundFullText(
  nextStepSummary: string | null | undefined,
): string | null {
  if (!nextStepSummary) return null;
  const match = nextStepSummary.match(INBOUND_FULL_TEXT_PREFIX);
  if (!match) return null;
  const text = nextStepSummary.slice(match[0].length).trim();
  return text || null;
}

function earliestInbound(threads: CustomerFirstEmailThread[]) {
  let primary: {
    thread: CustomerFirstEmailThread;
    message: CustomerFirstEmailMessage;
  } | null = null;

  for (const thread of threads) {
    for (const message of thread.messages) {
      if (!message.isInbound) continue;
      if (!primary || toTime(message.sentAt) < toTime(primary.message.sentAt)) {
        primary = { thread, message };
      }
    }
  }

  return primary;
}

/**
 * The customer's first message. Only fully loaded threads qualify: in a
 * truncated thread the earliest loaded message is not the first one.
 */
export function findPrimaryInboundMessage(threads: CustomerFirstEmailThread[]) {
  return earliestInbound(threads.filter(isThreadFullyLoaded));
}

function messageText(message: CustomerFirstEmailMessage) {
  return (message.body || message.snippet || "").trim();
}

/**
 * Rule: prefer the 来信全文 text stored on the opportunity when it is longer
 * than the first inbound thread body (the thread copy is truncated); otherwise
 * show the thread body; otherwise fall back to the description snippet.
 */
export function selectOriginalDemandText(input: OriginalDemandInput): {
  text: string | null;
  source: OriginalDemandSource;
} {
  const fullText = extractInboundFullText(input.nextStepSummary);
  const primary = findPrimaryInboundMessage(input.emailThreads);
  const threadBody = primary ? messageText(primary.message) : "";

  if (fullText && fullText.length > threadBody.length) {
    return { text: fullText, source: "full-text" };
  }

  if (threadBody) {
    return { text: threadBody, source: "thread" };
  }

  // Only truncated threads: the earliest loaded customer message still shows
  // what they said.
  const loaded = earliestInbound(input.emailThreads);
  const loadedBody = loaded ? messageText(loaded.message) : "";
  if (loadedBody) {
    return { text: loadedBody, source: "thread" };
  }

  const description = input.description?.trim();
  if (description) {
    return { text: description, source: "description" };
  }

  return { text: null, source: "none" };
}

/**
 * Threads ordered by latest activity, each with its loaded messages in
 * chronological order (inbound and our replies). The customer's first message
 * carries the 来信全文 text when the selection rule prefers it.
 */
export function buildOriginalDemandThreads(
  input: OriginalDemandInput,
): OriginalDemandThread[] {
  const selection = selectOriginalDemandText(input);
  const primary = findPrimaryInboundMessage(input.emailThreads);
  const primaryMessageId =
    selection.source === "full-text" ? primary?.message.id ?? null : null;

  return sortThreadsByActivity(input.emailThreads)
    .map((thread) => ({
      id: thread.id,
      subject: thread.subject,
      messageCount: Math.max(thread.messageCount ?? 0, thread.messages.length),
      loadedCount: thread.messages.length,
      oldestLoadedMessageId: thread.messages[0]?.id ?? null,
      entries: thread.messages.map((message) => {
        const fromFullText = message.id === primaryMessageId;
        return {
          id: message.id,
          sender: message.sender,
          senderEmail: message.senderEmail,
          sentAt: message.sentAt,
          isInbound: message.isInbound,
          body: fromFullText ? selection.text ?? "" : messageText(message),
          fromFullText,
        };
      }),
    }))
    .filter((thread) => thread.entries.length > 0);
}

/** A website-inquiry contact: arrived by mailbox (邮箱) and tagged 官网咨询. */
function isWebsiteInquiryContact(contact: CustomerFirstContact) {
  return (
    contact.channel?.trim() === MAILBOX_CHANNEL &&
    (contact.tags ?? "").includes(WEBSITE_INQUIRY_TAG)
  );
}

export function resolveOpportunitySourceKind(input: {
  externalSource: string | null;
  contacts: CustomerFirstContact[];
  emailThreads: CustomerFirstEmailThread[];
}): OpportunitySourceKind {
  if (input.contacts.some(isWebsiteInquiryContact)) {
    return "website-inquiry";
  }
  if (input.externalSource === "TRANSCRIPT_INGEST") {
    return "recording";
  }
  if (input.externalSource) {
    return "imported";
  }
  if (input.emailThreads.length) {
    return "email";
  }
  return "manual";
}

function parseParticipantAddresses(participants: string | null) {
  if (!participants?.trim()) return [];
  let values: unknown[] = [];
  try {
    const parsed: unknown = JSON.parse(participants);
    values = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    values = participants.split(/[,;\s]+/);
  }
  return values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.includes("@"));
}

/**
 * The mailbox that received a website inquiry: the thread participants minus
 * the contacts' own addresses. Imported threads are checked first.
 */
export function findInquiryMailbox(input: {
  contacts: CustomerFirstContact[];
  emailThreads: CustomerFirstEmailThread[];
}): string | null {
  const own = new Set(
    input.contacts
      .map((contact) => contact.email?.trim().toLowerCase())
      .filter((email): email is string => Boolean(email)),
  );
  const threads = [
    ...input.emailThreads.filter((thread) => thread.source === "IMPORT"),
    ...input.emailThreads.filter((thread) => thread.source !== "IMPORT"),
  ];
  for (const thread of threads) {
    const mailbox = parseParticipantAddresses(thread.participants).find(
      (address) => !own.has(address.toLowerCase()),
    );
    if (mailbox) return mailbox;
  }
  return null;
}

export function getOpportunitySourceLabel(
  kind: OpportunitySourceKind,
  english: boolean,
) {
  switch (kind) {
    case "website-inquiry":
      return english ? "Website inquiry email" : "官网咨询邮件";
    case "recording":
      return english ? "Recording" : "录制";
    case "imported":
      return english ? "Imported" : "系统导入";
    case "email":
      return english ? "Email" : "邮件";
    case "manual":
      return english ? "Manual" : "手工";
  }
}

/** Full source text for the 客户 card, e.g. 官网咨询邮件（mailbox）. */
export function describeOpportunitySource(
  kind: OpportunitySourceKind,
  mailbox: string | null,
  english: boolean,
) {
  const label = getOpportunitySourceLabel(kind, english);
  if (kind !== "website-inquiry" || !mailbox) return label;
  return english ? `${label} (${mailbox})` : `${label}（${mailbox}）`;
}

/** Reply target: the thread with the newest customer mail, else the latest active thread. */
export function resolveReplyTarget(input: {
  contacts: CustomerFirstContact[];
  emailThreads: CustomerFirstEmailThread[];
  emailActivity: CustomerFirstEmailActivity;
}): OpportunityReplyTarget {
  const threadId =
    input.emailActivity.latestInboundThreadId ??
    sortThreadsByActivity(input.emailThreads)[0]?.id;
  if (threadId) {
    return { kind: "thread", threadId, href: `/inbox/${threadId}` };
  }

  const address = input.contacts
    .map((contact) => contact.email?.trim())
    .find((email): email is string => Boolean(email));
  return address ? { kind: "mailto", address } : null;
}

/**
 * Awaiting reply when the newest customer mail is later than our newest
 * reply. Uses the aggregate over all messages, never the loaded slice.
 */
export function getReplyStatus(activity: CustomerFirstEmailActivity): ReplyStatus {
  if (!activity.latestInboundAt) return null;
  if (
    activity.latestOutboundAt &&
    toTime(activity.latestOutboundAt) >= toTime(activity.latestInboundAt)
  ) {
    return "replied";
  }
  return "awaiting";
}

export function getReplyStatusLabel(status: ReplyStatus, english: boolean) {
  if (status === "awaiting") return english ? "Awaiting reply" : "待回复";
  if (status === "replied") return english ? "Replied" : "已回复";
  return null;
}

export function firstContactAt(input: {
  createdAt: DateValue;
  emailActivity: CustomerFirstEmailActivity;
}) {
  return input.emailActivity.firstInboundAt ?? input.createdAt;
}

export function isClosedStage(stage: string) {
  return stage === "DONE" || stage === "LOST";
}

export function isOpenAndOverdue(
  item: { stage: string; dueDate: DateValue | null },
  now: Date,
) {
  return (
    !isClosedStage(item.stage) &&
    item.dueDate !== null &&
    toTime(item.dueDate) < now.getTime()
  );
}

/**
 * Inline count row. 本周成交 has no closed-at column, so it counts DONE
 * opportunities whose last update falls in the current week (Monday start).
 */
export function summarizeOpportunityCounts(
  items: Array<{
    stage: string;
    dueDate: DateValue | null;
    updatedAt: DateValue;
    owner: { id: string } | null;
  }>,
  input: { currentUserId: string; now: Date },
) {
  const weekStart = startOfWeek(input.now, { weekStartsOn: 1 }).getTime();
  return {
    pending: items.filter((item) => !isClosedStage(item.stage)).length,
    overdue: items.filter((item) => isOpenAndOverdue(item, input.now)).length,
    wonThisWeek: items.filter(
      (item) => item.stage === "DONE" && toTime(item.updatedAt) >= weekStart,
    ).length,
    mine: items.filter((item) => item.owner?.id === input.currentUserId).length,
  };
}

export function formatTimestamp(value: DateValue) {
  return format(typeof value === "string" ? new Date(value) : value, "yyyy-MM-dd HH:mm");
}

export function formatMonthDayTime(value: DateValue) {
  return format(typeof value === "string" ? new Date(value) : value, "MM-dd HH:mm");
}

export function describeDueChip(
  dueDate: DateValue | null,
  input: { stage: string; now: Date; english: boolean },
): { label: string; overdue: boolean } | null {
  if (!dueDate) return null;
  const date = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  const day = format(date, "MM-dd");
  const overdue = isOpenAndOverdue({ stage: input.stage, dueDate: date }, input.now);
  if (overdue) {
    return { label: input.english ? `Overdue · ${day}` : `已逾期 · ${day}`, overdue };
  }
  return { label: input.english ? `Due ${day}` : `${day} 前处理`, overdue };
}

export function buildSystemJudgementLines(input: {
  english: boolean;
  rank: number | null;
  total: number;
  priorityLabel: string;
  priorityScore: number;
  dueChip: { label: string; overdue: boolean } | null;
  riskLabel: string;
  riskReasons: string[];
  kpiNote: string | null;
  recommendationTitle: string | null;
}) {
  const { english } = input;
  const due = input.dueChip?.label ?? (english ? "no due date" : "未设截止");
  const rank =
    input.rank !== null
      ? english
        ? `#${input.rank} of ${input.total} in the current list`
        : `当前列表第 ${input.rank} / ${input.total} 位`
      : english
        ? "outside the current filter"
        : "不在当前筛选范围内";
  const lines = [
    english
      ? `Ranking: priority ${input.priorityLabel} (${input.priorityScore}), ${due}; ${rank}.`
      : `排序依据：优先级 ${input.priorityLabel}（${input.priorityScore}），${due}；${rank}。`,
    english
      ? `Risk: ${input.riskLabel}.${input.riskReasons.length ? ` ${input.riskReasons.join(", ")}.` : ""}`
      : `风险：${input.riskLabel}。${input.riskReasons.length ? `${input.riskReasons.join("、")}。` : ""}`,
  ];

  if (input.kpiNote) {
    lines.push(english ? `Missing baseline: ${input.kpiNote}` : `缺口径：${input.kpiNote}`);
  }
  if (input.recommendationTitle) {
    lines.push(
      english
        ? `System suggestion: ${input.recommendationTitle}`
        : `系统建议：${input.recommendationTitle}`,
    );
  }

  return lines;
}
