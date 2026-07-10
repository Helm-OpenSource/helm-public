import { describe, expect, it } from "vitest";

import {
  buildPersistedPayloadDraft,
  buildVerificationDecision,
  estimateTokenCount,
  selectPayloadsForBudget,
  toPersistedPayloadContract,
} from "@/lib/helm-v2/runtime-upgrade-payloads";

describe("runtime upgrade payloads", () => {
  it("normalizes payload drafts and selects loadable context within budget", () => {
    const draft = buildPersistedPayloadDraft({
      key: "meeting-summary",
      sourceType: "meeting",
      sourceId: "meeting-1",
      label: "Meeting summary",
      loadPolicy: "always_on",
      text: "  confirmed context  ",
      loadedByDefault: true,
    });

    expect(draft?.text).toBe("confirmed context");
    const contract = toPersistedPayloadContract(draft!);
    expect(contract.estimatedTokens).toBe(estimateTokenCount("confirmed context"));
    expect(selectPayloadsForBudget([contract], contract.estimatedTokens)).toMatchObject({
      loadedHandles: [contract.handle],
      prunedHandles: [],
    });
  });

  it("drops blank payload drafts and prunes payloads one token over budget", () => {
    expect(
      buildPersistedPayloadDraft({
        key: "blank",
        sourceType: "artifact",
        sourceId: "artifact-1",
        label: "Blank artifact",
        loadPolicy: "always_on",
        text: "   \n\t  ",
        loadedByDefault: true,
      }),
    ).toBeNull();

    const draft = buildPersistedPayloadDraft({
      key: "bounded",
      sourceType: "artifact",
      sourceId: "artifact-2",
      label: "Bounded artifact",
      loadPolicy: "always_on",
      text: "12345678",
      loadedByDefault: true,
    });
    const contract = toPersistedPayloadContract(draft!);

    expect(contract.estimatedTokens).toBe(2);
    expect(selectPayloadsForBudget([contract], 1)).toMatchObject({
      tokenBudgetUsed: 0,
      loadedHandles: [],
      prunedHandles: [contract.handle],
    });
  });

  it("blocks verification when promise-sensitive risks remain", () => {
    const decision = buildVerificationDecision({
      facts: [{ title: "Confirmed", evidence: ["evidence://1"] }],
      inferredCount: 0,
      riskFlags: [{ severity: "high", promiseRisk: true }],
      promotedMemoryCount: 0,
    });

    expect(decision.status).toBe("blocked");
    expect(decision.truthScore).toBe(85);
    expect(decision.blockedReasons).toHaveLength(1);
  });

  it("requires review when confirmed facts lack evidence without promise risk", () => {
    const decision = buildVerificationDecision({
      facts: [{ title: "Unverified" }],
      inferredCount: 0,
      riskFlags: [],
      promotedMemoryCount: 0,
    });

    expect(decision.status).toBe("needs_review");
    expect(decision.truthScore).toBe(0);
    expect(decision.blockedReasons).toEqual([
      "1 confirmed facts are still missing evidence refs.",
    ]);
  });
});
