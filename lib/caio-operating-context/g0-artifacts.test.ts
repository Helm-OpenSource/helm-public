import { describe, expect, it } from "vitest";

import { canonicalJson, sha256 } from "@/lib/expert-capability/hashing";
import {
  validateCaioEvidenceTraceArtifact,
  validateCaioMemoryRebuildReceiptArtifact,
  validateCaioSchemaMappingArtifact,
  validateCaioTemporalContextArtifact,
} from "@/lib/stage1-owner-loop/caio-initialization-artifacts";

import { buildCaioG0BaselineProjectionInput } from "./context-builder";
import {
  buildCaioG0EvidenceTraceArtifacts,
  buildCaioG0MemoryRebuildReceiptArtifact,
  buildCaioG0SchemaMappingArtifact,
  buildCaioG0TemporalContextArtifact,
} from "./g0-artifacts";

const asOf = new Date("2026-09-16T02:00:30.000Z");
const windowStart = new Date("2026-09-16T01:50:00.000Z");
const windowEnd = new Date("2026-09-16T02:00:00.000Z");
const digest = (c: string) => `sha256:${c.repeat(64)}`;

function baselineInput() {
  const built = buildCaioG0BaselineProjectionInput({
    workspaceId: "cmworkspace123", asOf, windowStart,
    observations: [{ templateId: "dead-letters", sourceKey: "s", observationRunId: "run_1", windowStart, windowEnd, observedAt: asOf, contentHash: digest("a"), domain: "operations" }],
    runs: [{ id: "run_1", status: "SUCCEEDED", windowStart, windowEnd, observedAt: asOf, summaryHash: digest("b"), catalogEntryId: "asset_1", authorizationReceiptId: "auth_1", connectionReceiptId: "conn_1" }],
  });
  if (!built.ok) throw new Error(built.reason);
  return built.input;
}

describe("buildCaioG0TemporalContextArtifact", () => {
  it("wraps a replayable baseline projection with bound hashes", () => {
    const result = buildCaioG0TemporalContextArtifact({ artifactId: "ctx_1", workspaceId: "cmworkspace123", projectionInput: baselineInput() });
    if (!result.ok) throw new Error(result.errors.join(","));
    expect(result.artifact).toMatchObject({ artifactRef: "artifact-bundle:ctx_1", workspaceRef: "workspace:cmworkspace123" });
    expect(result.artifact.projectionInputHash).toBe(sha256(canonicalJson(result.artifact.projectionInput)));
    expect(validateCaioTemporalContextArtifact(result.artifact)).toEqual({ valid: true, errors: [] });
    const tampered = { ...result.artifact, projectionInput: { ...result.artifact.projectionInput, asOf: "2026-09-16T03:00:00.000Z" } };
    expect(validateCaioTemporalContextArtifact(tampered).valid).toBe(false);
  });

  it("refuses an input the projector rejects", () => {
    const input = baselineInput();
    const result = buildCaioG0TemporalContextArtifact({ artifactId: "ctx_1", workspaceId: "w", projectionInput: { ...input, windowEnd: input.windowStart, asOf: input.windowStart } });
    expect(result.ok).toBe(false);
  });
});

describe("buildCaioG0SchemaMappingArtifact", () => {
  it("is valid and deterministic regardless of template and key order", () => {
    const a = buildCaioG0SchemaMappingArtifact({ artifactId: "map_1", assetId: "asset_1", generatedAt: asOf, templates: [{ templateId: "b", valueKeys: ["y", "x"] }, { templateId: "a", valueKeys: ["z"] }] });
    const b = buildCaioG0SchemaMappingArtifact({ artifactId: "map_1", assetId: "asset_1", generatedAt: asOf, templates: [{ templateId: "a", valueKeys: ["z"] }, { templateId: "b", valueKeys: ["x", "y"] }] });
    expect(a).toEqual(b);
    expect(a).toMatchObject({ artifactRef: "artifact-bundle:map_1", assetRef: "asset_1" });
    expect(validateCaioSchemaMappingArtifact(a)).toEqual({ valid: true, errors: [] });
  });
});

describe("buildCaioG0EvidenceTraceArtifacts", () => {
  const base = {
    assetId: "asset_1", sourceId: "source_1", runId: "run_1", authorizationReceiptRef: "auth_1", connectionReceiptRef: "conn_1",
    initializationReceiptRef: "init_1", sensitivity: "confidential" as const,
  };

  it("emits valid supervision-signal traces sorted by evidence ref and capped at the limit", () => {
    const observations = ["c", "a", "b"].map((c) => ({ evidenceRef: `caio-metric:t-${c}:x`, observedAt: asOf }));
    const traces = buildCaioG0EvidenceTraceArtifacts({ ...base, observations, limit: 2 });
    expect(traces.map((trace) => trace.evidenceRef)).toEqual(["caio-metric:t-a:x", "caio-metric:t-b:x"]);
    for (const trace of traces) {
      expect(validateCaioEvidenceTraceArtifact(trace)).toEqual({ valid: true, errors: [] });
      expect(trace).toMatchObject({ outputType: "supervision_signal", evidenceKind: "metric_observation", observationRunRef: "run_1", resolved: true });
    }
  });

  it("returns nothing for a non-positive limit", () => {
    expect(buildCaioG0EvidenceTraceArtifacts({ ...base, observations: [{ evidenceRef: "caio-metric:t:x", observedAt: asOf }], limit: 0 })).toEqual([]);
  });
});

describe("buildCaioG0MemoryRebuildReceiptArtifact", () => {
  it("binds the sorted memory bindings under a valid root hash", () => {
    const receipt = buildCaioG0MemoryRebuildReceiptArtifact({
      artifactId: "mem_1", workspaceId: "cmworkspace123", rebuiltAt: asOf,
      bindings: [{ ref: "memory-fact:b", contentHash: digest("b") }, { ref: "memory-fact:a", contentHash: digest("a") }],
    });
    expect(receipt.memoryFactBindings.map((binding) => binding.ref)).toEqual(["memory-fact:a", "memory-fact:b"]);
    expect(receipt).toMatchObject({ artifactRef: "artifact-bundle:mem_1", receiptRef: "receipt:memory-rebuild:mem_1", workspaceRef: "workspace:cmworkspace123" });
    expect(validateCaioMemoryRebuildReceiptArtifact(receipt)).toEqual({ valid: true, errors: [] });
  });
});
