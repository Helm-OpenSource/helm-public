import { describe, expect, it, vi } from "vitest";

import type {
  CaioDeliveryEnvelope,
} from "./delivery-contracts";
import {
  createWorkBuddyDeliveryProjectionResolver,
} from "./delivery-projection";

const QUESTION_HASH = `sha256:${"a".repeat(64)}`;
const TRIGGER_HASH = `sha256:${"b".repeat(64)}`;

function envelope(
  objectKind:
    | "operating_question_candidate"
    | "caio_advice" = "operating_question_candidate",
): CaioDeliveryEnvelope {
  return {
    schemaVersion: "helm.caio-delivery-envelope/v1",
    deliveryObjectId: "delivery:question-1:v7",
    workspaceId: "workspace:demo",
    source: {
      schemaVersion: "helm.caio-canonical-object-ref/v1",
      objectKind,
      objectId:
        objectKind === "operating_question_candidate"
          ? "question:1"
          : "advice:1",
      objectVersion: 7,
      objectHash: QUESTION_HASH,
    },
    deliveryKey: "delivery-key:question-1",
    severity: "normal",
    category: "operating_question",
    triggerRuleRef: "rule:question-ready",
    triggerSnapshotHash: TRIGGER_HASH,
    validUntil: "2026-07-27T00:00:00.000Z",
    deliveryVersion: 1,
    status: "delivered",
    snoozedUntil: null,
    createdAt: "2026-07-26T00:00:00.000Z",
    updatedAt: "2026-07-26T00:01:00.000Z",
    boundary: {
      authorityEffect: "none",
      sourcePayloadCopied: false,
      canonicalMutationAuthorityGranted: false,
      externalExecutionAllowed: false,
    },
  };
}

function source(disposition: "local_only" | "remote_projected") {
  return {
    workspaceId: "workspace:demo",
    portfolio: {
      portfolioRef: "caio-question-portfolio:1",
      sequence: 7,
      generatedAt: "2026-07-26T00:00:00.000Z",
      questions: [
        {
          questionRef: "question:1",
          rank: 1,
          title: "Which renewal risk needs a decision?",
          question: "Which renewal risk needs a decision this week?",
          businessDomain: "revenue",
          evidenceCount: 2,
          processingDisposition: disposition,
          contentHash: QUESTION_HASH,
          rawEvidence: "must never leave the source adapter",
        },
      ],
    },
    selection: null,
    followThrough: [],
  };
}

describe("createWorkBuddyDeliveryProjectionResolver", () => {
  it("returns one hash-bound remote-safe operating question", async () => {
    const loadP1cProjectionSource = vi.fn(async () =>
      source("remote_projected"),
    );
    const resolve = createWorkBuddyDeliveryProjectionResolver({
      projectionQueries: { loadP1cProjectionSource },
    });

    await expect(resolve(envelope())).resolves.toMatchObject({
      schemaVersion: "helm.workbuddy-prompt-projection/v1",
      available: true,
      localViewRequired: false,
      question: {
        questionRef: "question:1",
        content: {
          title: "Which renewal risk needs a decision?",
          question: "Which renewal risk needs a decision this week?",
        },
      },
      boundary: {
        authorityEffect: "none",
        sourcePayloadCopied: false,
        externalExecutionAllowed: false,
      },
    });
    expect(loadP1cProjectionSource).toHaveBeenCalledWith({
      workspaceId: "workspace:demo",
      actorUserId: "system:workbuddy-delivery-projector",
      portfolioSequence: 7,
    });
    expect(
      JSON.stringify(await resolve(envelope())),
    ).not.toContain("rawEvidence");
  });

  it("keeps local-only questions and non-question objects local", async () => {
    const loadP1cProjectionSource = vi.fn(async () =>
      source("local_only"),
    );
    const resolve = createWorkBuddyDeliveryProjectionResolver({
      projectionQueries: { loadP1cProjectionSource },
    });

    await expect(resolve(envelope())).resolves.toMatchObject({
      available: false,
      localViewRequired: true,
      question: { content: null },
    });
    await expect(
      resolve(envelope("caio_advice")),
    ).resolves.toMatchObject({
      available: false,
      localViewRequired: true,
      reason: "LOCAL_VIEW_REQUIRED",
    });
    expect(loadP1cProjectionSource).toHaveBeenCalledTimes(1);
  });

  it("fails closed when the canonical question hash changed", async () => {
    const changed = source("remote_projected");
    changed.portfolio.questions[0]!.contentHash =
      `sha256:${"c".repeat(64)}`;
    const resolve = createWorkBuddyDeliveryProjectionResolver({
      projectionQueries: {
        loadP1cProjectionSource: async () => changed,
      },
    });

    await expect(resolve(envelope())).rejects.toMatchObject({
      code: "VERSION_CONFLICT",
    });
  });
});
