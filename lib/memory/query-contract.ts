import type { TimelineEvent } from "@/lib/memory/shared";

export const MEMORY_FACTS_QUERY_LIMIT = {
  default: 50,
  max: 100,
} as const;

export const MEMORY_TIMELINE_QUERY_LIMIT = {
  default: 50,
  max: 100,
} as const;

export const MEMORY_OBJECT_RETRIEVAL_LIMIT = {
  default: 20,
  max: 40,
} as const;

export type MemoryBoundedLimit = {
  limit: number;
  requestedLimit: number | null;
  maxLimit: number;
  defaultLimit: number;
  wasBounded: boolean;
};

export type MemoryFactPageCursor = {
  importance: number;
  createdAt: string;
  id: string;
};

export type MemoryTimelinePageCursor = {
  occurredAt: string;
  type: TimelineEvent["type"];
  id: string;
};

export type MemoryQueryPageInfo = {
  limit: number;
  maxLimit: number;
  hasNextPage: boolean;
  nextCursor: string | null;
  appliedCursor: string | null;
  bounded: boolean;
};

export type MemoryCursorParseResult<T> =
  | {
      ok: true;
      cursor: T | null;
      rawCursor: string | null;
    }
  | {
      ok: false;
      message: string;
    };

const TIMELINE_EVENT_TYPES = new Set<TimelineEvent["type"]>([
  "MEMORY_FACT",
  "COMMITMENT",
  "BLOCKER",
  "MEMORY_CORRECTION",
  "MEMORY_ENTRY",
  "MEETING",
  "ACTION",
  "APPROVAL",
  "EMAIL_THREAD",
]);

export function resolveMemoryBoundedLimit(
  rawLimit: string | null,
  config: {
    defaultLimit: number;
    maxLimit: number;
  },
): MemoryBoundedLimit {
  const parsed = rawLimit === null ? Number.NaN : Number(rawLimit);
  const requestedLimit = Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  const positiveLimit =
    requestedLimit && requestedLimit > 0 ? requestedLimit : config.defaultLimit;
  const limit = Math.min(positiveLimit, config.maxLimit);

  return {
    limit,
    requestedLimit,
    maxLimit: config.maxLimit,
    defaultLimit: config.defaultLimit,
    wasBounded: positiveLimit !== limit || requestedLimit === null || requestedLimit <= 0,
  };
}

export function encodeMemoryCursor(payload: MemoryFactPageCursor | MemoryTimelinePageCursor) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeMemoryCursor(rawCursor: string) {
  return JSON.parse(Buffer.from(rawCursor, "base64url").toString("utf8")) as unknown;
}

function isValidIsoDate(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function parseMemoryFactCursor(rawCursor: string | null): MemoryCursorParseResult<MemoryFactPageCursor> {
  if (!rawCursor) {
    return { ok: true, cursor: null, rawCursor: null };
  }

  try {
    const decoded = decodeMemoryCursor(rawCursor);
    if (
      typeof decoded === "object" &&
      decoded !== null &&
      typeof (decoded as MemoryFactPageCursor).id === "string" &&
      typeof (decoded as MemoryFactPageCursor).importance === "number" &&
      Number.isFinite((decoded as MemoryFactPageCursor).importance) &&
      isValidIsoDate((decoded as MemoryFactPageCursor).createdAt)
    ) {
      return {
        ok: true,
        cursor: decoded as MemoryFactPageCursor,
        rawCursor,
      };
    }
  } catch {
    // Fall through to the shared error response below.
  }

  return { ok: false, message: "cursor 无效或已过期" };
}

export function parseMemoryTimelineCursor(rawCursor: string | null): MemoryCursorParseResult<MemoryTimelinePageCursor> {
  if (!rawCursor) {
    return { ok: true, cursor: null, rawCursor: null };
  }

  try {
    const decoded = decodeMemoryCursor(rawCursor);
    if (
      typeof decoded === "object" &&
      decoded !== null &&
      typeof (decoded as MemoryTimelinePageCursor).id === "string" &&
      isValidIsoDate((decoded as MemoryTimelinePageCursor).occurredAt) &&
      TIMELINE_EVENT_TYPES.has((decoded as MemoryTimelinePageCursor).type)
    ) {
      return {
        ok: true,
        cursor: decoded as MemoryTimelinePageCursor,
        rawCursor,
      };
    }
  } catch {
    // Fall through to the shared error response below.
  }

  return { ok: false, message: "cursor 无效或已过期" };
}

export function buildMemoryQueryPageInfo(args: {
  limit: MemoryBoundedLimit;
  hasNextPage: boolean;
  nextCursor: string | null;
  appliedCursor: string | null;
}): MemoryQueryPageInfo {
  return {
    limit: args.limit.limit,
    maxLimit: args.limit.maxLimit,
    hasNextPage: args.hasNextPage,
    nextCursor: args.nextCursor,
    appliedCursor: args.appliedCursor,
    bounded: args.limit.wasBounded,
  };
}

export function splitMemoryPage<T>(items: T[], limit: number) {
  return {
    items: items.slice(0, limit),
    hasNextPage: items.length > limit,
  };
}

export function compareTimelineEvents(left: TimelineEvent, right: TimelineEvent) {
  const timeDelta = new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime();
  if (timeDelta !== 0) return timeDelta;
  return `${right.type}:${right.id}`.localeCompare(`${left.type}:${left.id}`);
}

export function isTimelineEventAfterCursor(
  event: TimelineEvent,
  cursor: MemoryTimelinePageCursor | null,
) {
  if (!cursor) return true;

  const eventTime = new Date(event.occurredAt).getTime();
  const cursorTime = Date.parse(cursor.occurredAt);
  if (eventTime < cursorTime) return true;
  if (eventTime > cursorTime) return false;
  return `${event.type}:${event.id}` < `${cursor.type}:${cursor.id}`;
}

export function buildTimelineCursor(event: TimelineEvent) {
  return encodeMemoryCursor({
    occurredAt: new Date(event.occurredAt).toISOString(),
    type: event.type,
    id: event.id,
  });
}
