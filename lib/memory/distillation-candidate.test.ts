import { describe, expect, it } from "vitest";
import { MemoryFactType, ObjectType, SourceType } from "@prisma/client";
import {
  buildDistillationCandidateGroupKey,
  detectDistillationCandidates,
  type DistillationFactInput,
} from "@/lib/memory/distillation-candidate";

function makeFact(overrides: Partial<DistillationFactInput> & { id: string }): DistillationFactInput {
  return {
    objectType: ObjectType.OPPORTUNITY,
    objectId: "opp-1",
    factType: MemoryFactType.RISK_SIGNAL,
    title: "Budget risk",
    content: "Budget is at risk.",
    normalizedValue: { factKey: "budget-risk" },
    sourceType: SourceType.MEETING_NOTE,
    sourceId: "meeting-1",
    status: "ACTIVE",
    confidence: 70,
    importance: 70,
    confirmedByUser: false,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    evidenceRefs: [],
    priorReviewDecisions: [],
    ...overrides,
  };
}

describe("detectDistillationCandidates", () => {
  it("creates a candidate for repeated normalized facts in the same group", () => {
    const facts = [
      makeFact({ id: "f1", createdAt: new Date("2026-01-01T00:00:00Z") }),
      makeFact({ id: "f2", sourceId: "meeting-2", createdAt: new Date("2026-01-02T00:00:00Z") }),
    ];
    const result = detectDistillationCandidates(facts);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].sourceFactIds).toEqual(["f1", "f2"]);
    expect(result.candidates[0].repeatCount).toBe(2);
    expect(result.candidates[0].createdFrom).toBe("repeated_normalized_fact");
    expect(result.candidates[0].groupKey).toBe("OPPORTUNITY|opp-1|RISK_SIGNAL|budget risk");
    expect(result.omitted).toHaveLength(0);
  });

  it("builds a deterministic group key from normalized semantic value", () => {
    const fact = makeFact({
      id: "f1",
      normalizedValue: { factKey: " Budget   Risk! " },
      content: "Different content should not be used when normalized value exists.",
    });
    expect(buildDistillationCandidateGroupKey(fact)).toBe("OPPORTUNITY|opp-1|RISK_SIGNAL|budget risk");
    expect(buildDistillationCandidateGroupKey({ ...fact, sourceId: "meeting-2" })).toBe(
      buildDistillationCandidateGroupKey(fact),
    );
  });

  it("does not create a candidate for a unique fact", () => {
    const facts = [makeFact({ id: "f1" })];
    const result = detectDistillationCandidates(facts);
    expect(result.candidates).toHaveLength(0);
  });

  it("does not create candidates for two facts with different normalized values", () => {
    const facts = [
      makeFact({ id: "f1", normalizedValue: { factKey: "budget-risk" } }),
      makeFact({ id: "f2", normalizedValue: { factKey: "timeline-risk" } }),
    ];
    const result = detectDistillationCandidates(facts);
    expect(result.candidates).toHaveLength(0);
  });

  it("reviewPosture is always review_required, confirmed facts raise confidence but do not bypass review", () => {
    const facts = [
      makeFact({ id: "f1", confidence: 60, confirmedByUser: false }),
      makeFact({ id: "f2", confidence: 70, confirmedByUser: true, sourceId: "meeting-2" }),
    ];
    const result = detectDistillationCandidates(facts);
    expect(result.candidates).toHaveLength(1);
    const candidate = result.candidates[0];
    expect(candidate.reviewPosture).toBe("review_required");
    expect(candidate.confidence).toBeGreaterThan(70);
    expect(candidate.confidence).toBeLessThanOrEqual(100);
  });

  it("omits group with reject prior review decision and does not regenerate the candidate", () => {
    const priorReviewDecisions: DistillationFactInput["priorReviewDecisions"] = [
      {
        decision: "reject",
        groupKey: "OPPORTUNITY|opp-1|RISK_SIGNAL|budget risk",
        decidedAt: new Date("2026-01-05T00:00:00Z"),
      },
    ];
    const facts = [
      makeFact({ id: "f1", priorReviewDecisions }),
      makeFact({ id: "f2", sourceId: "meeting-2", priorReviewDecisions }),
    ];
    const result = detectDistillationCandidates(facts);
    expect(result.candidates).toHaveLength(0);
    expect(result.omitted).toHaveLength(1);
    expect(result.omitted[0].reason).toBe("rejected_by_review");
  });

  it("omits group with defer prior review decision", () => {
    const priorReviewDecisions: DistillationFactInput["priorReviewDecisions"] = [
      {
        decision: "defer",
        groupKey: "OPPORTUNITY|opp-1|RISK_SIGNAL|budget risk",
        decidedAt: new Date("2026-01-05T00:00:00Z"),
      },
    ];
    const facts = [
      makeFact({ id: "f1", priorReviewDecisions }),
      makeFact({ id: "f2", sourceId: "meeting-2", priorReviewDecisions }),
    ];
    const result = detectDistillationCandidates(facts);
    expect(result.candidates).toHaveLength(0);
    expect(result.omitted[0].reason).toBe("deferred_by_review");
  });

  it("produces deterministic output regardless of input order", () => {
    const f1 = makeFact({ id: "f1", createdAt: new Date("2026-01-01T00:00:00Z") });
    const f2 = makeFact({ id: "f2", sourceId: "meeting-2", createdAt: new Date("2026-01-02T00:00:00Z") });
    const result1 = detectDistillationCandidates([f1, f2]);
    const result2 = detectDistillationCandidates([f2, f1]);
    expect(result1.candidates[0].sourceFactIds).toEqual(result2.candidates[0].sourceFactIds);
    expect(result1.candidates[0].candidateId).toBe(result2.candidates[0].candidateId);
  });

  it("retains evidence refs and source refs from all member facts", () => {
    const facts = [
      makeFact({
        id: "f1",
        evidenceRefs: ["ref-a", "ref-b"],
        sourceType: SourceType.EMAIL_THREAD,
        sourceId: "email-1",
      }),
      makeFact({
        id: "f2",
        evidenceRefs: ["ref-b", "ref-c"],
        sourceType: SourceType.MEETING_NOTE,
        sourceId: "meeting-2",
      }),
    ];
    const result = detectDistillationCandidates(facts);
    expect(result.candidates[0].evidenceRefs).toEqual(["ref-a", "ref-b", "ref-c"]);
    expect(result.candidates[0].sourceRefs).toContain("EMAIL_THREAD:email-1");
    expect(result.candidates[0].sourceRefs).toContain("MEETING_NOTE:meeting-2");
  });

  it("boundary note indicates candidates cannot write facts or change ranking", () => {
    const facts = [
      makeFact({ id: "f1" }),
      makeFact({ id: "f2", sourceId: "meeting-2" }),
    ];
    const result = detectDistillationCandidates(facts);
    expect(result.candidates[0].boundaryNote).toContain("cannot write canonical facts");
    expect(result.candidates[0].boundaryNote).toContain("cannot change recommendation ranking");
  });

  it("does not group two facts with empty normalizedValue when their content differs", () => {
    const facts = [
      makeFact({ id: "f1", normalizedValue: null, content: "Budget concern raised.", title: "Budget" }),
      makeFact({ id: "f2", normalizedValue: null, content: "Timeline slipped by two weeks.", title: "Timeline" }),
    ];
    const result = detectDistillationCandidates(facts);
    expect(result.candidates).toHaveLength(0);
  });

  it("groups two facts with empty normalizedValue when their content matches (content fallback)", () => {
    const sharedContent = "Budget is at risk.";
    const facts = [
      makeFact({ id: "f1", normalizedValue: null, content: sharedContent, sourceId: "meeting-1" }),
      makeFact({ id: "f2", normalizedValue: null, content: sharedContent, sourceId: "meeting-2" }),
    ];
    const result = detectDistillationCandidates(facts);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].sourceFactIds).toEqual(["f1", "f2"]);
  });

  it("does not generate a candidate when normalizedValue, content, and title are all empty", () => {
    const facts = [
      makeFact({ id: "f1", normalizedValue: null, content: "", title: "", sourceId: "meeting-1" }),
      makeFact({ id: "f2", normalizedValue: null, content: "", title: "", sourceId: "meeting-2" }),
    ];
    const result = detectDistillationCandidates(facts);
    expect(result.candidates).toHaveLength(0);
  });

  it("groups facts correctly across different objectId and factType boundaries", () => {
    const facts = [
      makeFact({ id: "f1", objectId: "opp-1", factType: MemoryFactType.RISK_SIGNAL }),
      makeFact({ id: "f2", objectId: "opp-1", factType: MemoryFactType.RISK_SIGNAL, sourceId: "meeting-2" }),
      makeFact({ id: "f3", objectId: "opp-2", factType: MemoryFactType.RISK_SIGNAL }),
      makeFact({ id: "f4", objectId: "opp-1", factType: MemoryFactType.NEXT_STEP }),
    ];
    const result = detectDistillationCandidates(facts);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].objectId).toBe("opp-1");
    expect(result.candidates[0].sourceFactIds).toEqual(["f1", "f2"]);
  });
});
