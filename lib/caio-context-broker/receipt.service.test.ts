import { describe, expect, it } from "vitest";

import { evaluateContextCandidate } from "@/lib/caio-context-broker/evaluation-pipeline";
import {
  buildContextReceipt,
  caioContextReceiptSchema,
  createInMemoryContextReceiptStore,
  type ContextReceiptSourceInput,
} from "@/lib/caio-context-broker/receipt.service";

const NOW = new Date("2026-07-29T10:00:00.000Z");

function sourceInput(
  overrides: Partial<ContextReceiptSourceInput> = {},
): ContextReceiptSourceInput {
  return {
    sourceProject: "proj-b",
    sourceRef: "doc:review-notes",
    sourceVersionOrContentHash: `sha256:${"a".repeat(64)}`,
    classification: "internal",
    redactionState: "none",
    receiptId: "caio-context-receipt:seed",
    ...overrides,
  };
}

function receipt(requestId = "req-1") {
  return buildContextReceipt({
    workspaceId: "ws-1",
    userRef: "user:a",
    requestId,
    decision: "ALLOW",
    policyVersion: "policy-v1",
    ruleHits: [],
    sources: [sourceInput(), sourceInput({ sourceRef: "doc:other" })],
    redactionReliable: true,
    now: NOW,
  });
}

describe("buildContextReceipt", () => {
  it("assigns ordered citation labels and a verifiable content hash", () => {
    const built = receipt();
    expect(built.sources.map((source) => source.citationLabel)).toEqual([
      "[CAIO:S1]",
      "[CAIO:S2]",
    ]);
    expect(built.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(() => caioContextReceiptSchema.parse(built)).not.toThrow();
  });

  it("is deterministic for the same workspace/request", () => {
    expect(receipt().id).toBe(receipt().id);
    expect(receipt("req-other").id).not.toBe(receipt().id);
  });

  it("never contains the evaluated secret content — hashes and refs only", () => {
    const seededSecret = "sk-seededsecretvalue0000000000";
    const evaluation = evaluateContextCandidate({
      workspaceId: "ws-1",
      requestingProject: "proj-a",
      source: {
        sourceProject: "proj-b",
        sourceRef: "doc:secret-note",
        classification: "internal",
      },
      content: `credential ${seededSecret} for staging`,
      eligibility: {
        identityAuthenticated: true,
        workspaceEligible: true,
        projectEligible: true,
        sourceIpAllowed: true,
        userCanAccessSource: true,
      },
      rules: [],
      policyVersion: "policy-v1",
    });
    const built = buildContextReceipt({
      workspaceId: "ws-1",
      userRef: "user:a",
      requestId: "req-secret",
      decision: evaluation.decision,
      policyVersion: "policy-v1",
      ruleHits: evaluation.ruleHits,
      sources: [sourceInput({ sourceRef: "doc:secret-note" })],
      redactionReliable: evaluation.redactionReliable,
      now: NOW,
    });
    expect(JSON.stringify(built)).not.toContain(seededSecret);
  });
});

describe("in-memory receipt store", () => {
  it("writes once per requestId and rejects a re-write with a typed conflict", async () => {
    const store = createInMemoryContextReceiptStore();
    const built = receipt();
    await store.writeReceipt(built);
    await expect(store.writeReceipt(built)).rejects.toMatchObject({
      name: "CaioContextBrokerError",
      code: "caio_receipt_conflict",
    });
  });

  it("read path returns the stored receipt as the citation source of truth", async () => {
    const store = createInMemoryContextReceiptStore();
    const built = receipt();
    await store.writeReceipt(built);
    const read = await store.readReceipt({
      workspaceId: "ws-1",
      requestId: built.requestId,
    });
    expect(read).not.toBeNull();
    expect(read!.contentHash).toBe(built.contentHash);
    expect(read!.sources.map((source) => source.citationLabel)).toEqual([
      "[CAIO:S1]",
      "[CAIO:S2]",
    ]);
    expect(
      await store.readReceipt({ workspaceId: "ws-1", requestId: "missing" }),
    ).toBeNull();
    expect(
      await store.readReceipt({
        workspaceId: "ws-other",
        requestId: built.requestId,
      }),
    ).toBeNull();
  });
});
