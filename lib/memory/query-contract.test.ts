import { describe, expect, it } from "vitest";
import {
  buildTimelineCursor,
  compareTimelineEvents,
  encodeMemoryCursor,
  isTimelineEventAfterCursor,
  parseMemoryFactCursor,
  parseMemoryTimelineCursor,
  resolveMemoryBoundedLimit,
} from "@/lib/memory/query-contract";
import type { TimelineEvent } from "@/lib/memory/shared";

describe("memory query contract", () => {
  it("clamps invalid and oversized limits to bounded defaults", () => {
    expect(resolveMemoryBoundedLimit(null, { defaultLimit: 50, maxLimit: 100 })).toMatchObject({
      limit: 50,
      requestedLimit: null,
      wasBounded: true,
    });

    expect(resolveMemoryBoundedLimit("-10", { defaultLimit: 50, maxLimit: 100 })).toMatchObject({
      limit: 50,
      requestedLimit: -10,
      wasBounded: true,
    });

    expect(resolveMemoryBoundedLimit("250", { defaultLimit: 50, maxLimit: 100 })).toMatchObject({
      limit: 100,
      requestedLimit: 250,
      wasBounded: true,
    });
  });

  it("round-trips fact cursors and rejects malformed cursors", () => {
    const rawCursor = encodeMemoryCursor({
      importance: 88,
      createdAt: "2026-04-20T08:00:00.000Z",
      id: "fact-1",
    });

    expect(parseMemoryFactCursor(rawCursor)).toEqual({
      ok: true,
      rawCursor,
      cursor: {
        importance: 88,
        createdAt: "2026-04-20T08:00:00.000Z",
        id: "fact-1",
      },
    });
    expect(parseMemoryFactCursor("not-a-cursor")).toMatchObject({ ok: false });
  });

  it("keeps timeline ordering stable across cursor pages", () => {
    const events = [
      {
        type: "MEMORY_FACT" as const,
        id: "b",
        title: "B",
        occurredAt: new Date("2026-04-20T08:00:00.000Z"),
        status: "ACTIVE",
        sourceLabel: "MEETING_NOTE",
      },
      {
        type: "COMMITMENT" as const,
        id: "a",
        title: "A",
        occurredAt: new Date("2026-04-20T08:00:00.000Z"),
        status: "OPEN",
        sourceLabel: "MEETING_NOTE",
      },
      {
        type: "BLOCKER" as const,
        id: "c",
        title: "C",
        occurredAt: new Date("2026-04-19T08:00:00.000Z"),
        status: "OPEN",
        sourceLabel: "MEETING_NOTE",
      },
    ] satisfies TimelineEvent[];
    const sortedEvents = events.sort(compareTimelineEvents);

    expect(sortedEvents.map((item) => `${item.type}:${item.id}`)).toEqual([
      "MEMORY_FACT:b",
      "COMMITMENT:a",
      "BLOCKER:c",
    ]);

    const firstCursor = parseMemoryTimelineCursor(buildTimelineCursor(sortedEvents[0]));
    expect(firstCursor.ok && sortedEvents.filter((item) => isTimelineEventAfterCursor(item, firstCursor.cursor)).map((item) => `${item.type}:${item.id}`)).toEqual([
      "COMMITMENT:a",
      "BLOCKER:c",
    ]);

    const secondCursor = parseMemoryTimelineCursor(buildTimelineCursor(sortedEvents[1]));
    expect(secondCursor.ok && sortedEvents.filter((item) => isTimelineEventAfterCursor(item, secondCursor.cursor)).map((item) => `${item.type}:${item.id}`)).toEqual([
      "BLOCKER:c",
    ]);
  });
});
