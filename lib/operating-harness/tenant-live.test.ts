import { describe, expect, it } from "vitest";

import { canonicalJson, sha256 } from "../expert-capability/hashing";
import { buildTenantSelfObservationEnvelope } from "../operating-signal-governance/source-governance";
import { computeHarnessManifestContentHash, HARNESS_COMPONENT_KINDS } from "./harness-contracts";
import { validateHarnessManifest } from "./harness-validators";
import {
  computeTenantObservationReceiptContentHash,
  TENANT_OBSERVATION_RECEIPT_SCHEMA_VERSION,
  type TenantLiveHarnessManifest,
  type TenantObservationReceipt,
} from "./tenant-live-contracts";
import { validateTenantLiveHarnessManifest, validateTenantSelfObservationBinding } from "./tenant-live-validators";

function manifest(patch: Record<string, unknown> = {}): TenantLiveHarnessManifest {
  const content = {
    schemaVersion: "helm.operating-harness.manifest.v1",
    manifestId: "manifest:tenant-live-test",
    scope: "tenant_live_shadow",
    canonicalChainRef: "chain:operating-harness",
    components: HARNESS_COMPONENT_KINDS.map((kind) => ({
      componentKind: kind, componentRef: `tenant-test/${kind}`, revisionRef: `tenant-test/${kind}/v1`,
      contentHash: sha256(canonicalJson({ kind })),
    })),
    allowedSourceClasses: ["tenant_self_observation"],
    intendedUses: ["operator_triage"],
    commitmentClass: "advice",
    actionAuthority: "none",
    humanReviewRequired: true,
    automaticPromotionAllowed: false,
    externalSendAllowed: false,
    writebackAllowed: false,
    memoryPromotionAllowed: false,
    createdAt: "2026-09-16T00:00:00.000Z",
    ...patch,
  };
  return { ...content, contentHash: computeHarnessManifestContentHash(content as never) } as TenantLiveHarnessManifest;
}

function receipt(patch: Partial<TenantObservationReceipt> = {}): TenantObservationReceipt {
  const content = {
    schemaVersion: TENANT_OBSERVATION_RECEIPT_SCHEMA_VERSION,
    observationRunRef: "observation-run:abcdefabcdef",
    runStatus: "SUCCEEDED" as const,
    windowStart: "2026-09-16T01:50:00.000Z",
    windowEnd: "2026-09-16T02:00:00.000Z",
    observedAt: "2026-09-16T02:00:30.000Z",
    summaryHash: sha256("summary"),
    catalogEntryRef: "catalog-entry:abcdef",
    authorizationReceiptRef: "stage-receipt:abcdef",
    connectionReceiptRef: "stage-receipt:bcdefa",
    evidenceRefs: ["caio-evidence:aaaa", "caio-evidence:bbbb"],
    ...patch,
  };
  const { contentHash: _ignored, ...rest } = content as TenantObservationReceipt;
  return { ...rest, contentHash: computeTenantObservationReceiptContentHash(rest) };
}

const signal = {
  signalId: "caio-signal:abcdefabcdef",
  observedAt: "2026-09-16T02:00:30.000Z",
  capturedAt: "2026-09-16T02:00:30.000Z",
  evidenceRefs: ["caio-evidence:aaaa", "caio-evidence:bbbb"],
};
const source = () => buildTenantSelfObservationEnvelope({
  signalId: signal.signalId, allowedUses: ["operator_triage"], auditRefs: ["caio-quick-check:abcdef"], boundaryNote: "advice only",
});

describe("validateTenantLiveHarnessManifest", () => {
  it("accepts a complete tenant live manifest", () => {
    expect(validateTenantLiveHarnessManifest(manifest())).toEqual({ ok: true, errors: [] });
  });

  it.each([
    [{ scope: "public_offline_shadow" }],
    [{ allowedSourceClasses: ["tenant_self_observation", "synthetic_public"] }],
    [{ allowedSourceClasses: ["synthetic_public"] }],
    [{ intendedUses: ["public_eval"] }],
    [{ intendedUses: [] }],
    [{ writebackAllowed: true }],
    [{ components: manifest().components.slice(1) }],
  ])("rejects %j", (patch) => {
    expect(validateTenantLiveHarnessManifest(manifest(patch)).ok).toBe(false);
  });

  it("rejects a tampered content hash", () => {
    expect(validateTenantLiveHarnessManifest({ ...manifest(), manifestId: "manifest:other" }).errors)
      .toContain("tenant_live_harness_manifest_content_hash_mismatch");
  });

  it("is never accepted by the public manifest validator", () => {
    const errors = validateHarnessManifest(manifest()).errors;
    expect(errors).toContain("forbidden_manifest_source_class:tenant_self_observation");
    expect(errors.some((error) => error.startsWith("invalid_harness_manifest:scope"))).toBe(true);
  });
});

describe("validateTenantSelfObservationBinding", () => {
  it("accepts receipts that cover every signal evidence ref", () => {
    const split = [receipt({ evidenceRefs: ["caio-evidence:aaaa"] }), receipt({ observationRunRef: "observation-run:bcdefa", evidenceRefs: ["caio-evidence:bbbb"] })];
    expect(validateTenantSelfObservationBinding({ source: source(), observationReceipts: split, signal })).toEqual({ ok: true, errors: [] });
  });

  it.each([
    ["no receipts", { observationReceipts: [] }, "tenant_observation_receipts_required"],
    ["failed run", { observationReceipts: [{ ...receipt(), runStatus: "FAILED" }] }, "invalid_tenant_observation_receipt:0:runStatus:invalid_value"],
    ["uncovered evidence", { observationReceipts: [receipt({ evidenceRefs: ["caio-evidence:aaaa"] })] }, "tenant_observation_evidence_uncovered:caio-evidence:bbbb"],
    ["receipt window after signal", { observationReceipts: [receipt({ windowStart: "2026-09-16T02:05:00.000Z", windowEnd: "2026-09-16T02:10:00.000Z" })] }, "tenant_observation_receipt_after_signal:0"],
    ["receipt observed after capture", { observationReceipts: [receipt({ observedAt: "2026-09-16T02:01:00.000Z" })] }, "tenant_observation_receipt_observed_after_capture:0"],
    ["tampered receipt", { observationReceipts: [{ ...receipt(), summaryHash: sha256("other") }] }, "tenant_observation_receipt_content_hash_mismatch:0"],
    ["mismatched envelope", { source: { ...source(), signalId: "caio-signal:other" } }, "tenant_source_signal_mismatch"],
    ["public source class", { source: { ...source(), sourceClass: "synthetic_public" } }, "tenant_source_class_required"],
  ] as const)("rejects %s", (_label, patch, error) => {
    const base = { source: source() as unknown, observationReceipts: [receipt()] as unknown, signal };
    expect(validateTenantSelfObservationBinding({ ...base, ...patch }).errors).toContain(error);
  });
});
