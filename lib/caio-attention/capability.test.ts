import { describe, expect, it } from "vitest";

import {
  evaluateCaioAttentionCapability,
  isCaioAttentionLoopbackRequest,
  parseCaioAttentionCapabilityFile,
  resolveCaioAttentionNodeId,
  resolveCaioAttentionReportedCloseCapability,
} from "./capability";
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

  it("reports close capability 0 unless the close chain is bound at runtime, whatever the release file says", () => {
    const env = { HELM_RUNTIME_NODE_ID: "web-1", HELM_HEALTH_ATTESTATION_MODE: "artifact-bound", HELM_RUNTIME_DEPLOYMENT_ID: "dep-1" };
    expect(resolveCaioAttentionHeartbeat(env, "{\"closeCapabilityVersion\":1}", false)).toMatchObject({ closeCapabilityVersion: 0 });
    expect(resolveCaioAttentionReportedCloseCapability(1, false)).toBe(0);
    expect(resolveCaioAttentionReportedCloseCapability(1, true)).toBe(1);
    expect(resolveCaioAttentionReportedCloseCapability(null, true)).toBe(0);
    // The runtime binding (bound AND a registered pack policy) is covered in lib/caio-attention-runtime/close-chain-binding*.test.ts.
  });

  it("heartbeat role comes from HELM_RUNTIME_NODE_ROLE: empty is http, malformed turns the heartbeat off", () => {
    const env = { HELM_RUNTIME_NODE_ID: "caio-1", HELM_HEALTH_ATTESTATION_MODE: "artifact-bound", HELM_RUNTIME_DEPLOYMENT_ID: "dep-1" };
    expect(resolveCaioAttentionHeartbeat({ ...env, HELM_RUNTIME_NODE_ROLE: " caio " }, null, true)).toMatchObject({ role: "caio" });
    expect(resolveCaioAttentionHeartbeat({ ...env, HELM_RUNTIME_NODE_ROLE: "" }, null, true)).toMatchObject({ role: "http" });
    for (const role of ["Caio", "caio worker", "-x", "a".repeat(33)]) {
      expect(resolveCaioAttentionHeartbeat({ ...env, HELM_RUNTIME_NODE_ROLE: role }, null, true), role).toBeNull();
    }
  });
});

describe("capability probe loopback check", () => {
  const local = (headers: Record<string, string>) => isCaioAttentionLoopbackRequest(new Headers(headers));

  it("accepts a loopback Host with or without a port, IPv6 included", () => {
    for (const host of ["127.0.0.1", "127.0.0.1:3000", "localhost", "LOCALHOST:3000", "[::1]", "[::1]:3000"]) {
      expect(local({ host }), host).toBe(true);
    }
  });

  it("rejects any other Host, a missing Host and look-alike names", () => {
    for (const host of ["", "::1", "127.0.0.2", "198.51.100.5:3000", "127.0.0.1.example.com", "localhost.example.com:3000",
      "example.com", "127.0.0.1:3000:3000", "[::1]x"]) {
      expect(local({ host }), host).toBe(false);
    }
    expect(local({})).toBe(false);
  });

  it("rejects a loopback Host whenever a forwarding header is present (the load balancer always adds X-Forwarded-For)", () => {
    for (const name of ["x-forwarded-for", "X-Forwarded-Host", "x-forwarded-proto", "x-forwarded-port", "forwarded", "x-real-ip"]) {
      expect(local({ host: "127.0.0.1:3000", [name]: "203.0.113.7" }), name).toBe(false);
    }
    expect(local({ host: "127.0.0.1:3000", "x-forwarded-for": "" })).toBe(false);
  });
});
