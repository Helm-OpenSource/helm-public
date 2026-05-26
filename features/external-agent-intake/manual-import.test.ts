import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { evaluateExternalAgentArtifact } from "./intake-decision";
import { loadManualImportFile } from "./manual-import";
import { EXTERNAL_AGENT_INTAKE_WORKSPACE_ID } from "./provider-fixtures";

const DEMO_FILE = path.resolve(
  __dirname,
  "../../evals/external-agent-intake/manual-import-demo.json",
);

function writeTempJson(content: string | object, filename = "input.json"): string {
  const dir = mkdtempSync(path.join(tmpdir(), "helm-eai-manual-import-"));
  const filePath = path.join(dir, filename);
  const payload = typeof content === "string" ? content : JSON.stringify(content);
  writeFileSync(filePath, payload, "utf-8");
  return filePath;
}

function baseArtifactPayload(overrides: Record<string, unknown> = {}) {
  return {
    artifactId: "MID-TEST",
    workspaceId: EXTERNAL_AGENT_INTAKE_WORKSPACE_ID,
    providerId: "openclaw_local",
    artifactKind: "evidence_candidate",
    createdAt: "2026-05-01T00:00:00.000Z",
    sourceTimestamp: "2026-04-30T11:00:00.000Z",
    actorRef: "operator:test",
    objectRef: { type: "meeting", id: "meeting_test" },
    actorVisibleSummary: "Test artifact",
    rawOutputHash: "sha256:test",
    redactionStatus: "alias_only",
    providerTraceRefs: ["trace:test"],
    citationsOrEvidenceRefs: ["evidence:test"],
    declaredSideEffects: ["read"],
    contentSummary: "Test content summary",
    contentShape: "text",
    ...overrides,
  };
}

describe("manual-import loader", () => {
  it("loads the bundled demo file with the documented expected dispositions", () => {
    const result = loadManualImportFile(DEMO_FILE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.metadata.workspaceId).toBe(EXTERNAL_AGENT_INTAKE_WORKSPACE_ID);
    expect(result.artifacts).toHaveLength(6);

    for (const loaded of result.artifacts) {
      const decision = evaluateExternalAgentArtifact(loaded.artifact, {
        expectedWorkspaceId:
          result.metadata.workspaceId ?? EXTERNAL_AGENT_INTAKE_WORKSPACE_ID,
        referenceTimeIso: result.metadata.referenceTimeIso,
      });
      expect(decision.mayCreateMustPushCandidate).toBe(false);
      expect(decision.mayCreateMemoryCandidate).toBe(false);
      if (loaded.expectedDisposition) {
        expect(decision.disposition, loaded.artifact.artifactId).toBe(
          loaded.expectedDisposition,
        );
      }
    }
  });

  it("rejects invalid JSON with a safe error message and no thrown parser error", () => {
    const filePath = writeTempJson("{ this is not json", "broken.json");
    const result = loadManualImportFile(filePath);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(" ")).toMatch(/not valid JSON/i);
  });

  it("rejects an artifact with a missing required field", () => {
    const payload = baseArtifactPayload();
    delete (payload as { rawOutputHash?: unknown }).rawOutputHash;
    const filePath = writeTempJson({ artifacts: [payload] });
    const result = loadManualImportFile(filePath);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((error) => /rawOutputHash/.test(error))).toBe(true);
  });

  it("loads an artifact with an unknown provider so the evaluator can reject it downstream", () => {
    const payload = baseArtifactPayload({
      artifactId: "MID-UNKNOWN",
      providerId: "totally_made_up_provider",
    });
    const filePath = writeTempJson({ artifacts: [payload] });
    const result = loadManualImportFile(filePath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const decision = evaluateExternalAgentArtifact(result.artifacts[0]!.artifact, {
      expectedWorkspaceId: EXTERNAL_AGENT_INTAKE_WORKSPACE_ID,
    });
    expect(decision.disposition).toBe("reject");
    expect(decision.reasonCodes).toContain("provider_profile_missing");
  });

  it("quarantines a cross-tenant artifact when --workspace-id differs from the artifact workspace", () => {
    const payload = baseArtifactPayload({
      artifactId: "MID-XTENANT",
      workspaceId: "workspace_other_tenant",
    });
    const filePath = writeTempJson({
      metadata: { workspaceId: EXTERNAL_AGENT_INTAKE_WORKSPACE_ID },
      artifacts: [payload],
    });
    const result = loadManualImportFile(filePath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const decision = evaluateExternalAgentArtifact(result.artifacts[0]!.artifact, {
      expectedWorkspaceId: EXTERNAL_AGENT_INTAKE_WORKSPACE_ID,
    });
    expect(decision.disposition).toBe("quarantine");
    expect(decision.reasonCodes).toContain("cross_tenant_risk");
  });

  it("quarantines an artifact whose redactionStatus is contains_pii", () => {
    const payload = baseArtifactPayload({
      artifactId: "MID-PII",
      redactionStatus: "contains_pii",
    });
    const filePath = writeTempJson({ artifacts: [payload] });
    const result = loadManualImportFile(filePath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const decision = evaluateExternalAgentArtifact(result.artifacts[0]!.artifact, {
      expectedWorkspaceId: EXTERNAL_AGENT_INTAKE_WORKSPACE_ID,
    });
    expect(decision.disposition).toBe("quarantine");
    expect(decision.reasonCodes).toContain("contains_pii");
  });

  it("quarantines an artifact that declares external_write_attempted", () => {
    const payload = baseArtifactPayload({
      artifactId: "MID-EXTWRITE",
      artifactKind: "workflow_trace",
      declaredSideEffects: ["external_write_attempted"],
      contentSummary: "Provider claims CRM updated externally; quarantine expected.",
    });
    const filePath = writeTempJson({ artifacts: [payload] });
    const result = loadManualImportFile(filePath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const decision = evaluateExternalAgentArtifact(result.artifacts[0]!.artifact, {
      expectedWorkspaceId: EXTERNAL_AGENT_INTAKE_WORKSPACE_ID,
    });
    expect(decision.disposition).toBe("quarantine");
    expect(decision.reasonCodes).toContain("authority_exceeded");
  });

  it("accepts the array-form payload as well as the object-form payload", () => {
    const arrayPayload = [baseArtifactPayload({ artifactId: "MID-ARRAY" })];
    const filePath = writeTempJson(arrayPayload);
    const result = loadManualImportFile(filePath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.artifacts[0]!.artifact.artifactId).toBe("MID-ARRAY");
  });

  it("returns a safe error when the file path does not exist", () => {
    const result = loadManualImportFile(
      path.join(tmpdir(), "definitely-not-a-real-helm-file.json"),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(" ")).toMatch(/file not found|unreadable file/);
  });
});
