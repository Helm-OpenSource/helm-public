import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AskHelmAssetCaptureNotImplementedError,
  assertNoChatHistoryInPayload,
  captureAskHelmAssetCandidate,
  captureAskHelmAssetCandidateWithFallback,
  type AskHelmAssetCaptureInput,
} from "@/features/business-advancement/runtime/ask-helm-asset-capture";
import { BusinessAdvancementInvariantViolationError } from "@/lib/business-advancement/invariant-guards";

const ORIGINAL_ENV = { ...process.env };

function buildInput(
  overrides: Partial<AskHelmAssetCaptureInput> = {},
): AskHelmAssetCaptureInput {
  return {
    workspaceId: "ws-1",
    interactionId: "intr-1",
    candidateKind: "repeated_intent",
    candidatePayload: {
      title: "Repeated intent on contract review",
      occurrences: 3,
      ruleVersion: "ask-helm-interaction-capture-thresholds/v1",
    },
    triggeringUserId: "user-1",
    ...overrides,
  };
}

describe("ask-helm asset capture (scaffold)", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.BUSINESS_ADVANCEMENT_RUNTIME_ENABLED;
    delete process.env.BUSINESS_ADVANCEMENT_RUNTIME_ALLOWLIST;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("returns disabled with reason flag_off when neither env is set", async () => {
    const result = await captureAskHelmAssetCandidate(buildInput());
    expect(result).toEqual({ state: "disabled", reason: "flag_off" });
  });

  it("returns disabled with workspace_not_in_allowlist when flag is on but workspace missing", async () => {
    process.env.BUSINESS_ADVANCEMENT_RUNTIME_ENABLED = "true";
    process.env.BUSINESS_ADVANCEMENT_RUNTIME_ALLOWLIST = "ws-other";
    const result = await captureAskHelmAssetCandidate(buildInput());
    expect(result).toEqual({
      state: "disabled",
      reason: "workspace_not_in_allowlist",
    });
  });

  it("throws AskHelmAssetCaptureNotImplementedError when gated fully on (scaffold)", async () => {
    process.env.BUSINESS_ADVANCEMENT_RUNTIME_ENABLED = "true";
    process.env.BUSINESS_ADVANCEMENT_RUNTIME_ALLOWLIST = "ws-1";
    await expect(captureAskHelmAssetCandidate(buildInput())).rejects.toBeInstanceOf(
      AskHelmAssetCaptureNotImplementedError,
    );
  });

  it("rejects mis-shaped payload even when gated off", async () => {
    await expect(
      captureAskHelmAssetCandidate(
        buildInput({
          candidatePayload: {
            title: "should fail",
            chatHistory: [{ role: "user", content: "hi" }],
          },
        }),
      ),
    ).rejects.toBeInstanceOf(BusinessAdvancementInvariantViolationError);
  });

  it("fallback helper returns null for disabled and not-implemented states", async () => {
    // disabled
    const r1 = await captureAskHelmAssetCandidateWithFallback(buildInput());
    expect(r1).toEqual({ state: "disabled", reason: "flag_off" });

    // gated on, scaffold throws → fallback returns null
    process.env.BUSINESS_ADVANCEMENT_RUNTIME_ENABLED = "true";
    process.env.BUSINESS_ADVANCEMENT_RUNTIME_ALLOWLIST = "ws-1";
    const r2 = await captureAskHelmAssetCandidateWithFallback(buildInput());
    expect(r2).toBeNull();
  });

  it("fallback helper still propagates invariant violations", async () => {
    await expect(
      captureAskHelmAssetCandidateWithFallback(
        buildInput({
          candidatePayload: { rawPrompt: "what's the weather" },
        }),
      ),
    ).rejects.toBeInstanceOf(BusinessAdvancementInvariantViolationError);
  });

  describe("assertNoChatHistoryInPayload", () => {
    it("accepts structured payload without forbidden keys", () => {
      expect(() =>
        assertNoChatHistoryInPayload({ title: "ok", occurrences: 3 }),
      ).not.toThrow();
    });

    it("rejects every forbidden key shape", () => {
      const forbidden = [
        "chatHistory",
        "conversationTurns",
        "rawPrompt",
        "rawAnswer",
        "userMessages",
        "assistantMessages",
        "transcriptText",
      ];
      for (const key of forbidden) {
        expect(() => assertNoChatHistoryInPayload({ [key]: "..." }))
          .toThrowError(BusinessAdvancementInvariantViolationError);
      }
    });
  });
});
