import { describe, expect, it } from "vitest";

import {
  buildGovernedConnectorScopeCandidate,
  buildGovernedExternalSendDraftCandidate,
  buildGovernedMemoryCandidateProjectionReceipt,
  governedConnectorScopeCandidateSchema,
  governedExternalSendDraftCandidateSchema,
  governedMemoryCandidateProjectionReceiptSchema,
} from "@/lib/governed-intelligence/capability-closeout-contracts";

const recipientHash = `sha256:${"a".repeat(64)}`;
const messageContentHash = `sha256:${"b".repeat(64)}`;

function externalSendCandidate() {
  return buildGovernedExternalSendDraftCandidate({
    sourceArtifactBundleId: "artifact:synthetic:send-source",
    sourceArtifactReviewId: "review:synthetic:send-source",
    meetingId: "meeting:synthetic:1",
    reviewState: "candidate",
    recipientRef: "recipient:synthetic:fixed-1",
    recipientHash,
    messageContentRef: "content:synthetic:fixed-1",
    messageContentHash,
    dlpReceipt: {
      receiptRef: "receipt:synthetic:dlp-1",
      recipientHash,
      messageContentHash,
      decision: "passed",
      rulesetVersion: "synthetic-dlp-v1",
      scannedAt: "2026-07-12T08:00:00.000Z",
      rawContentStored: false,
    },
    rateLimitReceipt: {
      receiptRef: "receipt:synthetic:rate-1",
      recipientHash,
      decision: "allowed",
      checkedAt: "2026-07-12T08:00:00.000Z",
      expiresAt: "2026-07-12T08:05:00.000Z",
    },
    dedupeReceipt: {
      receiptRef: "receipt:synthetic:dedupe-1",
      recipientHash,
      messageContentHash,
      decision: "clear",
      checkedAt: "2026-07-12T08:00:00.000Z",
    },
  });
}

describe("governed external-send draft candidate", () => {
  it("binds fixed recipient and content hashes to DLP, rate-limit, and dedupe receipts", () => {
    const candidate = externalSendCandidate();

    expect(governedExternalSendDraftCandidateSchema.parse(candidate)).toEqual(
      candidate,
    );
    expect(candidate.requiredHumanClick).toBe(true);
    expect(candidate.automaticSendAllowed).toBe(false);
    expect(candidate.sendPerformed).toBe(false);
    expect(candidate.dedupeReceipt.dedupeKey).toMatch(/^send-dedupe:/);
  });

  it("rejects substituted receipts, unsafe fields, and contract-hash tampering", () => {
    const candidate = externalSendCandidate();

    expect(() =>
      governedExternalSendDraftCandidateSchema.parse({
        ...candidate,
        dlpReceipt: {
          ...candidate.dlpReceipt,
          messageContentHash: `sha256:${"c".repeat(64)}`,
        },
      }),
    ).toThrow();
    expect(() =>
      governedExternalSendDraftCandidateSchema.parse({
        ...candidate,
        sendNow: true,
      }),
    ).toThrow();
    expect(() =>
      governedExternalSendDraftCandidateSchema.parse({
        ...candidate,
        contractHash: `sha256:${"f".repeat(64)}`,
      }),
    ).toThrow();
  });
});

describe("governed connector scope candidate", () => {
  it("stays candidate-only and grants no OAuth, credential, activation, or CONNECTED transition", () => {
    const candidate = buildGovernedConnectorScopeCandidate({
      sourceArtifactBundleId: "artifact:synthetic:connector-source",
      sourceArtifactReviewId: "review:synthetic:connector-source",
      reviewState: "needs_review",
      providerRef: "provider:synthetic:crm",
      connectorClass: "crm",
      requestedScopes: ["contacts.read", "opportunities.read"],
      riskClass: "medium",
      rationale: ["Read-only opportunity evidence is missing."],
      evidenceRefs: ["evidence:synthetic:connector-1"],
      missingEvidence: ["Confirm the tenant-side OAuth owner."],
    });

    expect(governedConnectorScopeCandidateSchema.parse(candidate)).toEqual(
      candidate,
    );
    expect(candidate.requiredHumanCapability).toBe(
      "workspace.manage_connectors",
    );
    expect(candidate.oauthCompletionAllowed).toBe(false);
    expect(candidate.credentialEntryAllowed).toBe(false);
    expect(candidate.activationAllowed).toBe(false);
    expect(candidate.connectedStateTransitionAllowed).toBe(false);
  });

  it("rejects unsafe extra fields and duplicate scopes", () => {
    const candidate = buildGovernedConnectorScopeCandidate({
      sourceArtifactBundleId: "artifact:synthetic:connector-source",
      sourceArtifactReviewId: "review:synthetic:connector-source",
      reviewState: "candidate",
      providerRef: "provider:synthetic:calendar",
      connectorClass: "calendar",
      requestedScopes: ["calendar.read"],
      riskClass: "low",
      rationale: ["Read-only calendar evidence may close a signal gap."],
      evidenceRefs: ["evidence:synthetic:connector-2"],
      missingEvidence: [],
    });

    expect(() =>
      governedConnectorScopeCandidateSchema.parse({
        ...candidate,
        connectorCredential: "synthetic-secret",
      }),
    ).toThrow();
    expect(() =>
      governedConnectorScopeCandidateSchema.parse({
        ...candidate,
        requestedScopes: ["calendar.read", "calendar.read"],
      }),
    ).toThrow();
  });
});

describe("governed memory candidate projection receipt", () => {
  it("records pending verification without promotion or canonical memory writes", () => {
    const receipt = buildGovernedMemoryCandidateProjectionReceipt({
      receiptId: "receipt:synthetic:memory-projection-1",
      workspaceRef: "workspace:synthetic:1",
      sourceArtifactBundleId: "artifact:synthetic:1",
      sourceArtifactReviewId: "review:synthetic:1",
      runtimeSessionId: "runtime:synthetic:1",
      memoryCandidateId: "memory-candidate:synthetic:1",
      memoryCandidateKey: "governed-memory:synthetic:1",
      candidateStatus: "pending_verification",
      projectedAt: "2026-07-12T08:00:00.000Z",
      memoryPromotionCreated: false,
      canonicalMemoryWritten: false,
    });

    expect(
      governedMemoryCandidateProjectionReceiptSchema.parse(receipt),
    ).toEqual(receipt);
    expect(() =>
      governedMemoryCandidateProjectionReceiptSchema.parse({
        ...receipt,
        memoryPromotionCreated: true,
      }),
    ).toThrow();
  });
});
