import { describe, expect, it } from "vitest";
import { MemoryFactType, MemoryStatus, ObjectType, SourceType } from "@prisma/client";
import {
  buildMemoryFactConflictKey,
  buildMemoryFactWriteKey,
  buildMemoryFactWritePlan,
  normalizeMemoryFactWriteText,
  type ExistingMemoryFactForWriteGuard,
} from "@/lib/memory/write-dedupe";
import { type CreateFactInput } from "@/lib/memory/memory-fact.service";

function draft(overrides: Partial<CreateFactInput>): CreateFactInput {
  return {
    workspaceId: "workspace-1",
    actorName: "System",
    objectType: ObjectType.OPPORTUNITY,
    objectId: "opp-1",
    factType: MemoryFactType.NEXT_STEP,
    title: "Send proposal",
    content: "Send the proposal by Wednesday.",
    sourceType: SourceType.MEETING_NOTE,
    sourceId: "meeting-1",
    confidence: 80,
    importance: 80,
    freshnessScore: 80,
    ...overrides,
  };
}

function existing(overrides: Partial<ExistingMemoryFactForWriteGuard>): ExistingMemoryFactForWriteGuard {
  return {
    id: "fact-1",
    workspaceId: "workspace-1",
    objectType: ObjectType.OPPORTUNITY,
    objectId: "opp-1",
    factType: MemoryFactType.NEXT_STEP,
    title: "Send proposal",
    content: "Send the proposal by Wednesday.",
    sourceType: SourceType.MEETING_NOTE,
    sourceId: "meeting-1",
    normalizedValue: null,
    ...overrides,
  };
}

describe("memory fact write dedupe", () => {
  it("normalizes source/object/fact text into stable write keys", () => {
    expect(normalizeMemoryFactWriteText("  Send, THE proposal!\n")).toBe("send the proposal");
    expect(buildMemoryFactWriteKey(draft({ content: "Send, THE proposal!" }))).toBe(
      buildMemoryFactWriteKey(draft({ content: "send the proposal" })),
    );
  });

  it("suppresses existing and in-batch duplicate writes without dropping new facts", () => {
    const plan = buildMemoryFactWritePlan({
      existingFacts: [
        existing({
          id: "existing-fact",
          content: "Send the proposal by Wednesday.",
        }),
      ],
      drafts: [
        draft({
          title: "Existing duplicate",
          content: "Send the proposal by Wednesday.",
        }),
        draft({
          title: "Batch new fact",
          content: "Confirm procurement owner.",
        }),
        draft({
          title: "Batch duplicate",
          content: "Confirm procurement owner.",
        }),
      ],
    });

    expect(plan.createDrafts.map((item) => item.title)).toEqual(["Batch new fact"]);
    expect(plan.duplicateSuppressions).toEqual([
      expect.objectContaining({
        reason: "existing_duplicate",
        matchingFactId: "existing-fact",
      }),
      expect.objectContaining({
        reason: "batch_duplicate",
        matchingFactId: null,
      }),
    ]);
    expect(plan.summary).toMatchObject({
      inputDraftCount: 3,
      createDraftCount: 1,
      duplicateSuppressedCount: 2,
      conflictCandidateCount: 0,
    });
  });

  it("surfaces same normalized fact key with different content as conflict posture", () => {
    const plan = buildMemoryFactWritePlan({
      existingFacts: [
        existing({
          id: "budget-existing",
          title: "Budget approved",
          content: "Budget is approved.",
          normalizedValue: JSON.stringify({ factKey: "budget-posture" }),
        }),
      ],
      drafts: [
        draft({
          title: "Budget blocked",
          content: "Budget is still blocked.",
          normalizedValue: { factKey: "budget-posture" },
        }),
      ],
    });

    expect(plan.createDrafts).toHaveLength(0);
    expect(plan.conflictCandidates).toEqual([
      expect.objectContaining({
        reason: "same_normalized_fact_key_different_content",
        existingFactId: "budget-existing",
        existingTitle: "Budget approved",
      }),
    ]);
    expect(buildMemoryFactConflictKey(draft({ normalizedValue: "budget-posture" }))).toContain("budget posture");
    expect(plan.summary.boundaryNote).toContain("does not rewrite canonical facts");
  });

  it("surfaces in-batch normalized key conflicts instead of suppressing them as duplicates", () => {
    const plan = buildMemoryFactWritePlan({
      existingFacts: [],
      drafts: [
        draft({
          title: "Budget approved",
          content: "Budget is approved.",
          normalizedValue: { factKey: "budget-posture" },
        }),
        draft({
          title: "Budget blocked",
          content: "Budget is still blocked.",
          normalizedValue: { factKey: "budget-posture" },
          status: MemoryStatus.OBSERVED,
        }),
      ],
    });

    expect(plan.createDrafts.map((item) => item.title)).toEqual(["Budget approved"]);
    expect(plan.duplicateSuppressions).toHaveLength(0);
    expect(plan.conflictCandidates).toEqual([
      expect.objectContaining({
        reason: "same_batch_normalized_fact_key_different_content",
        existingTitle: "Budget approved",
      }),
    ]);
  });
});
