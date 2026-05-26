import { describe, expect, it, vi } from "vitest";
import { MemoryFactType, MemoryStatus, ObjectType, SourceType, type MemoryFact } from "@prisma/client";
import {
  classifyMemoryFactWriteFailure,
  createMemoryFactsWithWriteResult,
  type CreateFactInput,
} from "@/lib/memory/memory-fact.service";

function draft(overrides: Partial<CreateFactInput> = {}): CreateFactInput {
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

function createdFact(fact: CreateFactInput): MemoryFact {
  return {
    id: `fact-${fact.title}`,
    workspaceId: fact.workspaceId,
    objectType: fact.objectType,
    objectId: fact.objectId,
    factType: fact.factType,
    title: fact.title,
    content: fact.content,
    sourceType: fact.sourceType,
    sourceId: fact.sourceId,
    normalizedValue: null,
    confidence: fact.confidence ?? 65,
    importance: fact.importance ?? 60,
    freshnessScore: fact.freshnessScore ?? 60,
    status: fact.status ?? MemoryStatus.ACTIVE,
    confirmedByUser: false,
    createdBySystem: true,
    createdAt: new Date("2026-04-21T00:00:00.000Z"),
    updatedAt: new Date("2026-04-21T00:00:00.000Z"),
  } as MemoryFact;
}

describe("memory fact batch write result", () => {
  it("returns a complete summary when all fact writes succeed", async () => {
    const writeFact = vi.fn(async (fact: CreateFactInput) => createdFact(fact));

    const result = await createMemoryFactsWithWriteResult({
      facts: [draft({ title: "A" }), draft({ title: "B" })],
      writeFact,
    });

    expect(result.created.map((item) => item.title)).toEqual(["A", "B"]);
    expect(result.failures).toEqual([]);
    expect(result.summary).toMatchObject({
      inputFactCount: 2,
      attemptedFactCount: 2,
      createdFactCount: 2,
      failedFactCount: 0,
      status: "complete",
      failurePolicy: "fail_fast",
    });
  });

  it("fails fast and classifies transient database errors as retryable", async () => {
    const writeFact = vi
      .fn()
      .mockImplementationOnce(async (fact: CreateFactInput) => createdFact(fact))
      .mockRejectedValueOnce(Object.assign(new Error("Can't reach database server"), { code: "P1001" }));

    const result = await createMemoryFactsWithWriteResult({
      facts: [draft({ title: "A" }), draft({ title: "B" }), draft({ title: "C" })],
      writeFact,
    });

    expect(writeFact).toHaveBeenCalledTimes(2);
    expect(result.created.map((item) => item.title)).toEqual(["A"]);
    expect(result.failures).toEqual([
      expect.objectContaining({
        failureClass: "retryable",
        reason: "database_unavailable",
        retryable: true,
        operatorReviewRequired: false,
        title: "B",
      }),
    ]);
    expect(result.summary).toMatchObject({
      inputFactCount: 3,
      attemptedFactCount: 2,
      createdFactCount: 1,
      failedFactCount: 1,
      retryableFailureCount: 1,
      status: "partial_failed",
    });
  });

  it("can collect all failures and separates non-retryable from operator-review-required", async () => {
    const writeFact = vi
      .fn()
      .mockRejectedValueOnce(new Error("未找到对应对象"))
      .mockRejectedValueOnce(Object.assign(new Error("Unique collision"), { code: "P2002" }));

    const result = await createMemoryFactsWithWriteResult({
      facts: [draft({ title: "Missing object" }), draft({ title: "Unique conflict" })],
      continueOnFailure: true,
      writeFact,
    });

    expect(writeFact).toHaveBeenCalledTimes(2);
    expect(result.failures).toEqual([
      expect.objectContaining({
        failureClass: "non_retryable",
        reason: "object_not_found",
        operatorReviewRequired: false,
      }),
      expect.objectContaining({
        failureClass: "operator_review_required",
        reason: "db_unique_conflict",
        operatorReviewRequired: true,
      }),
    ]);
    expect(result.summary).toMatchObject({
      attemptedFactCount: 2,
      failedFactCount: 2,
      nonRetryableFailureCount: 1,
      operatorReviewRequiredCount: 1,
      failurePolicy: "collect_all",
      status: "blocked",
    });
  });

  it("keeps unknown write failures in operator review posture", () => {
    expect(classifyMemoryFactWriteFailure(new Error("unexpected write failure"))).toMatchObject({
      failureClass: "operator_review_required",
      reason: "unknown_write_failure",
      retryable: false,
      operatorReviewRequired: true,
    });
  });

  it("classifies timeout, transaction conflict, and missing record codes explicitly", () => {
    expect(classifyMemoryFactWriteFailure(Object.assign(new Error("Pool timeout"), { code: "P2024" }))).toMatchObject({
      failureClass: "retryable",
      reason: "database_timeout",
    });
    expect(classifyMemoryFactWriteFailure(Object.assign(new Error("Transaction conflict"), { code: "P2034" }))).toMatchObject({
      failureClass: "retryable",
      reason: "transaction_conflict",
    });
    expect(classifyMemoryFactWriteFailure(Object.assign(new Error("Record not found"), { code: "P2025" }))).toMatchObject({
      failureClass: "non_retryable",
      reason: "object_not_found",
    });
  });
});
