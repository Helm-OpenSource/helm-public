import { describe, expect, it, vi } from "vitest";

import {
  createCanonicalAdviceDecisionPort,
  createCanonicalPromptResponsePort,
  createCanonicalQuestionSelectionPort,
} from "./canonical-mutation-ports";

const HASH = `sha256:${"a".repeat(64)}`;

const base = {
  workspaceId: "workspace:demo",
  clientId: "client:workbuddy-ceo",
  actorUserId: "user:owner",
  ceoRef: "ceo:owner",
  ceoBindingRef: "caio-principal-binding:1",
  mandateRef: "caio-mandate:1",
  expectedVersion: 2,
  idempotencyKey: "idem:canonical:1",
};

describe("WorkBuddy canonical mutation ports", () => {
  it("delegates P1C selection to the existing canonical selection service", async () => {
    const select = vi.fn(async () => ({
      receipt: { receiptId: "selection-receipt:1" },
      replayed: false,
    }));
    const bind = vi.fn(async () => ({
      selectionReceipt: { receiptId: "selection-receipt:1" },
      bindings: [{ decisionRecordId: "decision-record:1" }],
    }));
    const port = createCanonicalQuestionSelectionPort({
      select,
      bind,
    });
    expect(port.idempotencyGuarantee).toBe("payload_bound");
    const target = {
      schemaVersion: "helm.caio-canonical-object-ref/v1" as const,
      objectKind: "operating_question_portfolio" as const,
      objectId: "portfolio:1",
      objectVersion: 2,
      objectHash: HASH,
    };

    await expect(
      port.apply({
        ...base,
        target,
        command: {
          portfolioHash: HASH,
          selections: [],
          reasonCodes: ["CEO_DEFERRED_SELECTION"],
          evidenceRefs: ["evidence:1"],
        },
      }),
    ).resolves.toEqual({
      canonicalReceiptRef: "selection-receipt:1",
    });
    expect(select).toHaveBeenCalledWith({
      workspaceId: "workspace:demo",
      expectedPortfolioId: "portfolio:1",
      actorUserId: "user:owner",
      ceoPrincipalRef: "ceo:owner",
      idempotencyKey: "idem:canonical:1",
      selections: [],
      reasonCodes: ["CEO_DEFERRED_SELECTION"],
      evidenceRefs: ["evidence:1"],
    });
    expect(bind).toHaveBeenCalledWith({
      workspaceId: "workspace:demo",
      expectedSelectionReceiptId: "selection-receipt:1",
      actorUserId: "user:owner",
      ceoPrincipalRef: "ceo:owner",
    });
  });

  it("does not start DecisionRecord binding after selection exceeds the deadline", async () => {
    const controller = new AbortController();
    const select = vi.fn(async () => {
      controller.abort();
      return {
        receipt: { receiptId: "selection-receipt:late" },
        replayed: false,
      };
    });
    const bind = vi.fn();
    const port = createCanonicalQuestionSelectionPort({
      select,
      bind,
    });

    await expect(
      port.apply({
        ...base,
        target: {
          schemaVersion: "helm.caio-canonical-object-ref/v1",
          objectKind: "operating_question_portfolio",
          objectId: "portfolio:1",
          objectVersion: 2,
          objectHash: HASH,
        },
        command: {
          portfolioHash: HASH,
          selections: [],
          reasonCodes: ["CEO_DEFERRED_SELECTION"],
          evidenceRefs: ["evidence:1"],
        },
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({
      code: "REQUEST_DEADLINE_EXCEEDED",
    });
    expect(select).toHaveBeenCalledTimes(1);
    expect(bind).not.toHaveBeenCalled();
  });

  it("delegates advice decisions and preserves authorityEffect none", async () => {
    const decide = vi.fn(async () => ({
      kind: "decided" as const,
      projection: {
        state: "decided" as const,
        receipt: {
          adviceRef: "advice:1",
          mandateRef: "caio-mandate:1",
          subjectRef: "subject:1",
          outcome: "accepted" as const,
          decidedByRef: "ceo:owner",
          decidedAt: "2026-07-26T08:00:00.000Z",
          decisionReason: "Accept bounded advice.",
          authorityEffect: "none" as const,
        },
      },
    }));
    const port = createCanonicalAdviceDecisionPort({ decide });
    expect(port.idempotencyGuarantee).toBe("payload_bound");

    await expect(
      port.apply({
        ...base,
        target: {
          schemaVersion: "helm.caio-canonical-object-ref/v1",
          objectKind: "caio_advice",
          objectId: "advice:1",
          objectVersion: 2,
          objectHash: HASH,
        },
        command: {
          outcome: "accepted",
          reason: "Accept bounded advice.",
        },
      }),
    ).resolves.toEqual({ canonicalReceiptRef: "advice:1" });
    expect(decide).toHaveBeenCalledWith({
      workspaceId: "workspace:demo",
      adviceRecordId: "advice:1",
      outcome: "accepted",
      reason: "Accept bounded advice.",
      actorUserId: "user:owner",
      actorCeoRef: "ceo:owner",
    });
  });

  it("delegates prompt responses without treating advice as a question", async () => {
    const submit = vi.fn(async () => ({
      receiptRef: "prompt-response-receipt:1",
    }));
    const port = createCanonicalPromptResponsePort({ submit });
    expect(port.idempotencyGuarantee).toBe("payload_bound");

    await expect(
      port.apply({
        ...base,
        target: {
          schemaVersion: "helm.caio-canonical-object-ref/v1",
          objectKind: "operating_question_candidate",
          objectId: "question:1",
          objectVersion: 2,
          objectHash: HASH,
        },
        command: {
          responseKind: "answer",
          deliveryObjectId: "delivery:question-1:v2",
          answer: "Use the governed evidence packet.",
        },
      }),
    ).resolves.toEqual({
      canonicalReceiptRef: "prompt-response-receipt:1",
    });
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceObjectKind: "operating_question_candidate",
        sourceObjectId: "question:1",
        sourceObjectHash: HASH,
        expectedVersion: 2,
        command: expect.objectContaining({
          responseKind: "answer",
        }),
      }),
    );

    await expect(
      port.apply({
        ...base,
        target: {
          schemaVersion: "helm.caio-canonical-object-ref/v1",
          objectKind: "caio_advice",
          objectId: "advice:1",
          objectVersion: 2,
          objectHash: HASH,
        },
        command: {
          responseKind: "answer",
          deliveryObjectId: "delivery:advice-1:v2",
          answer: "This must not become an advice decision.",
        },
      }),
    ).rejects.toMatchObject({ code: "INVALID_TOOL_INPUT" });
  });
});
