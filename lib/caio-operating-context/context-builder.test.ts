import { describe, expect, it } from "vitest";

import { canonicalJson, sha256 } from "@/lib/expert-capability/hashing";
import {
  projectTemporalOperatingContext,
  validateTemporalOperatingContextSnapshotBinding,
} from "@/lib/operating-harness/context-projector";

import {
  buildCaioG0BaselineProjectionInput,
  buildCaioTenantContextProjectionInput,
  lettersFromDigest,
  type CaioContextHitRow,
  type CaioContextObservationRow,
  type CaioContextRunRow,
} from "./context-builder";
import { getCaioQuickCheckHarness } from "./context-harness";

const bucket = new Date("2026-09-16T02:00:00.000Z");
const windowStart = new Date("2026-09-16T01:50:00.000Z");
const asOf = new Date("2026-09-16T02:00:30.000Z");
const hash = (n: number) => `sha256:${n.toString(16).padStart(2, "0").repeat(32)}`;

const observations: CaioContextObservationRow[] = [
  { templateId: "dead-letters", sourceKey: "source-a", observationRunId: "run_a1", windowStart, windowEnd: bucket, observedAt: asOf, contentHash: hash(1) },
  { templateId: "closure-attempts", sourceKey: "source-b", observationRunId: "run_b1", windowStart, windowEnd: bucket, observedAt: asOf, contentHash: hash(2) },
];
const run = (id: string, catalog: string): CaioContextRunRow => ({
  id, status: "SUCCEEDED", windowStart, windowEnd: bucket, observedAt: asOf, summaryHash: hash(9),
  catalogEntryId: catalog, authorizationReceiptId: `auth_${catalog}`, connectionReceiptId: `conn_${catalog}`,
});
const runs = [run("run_a1", "catalog_a"), run("run_b1", "catalog_b")];
const hits: CaioContextHitRow[] = [
  { detectorId: "dead-letter-surge", mergeKey: "closure", objectKey: "job:closure", evidenceTemplateIds: ["dead-letters", "closure-attempts"] },
];
const build = (patch: Partial<Parameters<typeof buildCaioTenantContextProjectionInput>[0]> = {}) =>
  buildCaioTenantContextProjectionInput({ workspaceId: "cmworkspace123", tickBucketStart: bucket, windowStart, asOf, observations, hits, runs, ...patch });

describe("buildCaioTenantContextProjectionInput", () => {
  it("builds an input the P3a projector accepts and replays", () => {
    const built = build();
    if (!built.ok) throw new Error(built.reason);
    const projection = projectTemporalOperatingContext(built.input);
    expect(projection.errors).toEqual([]);
    expect(validateTemporalOperatingContextSnapshotBinding({ input: built.input, snapshot: projection.snapshot }).ok).toBe(true);
    expect(built.input.evidenceRefs).toHaveLength(2);
    expect(built.input.sourceBindings[0]).toMatchObject({ promotion: null, observationReceipts: [expect.anything(), expect.anything()] });
  });

  it("is deterministic and carries no raw internal identifiers", () => {
    const first = build();
    const second = build();
    expect(canonicalJson(first)).toBe(canonicalJson(second));
    const json = JSON.stringify(first);
    for (const raw of ["cmworkspace123", "run_a1", "catalog_a", "auth_catalog_a", "conn_catalog_a"]) expect(json).not.toContain(raw);
  });

  it("binds the metric body: changing a reading changes the snapshot", () => {
    const base = build();
    const changed = build({ observations: [{ ...observations[0], contentHash: hash(3) }, observations[1]] });
    if (!base.ok || !changed.ok) throw new Error("expected inputs");
    expect(projectTemporalOperatingContext(changed.input).snapshot?.contentHash)
      .not.toBe(projectTemporalOperatingContext(base.input).snapshot?.contentHash);
    // The metric body hash itself is the EvidenceRef source snapshot binding, not only an id seed.
    expect(base.input.evidenceRefs.map((item) => item.sourceSnapshotHash).sort()).toEqual([hash(1), hash(2)]);
  });

  it("reports no_signals without hits or when every hit cites an unknown reading", () => {
    expect(build({ hits: [] })).toEqual({ ok: false, reason: "no_signals" });
    expect(build({ observations: [observations[1]] })).toEqual({ ok: false, reason: "no_signals" });
  });

  it("drops only the hits whose evidence is unknown", () => {
    const partial = build({
      hits: [...hits, { detectorId: "attempt-drop", mergeKey: "closure", objectKey: "job:closure", evidenceTemplateIds: ["missing-template"] }],
    });
    if (!partial.ok) throw new Error(partial.reason);
    expect(partial.input.signalEvents).toHaveLength(1);
  });

  it("rejects over-limit object counts and missing runs", () => {
    const manyHits = Array.from({ length: 101 }, (_, index) => ({
      detectorId: "dead-letter-surge", mergeKey: `closure-${lettersFromDigest(hash(index), 6)}`, objectKey: `job:${lettersFromDigest(hash(index), 8)}`,
      evidenceTemplateIds: ["dead-letters"],
    }));
    expect(build({ hits: manyHits })).toEqual({ ok: false, reason: "context_limit_exceeded" });
    expect(build({ runs: [runs[0]] })).toEqual({ ok: false, reason: "evidence_run_missing" });
  });

  it("encodes digests as letters only", () => {
    expect(lettersFromDigest(hash(1))).toMatch(/^[a-p]{24}$/u);
  });
});

