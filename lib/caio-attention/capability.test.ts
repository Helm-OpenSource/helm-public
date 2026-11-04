import { describe, expect, it } from "vitest";

import { evaluateCaioAttentionCapability, parseCaioAttentionCapabilityFile, resolveCaioAttentionNodeId } from "./capability";
import { resolveCaioAttentionHeartbeat } from "./heartbeat.service";

const report = { nodeId: "web-1", deploymentId: "dep-1", closeCapabilityVersion: 1, pageServiceBound: true, lifecycleRoutes: true, migrationReady: true };
const expected = { nodeId: "web-1", deploymentId: "dep-1", requiredCloseCapability: 1 };

describe("close-capability probe", () => {
  it("reads capability.json: absent is 0, the versioned format is read, malformed fails closed", () => {
    expect(parseCaioAttentionCapabilityFile(null)).toBe(0);
    expect(parseCaioAttentionCapabilityFile("{\"schemaVersion\":\"caio-attention-capability/v1\",\"closeCapabilityVersion\":1}")).toBe(1);
    for (const text of ["{", "[]", "null", "{\"closeCapabilityVersion\":-1}", "{\"closeCapabilityVersion\":\"1\"}", "{\"closeCapabilityVersion\":1.5}"]) {
      expect(parseCaioAttentionCapabilityFile(text), text).toBeNull();
    }
  });

  it("attests only a fully bound node: an unbound page service blocks even at capability 1", () => {
    expect(evaluateCaioAttentionCapability(report, expected)).toEqual([]);
    expect(evaluateCaioAttentionCapability({ ...report, pageServiceBound: false }, expected)).toEqual(["page_service_unbound"]);
    expect(evaluateCaioAttentionCapability({ ...report, closeCapabilityVersion: 1 }, { ...expected, requiredCloseCapability: 2 })).toEqual(["capability_too_low"]);
    expect(evaluateCaioAttentionCapability({ ...report, closeCapabilityVersion: 0 }, { ...expected, requiredCloseCapability: 0 })).toEqual(["capability_too_low"]);
    expect(evaluateCaioAttentionCapability({ ...report, closeCapabilityVersion: "1" as unknown as number }, expected)).toEqual(["capability_too_low"]);
    expect(evaluateCaioAttentionCapability({ ...report, nodeId: null, deploymentId: null }, expected)).toEqual(["node_mismatch", "deployment_mismatch"]);
  });

  it("heartbeat is off without a node id or an artifact-bound deployment id", () => {
    const env = { HELM_RUNTIME_NODE_ID: "web-1", HELM_HEALTH_ATTESTATION_MODE: "artifact-bound", HELM_RUNTIME_DEPLOYMENT_ID: "dep-1" };
    expect(resolveCaioAttentionNodeId({ HELM_RUNTIME_NODE_ID: "bad id" })).toBeNull();
    expect(resolveCaioAttentionHeartbeat({ ...env, HELM_RUNTIME_NODE_ID: undefined }, null, true)).toBeNull();
    expect(resolveCaioAttentionHeartbeat({ ...env, HELM_HEALTH_ATTESTATION_MODE: undefined }, null, true)).toBeNull();
    expect(resolveCaioAttentionHeartbeat({ ...env, HELM_CAIO_ATTENTION_REMINDERS_ENABLED: "true" }, "{\"closeCapabilityVersion\":1}", true))
      .toEqual({ nodeId: "web-1", role: "http", deploymentId: "dep-1", closeCapabilityVersion: 1, remindersEnabled: true });
    expect(resolveCaioAttentionHeartbeat(env, "{", true)).toMatchObject({ closeCapabilityVersion: 0, remindersEnabled: false });
  });

  it("heartbeat reports close capability 0 while no attention pack policy is registered, whatever the release file says", () => {
    const env = { HELM_RUNTIME_NODE_ID: "web-1", HELM_HEALTH_ATTESTATION_MODE: "artifact-bound", HELM_RUNTIME_DEPLOYMENT_ID: "dep-1" };
    expect(resolveCaioAttentionHeartbeat(env, "{\"closeCapabilityVersion\":1}", false)).toMatchObject({ closeCapabilityVersion: 0 });
  });
});
