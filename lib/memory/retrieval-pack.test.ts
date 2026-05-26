import { describe, expect, it } from "vitest";
import { MemoryStatus, ObjectType, SourceType } from "@prisma/client";
import {
  buildMemoryRetrievalPack,
  type MemoryRetrievalPackCandidate,
} from "@/lib/memory/retrieval-pack";

function candidate(
  overrides: Partial<MemoryRetrievalPackCandidate> & { id: string },
): MemoryRetrievalPackCandidate {
  return {
    objectType: ObjectType.OPPORTUNITY,
    objectId: "opp-1",
    factType: "SUMMARY",
    title: `Fact ${overrides.id}`,
    content: `Content ${overrides.id}`,
    sourceType: SourceType.MEETING_NOTE,
    sourceId: `source-${overrides.id}`,
    status: MemoryStatus.ACTIVE,
    confidence: 70,
    importance: 70,
    freshnessScore: 70,
    confirmedByUser: false,
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    updatedAt: new Date("2026-04-20T00:00:00.000Z"),
    ...overrides,
  };
}

describe("memory retrieval pack", () => {
  it("selects high-trust facts within item and token budgets", () => {
    const pack = buildMemoryRetrievalPack({
      surface: "recommendation",
      objectType: ObjectType.OPPORTUNITY,
      objectId: "opp-1",
      budget: {
        maxItems: 2,
        maxEstimatedTokens: 80,
      },
      now: new Date("2026-04-20T00:00:00.000Z"),
      candidates: [
        candidate({
          id: "confirmed",
          confirmedByUser: true,
          confidence: 80,
          importance: 85,
        }),
        candidate({
          id: "important",
          confidence: 76,
          importance: 88,
        }),
        candidate({
          id: "overflow",
          confidence: 70,
          importance: 70,
        }),
      ],
    });

    expect(pack.selected.map((item) => item.candidate.id)).toEqual(["confirmed", "important"]);
    expect(pack.omitted).toContainEqual(
      expect.objectContaining({
        omittedReason: "budget_item_limit",
        candidate: expect.objectContaining({ id: "overflow" }),
      }),
    );
    expect(pack.trace.selectedReasons).toContainEqual({
      reason: "confirmed_by_user",
      count: 1,
    });
    expect(pack.trace.boundaryNote).toContain("does not change recommendation ranking");
  });

  it("omits duplicate, stale, inactive and low-trust candidates before budget selection", () => {
    const pack = buildMemoryRetrievalPack({
      surface: "briefing",
      objectType: ObjectType.OPPORTUNITY,
      objectId: "opp-1",
      budget: {
        maxItems: 5,
        maxEstimatedTokens: 200,
      },
      now: new Date("2026-04-20T00:00:00.000Z"),
      candidates: [
        candidate({
          id: "keeper",
          content: "same normalized content",
          normalizedValue: "same normalized content",
          confidence: 90,
          importance: 90,
        }),
        candidate({
          id: "duplicate",
          content: "same normalized content",
          normalizedValue: "same normalized content",
          confidence: 50,
          importance: 50,
        }),
        candidate({
          id: "stale",
          freshnessScore: 20,
        }),
        candidate({
          id: "inactive",
          status: MemoryStatus.ARCHIVED,
        }),
        candidate({
          id: "low-trust",
          confidence: 30,
        }),
      ],
    });

    expect(pack.selected.map((item) => item.candidate.id)).toEqual(["keeper"]);
    expect(pack.trace.omittedReasons).toEqual(
      expect.arrayContaining([
        { reason: "duplicate_candidate", count: 1 },
        { reason: "stale_suppressed", count: 1 },
        { reason: "inactive_or_invalid", count: 1 },
        { reason: "low_trust", count: 1 },
      ]),
    );
    expect(pack.trace.staleSuppressionRefs).toEqual(["stale"]);
  });

  it("falls back without selecting candidates when budget is invalid", () => {
    const pack = buildMemoryRetrievalPack({
      surface: "meeting_detail",
      objectType: ObjectType.MEETING,
      objectId: "meeting-1",
      budget: {
        maxItems: 0,
        maxEstimatedTokens: 120,
      },
      candidates: [candidate({ id: "fact-1" })],
    });

    expect(pack.fallback).toEqual({
      used: true,
      reason: "invalid_or_empty_budget",
    });
    expect(pack.selected).toEqual([]);
    expect(pack.omitted).toHaveLength(1);
  });
});
