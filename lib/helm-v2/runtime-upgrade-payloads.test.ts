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
});
