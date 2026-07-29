import { describe, expect, it } from "vitest";

import {
  createCaioDeliveryCursor,
  createCaioDeliveryEnvelope,
  mergeCaioDeliveryCursors,
  transitionCaioDeliveryEnvelope,
} from "./delivery-contracts";

const HASH_A = `sha256:${"a".repeat(64)}`;
const HASH_B = `sha256:${"b".repeat(64)}`;

function envelope() {
  return createCaioDeliveryEnvelope({
    deliveryObjectId: "delivery:question-1:v1",
    workspaceId: "workspace:demo",
    source: {
      schemaVersion: "helm.caio-canonical-object-ref/v1",
      objectKind: "operating_question_candidate",
      objectId: "question:1",
      objectVersion: 1,
      objectHash: HASH_A,
    },
    deliveryKey: "delivery-key:question-1",
    severity: "critical",
    category: "owner_judgement",
    triggerRuleRef: "trigger-rule:renewal-risk:v1",
    triggerSnapshotHash: HASH_B,
    validUntil: "2026-07-26T10:00:00.000Z",
    deliveryVersion: 1,
    now: "2026-07-26T08:00:00.000Z",
  });
}

describe("CAIO typed delivery contracts", () => {
  it("stores only a typed canonical ref and rejects copied prompt content", () => {
    const created = envelope();

    expect(created).toMatchObject({
      status: "pending",
      source: {
        objectKind: "operating_question_candidate",
        objectId: "question:1",
        objectHash: HASH_A,
      },
      boundary: {
        authorityEffect: "none",
        sourcePayloadCopied: false,
        canonicalMutationAuthorityGranted: false,
        externalExecutionAllowed: false,
      },
    });
    expect(JSON.stringify(created)).not.toContain("title");
    expect(JSON.stringify(created)).not.toContain("evidence");

    expect(() =>
      createCaioDeliveryEnvelope({
        deliveryObjectId: "delivery:question-1:v1",
        workspaceId: "workspace:demo",
        source: {
          schemaVersion: "helm.caio-canonical-object-ref/v1",
          objectKind: "operating_question_candidate",
          objectId: "question:1",
          objectVersion: 1,
          objectHash: HASH_A,
          title: "Copied content is forbidden",
        },
        deliveryKey: "delivery-key:question-1",
        severity: "critical",
        category: "owner_judgement",
        triggerRuleRef: "trigger-rule:renewal-risk:v1",
        triggerSnapshotHash: HASH_B,
        validUntil: "2026-07-26T10:00:00.000Z",
        deliveryVersion: 1,
        now: "2026-07-26T08:00:00.000Z",
      } as never),
    ).toThrow();
  });

  it("enforces the delivery lifecycle and terminal-state boundary", () => {
    const delivered = transitionCaioDeliveryEnvelope({
      envelope: envelope(),
      status: "delivered",
      transitionedAt: "2026-07-26T08:01:00.000Z",
    });
    const opened = transitionCaioDeliveryEnvelope({
      envelope: delivered,
      status: "opened",
      transitionedAt: "2026-07-26T08:02:00.000Z",
    });
    const answered = transitionCaioDeliveryEnvelope({
      envelope: opened,
      status: "answered",
      transitionedAt: "2026-07-26T08:03:00.000Z",
    });

    expect(answered.status).toBe("answered");
    expect(() =>
      transitionCaioDeliveryEnvelope({
        envelope: answered,
        status: "pending",
        transitionedAt: "2026-07-26T08:04:00.000Z",
      }),
    ).toThrow(/terminal/i);
    expect(() =>
      transitionCaioDeliveryEnvelope({
        envelope: envelope(),
        status: "answered",
        transitionedAt: "2026-07-26T08:01:00.000Z",
      }),
    ).toThrow(/transition/i);
  });

  it("requires a bounded snooze before returning to pending", () => {
    const delivered = transitionCaioDeliveryEnvelope({
      envelope: envelope(),
      status: "delivered",
      transitionedAt: "2026-07-26T08:01:00.000Z",
    });
    const snoozed = transitionCaioDeliveryEnvelope({
      envelope: delivered,
      status: "snoozed",
      transitionedAt: "2026-07-26T08:02:00.000Z",
      snoozedUntil: "2026-07-26T08:32:00.000Z",
    });

    expect(() =>
      transitionCaioDeliveryEnvelope({
        envelope: snoozed,
        status: "pending",
        transitionedAt: "2026-07-26T08:31:59.000Z",
      }),
    ).toThrow(/snooze/i);
    expect(
      transitionCaioDeliveryEnvelope({
        envelope: snoozed,
        status: "pending",
        transitionedAt: "2026-07-26T08:32:00.000Z",
      }).status,
    ).toBe("pending");
  });

  it("merges urgent and digest positions into one client cursor", () => {
    const base = createCaioDeliveryCursor({
      workspaceId: "workspace:demo",
      clientId: "client:workbuddy-ceo",
    });
    const critical = {
      ...base,
      criticalSequence: 4,
    };
    const normal = {
      ...base,
      normalSequence: 7,
    };

    expect(mergeCaioDeliveryCursors(critical, normal)).toMatchObject({
      workspaceId: "workspace:demo",
      clientId: "client:workbuddy-ceo",
      criticalSequence: 4,
      normalSequence: 7,
    });
    expect(() =>
      mergeCaioDeliveryCursors(critical, {
        ...normal,
        clientId: "client:other",
      }),
    ).toThrow(/binding/i);
  });
});
