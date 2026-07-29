import { describe, expect, it } from "vitest";

import { projectP1cForWorkBuddy } from "./remote-projection";

describe("projectP1cForWorkBuddy", () => {
  it("projects only allowlisted P1C fields and canonical lifecycle references", () => {
    const projection = projectP1cForWorkBuddy({
      workspaceId: "workspace:demo",
      portfolio: {
        portfolioRef: "portfolio:1",
        sequence: 7,
        generatedAt: "2026-07-26T01:00:00.000Z",
        questions: [
          {
            questionRef: "question:1",
            rank: 1,
            contentHash: `sha256:${"1".repeat(64)}`,
            title: "Which renewal risk needs an owner decision?",
            question: "Which renewal risk needs an owner decision this week?",
            businessDomain: "revenue",
            evidenceCount: 3,
            processingDisposition: "remote_projected",
            rawEvidence: "secret raw customer evidence",
            transcript: "secret transcript",
            sourcePath: "/Users/private/customer.json",
          },
          {
            questionRef: "question:2",
            rank: 2,
            contentHash: `sha256:${"2".repeat(64)}`,
            title: "Local title",
            question: "Local-only question",
            businessDomain: "operations",
            evidenceCount: 2,
            processingDisposition: "local_only",
            rawEvidence: "secret local evidence",
          },
        ],
      },
      selection: {
        selectionReceiptRef: "selection:1",
        sequence: 3,
        selectedQuestionRefs: ["question:1"],
      },
      followThrough: [
        {
          questionRef: "question:1",
          decisionRecord: {
            ref: "decision:1",
            status: "confirmed",
            validUntil: "2026-08-01T00:00:00.000Z",
          },
          actionItem: {
            ref: "action:1",
            status: "pending",
            riskLevel: "medium",
          },
          approvalTask: {
            ref: "approval:1",
            status: "pending",
            autoExecute: false,
          },
          executionReceipt: null,
        },
      ],
      rawEvidence: "top-level secret",
      transcript: "top-level transcript",
      path: "/private/source",
    });

    expect(projection.questions).toEqual([
      expect.objectContaining({
        questionRef: "question:1",
        content: {
          title: "Which renewal risk needs an owner decision?",
          question: "Which renewal risk needs an owner decision this week?",
        },
        localViewRequired: false,
      }),
      expect.objectContaining({
        questionRef: "question:2",
        content: null,
        localViewRequired: true,
      }),
    ]);
    expect(projection.followThrough[0]).toMatchObject({
      questionRef: "question:1",
      decisionRecord: { ref: "decision:1", status: "confirmed" },
      actionItem: { ref: "action:1", status: "pending" },
      approvalTask: {
        ref: "approval:1",
        status: "pending",
        autoExecute: false,
      },
      executionReceipt: null,
    });
    expect(projection.boundary).toEqual({
      authorityEffect: "none",
      canonicalMutationAuthorityGranted: false,
      rawContentIncluded: false,
      sourcePayloadCopied: false,
    });

    const serialized = JSON.stringify(projection);
    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("transcript");
    expect(serialized).not.toContain("/Users/");
    expect(serialized).not.toContain("/private/");
    expect(serialized).not.toContain("local_only");
  });
});
