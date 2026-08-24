import { describe, expect, it } from "vitest";
import {
  DeploymentCapabilityDisabledError,
  assertDeploymentCapabilityEnabled,
  getDeploymentCapabilityDecision,
  isDeploymentCapabilityEnabled,
} from "@/lib/runtime/deployment-capabilities";

describe("deployment capability policy", () => {
  const controls = [
    ["llm_provider", "LLM_ENABLED"],
    ["outbound_voice_asr", "HELM_OUTBOUND_VOICE_ASR_ENABLED"],
    ["engineering_review_cron", "ENGINEERING_REVIEW_CRON_ENABLED"],
    ["signal_runtime_write", "HELM_SIGNAL_RUNTIME_WRITES_ENABLED"],
    ["dingtalk_sync", "DINGTALK_RUNTIME_SYNC_ENABLED"],
    ["dingtalk_bridge", "DINGTALK_WORKFLOW_BRIDGE_ENABLED"],
    ["customer_visible_send", "HELM_CUSTOMER_VISIBLE_SENDS_ENABLED"],
    ["automated_customer_call", "HELM_AUTOMATED_CUSTOMER_CALLS_ENABLED"],
    ["sms_send", "HELM_SMS_SENDS_ENABLED"],
    ["financial_action", "HELM_FINANCIAL_ACTIONS_ENABLED"],
  ] as const;

  it.each([
    "llm_provider",
    "engineering_review_cron",
    "signal_runtime_write",
    "dingtalk_sync",
    "dingtalk_bridge",
    "customer_visible_send",
    "financial_action",
  ] as const)("preserves legacy behavior for existing %s capability", (capability) => {
    expect(getDeploymentCapabilityDecision(capability, {})).toMatchObject({
      allowed: true,
      reason: "legacy_default_enabled",
    });
  });

  it.each([
    "outbound_voice_asr",
    "automated_customer_call",
    "sms_send",
  ] as const)(
    "keeps unbound high-risk %s capability disabled when absent",
    (capability) => {
      expect(getDeploymentCapabilityDecision(capability, {})).toMatchObject({
        allowed: false,
        reason: "safe_default_disabled",
      });
    },
  );

  it("keeps capability controls independent", () => {
    const env = {
      LLM_ENABLED: "false",
      HELM_OUTBOUND_VOICE_ASR_ENABLED: "false",
      ENGINEERING_REVIEW_CRON_ENABLED: "true",
      HELM_SIGNAL_RUNTIME_WRITES_ENABLED: "true",
      DINGTALK_RUNTIME_SYNC_ENABLED: "true",
      DINGTALK_WORKFLOW_BRIDGE_ENABLED: "true",
      HELM_CUSTOMER_VISIBLE_SENDS_ENABLED: "true",
      HELM_AUTOMATED_CUSTOMER_CALLS_ENABLED: "false",
      HELM_SMS_SENDS_ENABLED: "false",
      HELM_FINANCIAL_ACTIONS_ENABLED: "false",
    };

    expect(isDeploymentCapabilityEnabled("llm_provider", env)).toBe(false);
    expect(isDeploymentCapabilityEnabled("outbound_voice_asr", env)).toBe(false);
    expect(isDeploymentCapabilityEnabled("engineering_review_cron", env)).toBe(true);
    expect(isDeploymentCapabilityEnabled("signal_runtime_write", env)).toBe(true);
    expect(isDeploymentCapabilityEnabled("dingtalk_sync", env)).toBe(true);
    expect(isDeploymentCapabilityEnabled("dingtalk_bridge", env)).toBe(true);
    expect(isDeploymentCapabilityEnabled("customer_visible_send", env)).toBe(true);
    expect(isDeploymentCapabilityEnabled("automated_customer_call", env)).toBe(false);
    expect(isDeploymentCapabilityEnabled("sms_send", env)).toBe(false);
    expect(isDeploymentCapabilityEnabled("financial_action", env)).toBe(false);
  });

  it.each(controls)(
    "parses only strict case-insensitive booleans for %s",
    (capability, envKey) => {
      expect(
        getDeploymentCapabilityDecision(capability, { [envKey]: " TRUE " }),
      ).toMatchObject({
        allowed: true,
        envKey,
        reason: "explicitly_enabled",
      });
      expect(
        getDeploymentCapabilityDecision(capability, { [envKey]: "false" }),
      ).toMatchObject({ allowed: false, reason: "explicitly_disabled" });
      expect(
        getDeploymentCapabilityDecision(capability, { [envKey]: "yes" }),
      ).toMatchObject({ allowed: false, reason: "invalid_control" });
    },
  );

  it("throws a stable public-safe error without exposing configuration values", () => {
    const run = () =>
      assertDeploymentCapabilityEnabled("financial_action", {
        HELM_FINANCIAL_ACTIONS_ENABLED: "unexpected-sensitive-value",
      });

    expect(run).toThrow(DeploymentCapabilityDisabledError);
    expect(run).toThrow("deployment_capability_disabled:financial_action");
  });
});