describe("quick-check builder regression freeze", () => {
  it("keeps the quick-check projection input byte-identical", () => {
    // Frozen before the G0 baseline builder was added; a difference means quick-check output moved.
    expect(sha256(canonicalJson(build()))).toBe("sha256:e9b8955f11a8bc153af18fecb19091f930a710000286c9baa3249fdfc3b8d756");
  });
});

describe("buildCaioG0BaselineProjectionInput", () => {
  const baselineObservations = [
    { ...observations[0], domain: "operations" },
    { ...observations[1], domain: "reach" },
    { ...observations[1], templateId: "sip-attempts", contentHash: hash(4), domain: "reach" },
  ];

  it("emits one baseline signal per known reading, grouped by domain objects, and projects replayably", () => {
    const built = buildCaioG0BaselineProjectionInput({ workspaceId: "cmworkspace123", asOf, windowStart, observations: baselineObservations, runs });
    if (!built.ok) throw new Error(built.reason);
    expect(built.input.signalEvents).toHaveLength(3);
    expect(built.input.businessObjectAliases.map((alias) => alias.sourceObjectAliasRefs[0]).sort()).toEqual(["domain:operations", "domain:reach"]);
    expect(new Set(built.input.signalEvents.map((signal) => signal.signalFamily))).toEqual(new Set(["caio.observation_baseline"]));
    const projection = projectTemporalOperatingContext(built.input);
    expect(projection.errors).toEqual([]);
    expect(validateTemporalOperatingContextSnapshotBinding({ input: built.input, snapshot: projection.snapshot }).ok).toBe(true);
    for (const raw of ["cmworkspace123", "run_a1", "catalog_a"]) expect(JSON.stringify(built)).not.toContain(raw);
  });

  it("reports no_signals without readings and evidence_run_missing without their runs", () => {
    expect(buildCaioG0BaselineProjectionInput({ workspaceId: "w", asOf, windowStart, observations: [], runs })).toEqual({ ok: false, reason: "no_signals" });
    expect(buildCaioG0BaselineProjectionInput({ workspaceId: "w", asOf, windowStart, observations: baselineObservations, runs: [runs[0]] }))
      .toEqual({ ok: false, reason: "evidence_run_missing" });
  });
});

describe("getCaioQuickCheckHarness", () => {
  it("is a fixed tenant live shadow seed", () => {
    const { manifest, revision } = getCaioQuickCheckHarness();
    expect(manifest).toMatchObject({ scope: "tenant_live_shadow", allowedSourceClasses: ["tenant_self_observation"], intendedUses: ["operator_triage"] });
    expect(revision).toMatchObject({ status: "seed", manifestHash: manifest.contentHash });
    expect(canonicalJson(getCaioQuickCheckHarness())).toBe(canonicalJson({ manifest, revision }));
  });
});
