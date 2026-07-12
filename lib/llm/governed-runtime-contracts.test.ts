import { describe, expect, it } from "vitest";

import {
  capabilityGrantSchema,
  contextEgressDecisionReceiptSchema,
  evaluateCapabilityGrant,
  privateContextAdapterManifestSchema,
  privateContextBuildReceiptSchema,
  runtimeIsolationProfileSchema,
  validatePrivateContextAdapterConformance,
} from "@/lib/llm/governed-runtime-contracts";

const manifest = {
  contractVersion: "helm.private-context-adapter/v1",
  adapterKey: "helm-self-operating-context",
  adapterVersion: "1.0.0",
  sourceClasses: ["temporal_operating_context"],
  readPosture: "derived_read_only",
  isolationProfileRef: "isolation:helm-self-read-adapter",
  outputContract: "RichLocalContextBundle",
  policyVersion: "policy:helm-self-context:v1",
  projectionRequired: true,
  rawEgressAllowed: false,
  sideEffectAllowed: false,
  providerCallAllowed: false,
} as const;

const buildReceipt = {
  receiptId: "receipt:helm-self-context:1",
  bundleId: "bundle:helm-self-context:1",
  adapterKey: manifest.adapterKey,
  adapterVersion: manifest.adapterVersion,
  sourceSnapshotRefs: [
    {
      refId: "context:operating-snapshot:1",
      sourceHash: "sha256:operating-snapshot-1",
    },
  ],
  redactionStatus: "redacted",
  promptInjectionScanStatus: "passed",
  derivedSummaryCount: 3,
  rawContentIncluded: false,
  credentialIncluded: false,
  tenantUrlIncluded: false,
  providerCalled: false,
  sideEffectAttempted: false,
  createdAt: "2026-07-12T08:00:00.000Z",
} as const;

describe("governed runtime private-context contracts", () => {
  it("accepts a read-only adapter manifest and rejects unknown fields", () => {
    expect(privateContextAdapterManifestSchema.parse(manifest)).toEqual(manifest);
    expect(() =>
      privateContextAdapterManifestSchema.parse({
        ...manifest,
        connectionString: "private-value",
      }),
    ).toThrow();
  });

  it("keeps build receipts reference-only and strict", () => {
    expect(privateContextBuildReceiptSchema.parse(buildReceipt)).toEqual(buildReceipt);
    expect(() =>
      privateContextBuildReceiptSchema.parse({
        ...buildReceipt,
        rawSourceText: "must not persist",
      }),
    ).toThrow();
  });

  it("fails conformance on adapter mismatch or an injection-scan failure", () => {
    expect(
      validatePrivateContextAdapterConformance({ manifest, buildReceipt }),
    ).toEqual({ ok: true, errors: [] });

    const mismatch = validatePrivateContextAdapterConformance({
      manifest,
      buildReceipt: { ...buildReceipt, adapterVersion: "2.0.0" },
    });
    expect(mismatch.ok).toBe(false);
    expect(mismatch.errors).toContain("adapter_version_mismatch");

    const failedScan = validatePrivateContextAdapterConformance({
      manifest,
      buildReceipt: {
        ...buildReceipt,
        promptInjectionScanStatus: "failed",
      },
    });
    expect(failedScan.ok).toBe(false);
    expect(failedScan.errors).toContain("prompt_injection_scan_not_passed");

    const keyMismatch = validatePrivateContextAdapterConformance({
      manifest,
      buildReceipt: { ...buildReceipt, adapterKey: "other-adapter" },
    });
    expect(keyMismatch.ok).toBe(false);
    expect(keyMismatch.errors).toContain("adapter_key_mismatch");
  });

  it("allows projected remote egress only with consent, preview, and audit", () => {
    expect(
      contextEgressDecisionReceiptSchema.parse({
        receiptId: "receipt:egress:1",
        sourceBundleId: buildReceipt.bundleId,
        contextProjectionReceiptId: "receipt:projection:1",
        modelProfileKey: "remote-projected-review",
        consentGranted: true,
        promptPreviewHash: "sha256:prompt-preview-1",
        auditRef: "audit:egress:1",
        redactionStatus: "redacted",
        decision: "allow_projected",
        reason: "allowed_projected",
        rawContentIncluded: false,
        credentialIncluded: false,
        tenantUrlIncluded: false,
      }),
    ).toBeTruthy();

    expect(() =>
      contextEgressDecisionReceiptSchema.parse({
        receiptId: "receipt:egress:2",
        sourceBundleId: buildReceipt.bundleId,
        contextProjectionReceiptId: "receipt:projection:2",
        modelProfileKey: "remote-projected-review",
        consentGranted: false,
        promptPreviewHash: null,
        auditRef: null,
        redactionStatus: "redacted",
        decision: "allow_projected",
        reason: "allowed_projected",
        rawContentIncluded: false,
        credentialIncluded: false,
        tenantUrlIncluded: false,
      }),
    ).toThrow();

    expect(
      contextEgressDecisionReceiptSchema.parse({
        receiptId: "receipt:egress:blocked",
        sourceBundleId: buildReceipt.bundleId,
        contextProjectionReceiptId: "receipt:projection:blocked",
        modelProfileKey: "remote-projected-review",
        consentGranted: false,
        promptPreviewHash: null,
        auditRef: null,
        redactionStatus: "redacted",
        decision: "block",
        reason: "consent_missing",
        rawContentIncluded: false,
        credentialIncluded: false,
        tenantUrlIncluded: false,
      }),
    ).toBeTruthy();
  });
});

describe("governed runtime isolation and capability contracts", () => {
  it("rejects a review worker that can access credentials or side effects", () => {
    expect(
      runtimeIsolationProfileSchema.parse({
        profileKey: "isolation:review-worker:v1",
        kind: "review_worker",
        nonRoot: true,
        readOnlyRootFs: true,
        networkPolicy: "egress_proxy_only",
        credentialAccess: "none",
        modelSdkAllowed: true,
        sideEffectAllowed: false,
        resourceLimits: {
          maxCpuMillicores: 1000,
          maxMemoryMb: 1024,
          maxPids: 64,
          maxWallClockSeconds: 900,
        },
      }),
    ).toBeTruthy();

    expect(() =>
      runtimeIsolationProfileSchema.parse({
        profileKey: "isolation:unsafe-review-worker",
        kind: "review_worker",
        nonRoot: true,
        readOnlyRootFs: true,
        networkPolicy: "target_allowlist",
        credentialAccess: "target_executor_only",
        modelSdkAllowed: true,
        sideEffectAllowed: true,
        resourceLimits: {
          maxCpuMillicores: 1000,
          maxMemoryMb: 1024,
          maxPids: 64,
          maxWallClockSeconds: 900,
        },
      }),
    ).toThrow();
  });

  it("enforces read-adapter and side-effect-executor isolation postures", () => {
    expect(
      runtimeIsolationProfileSchema.parse({
        profileKey: "isolation:read-adapter:v1",
        kind: "read_adapter",
        nonRoot: true,
        readOnlyRootFs: true,
        networkPolicy: "target_allowlist",
        credentialAccess: "read_source_only",
        modelSdkAllowed: false,
        sideEffectAllowed: false,
        resourceLimits: {
          maxCpuMillicores: 500,
          maxMemoryMb: 512,
          maxPids: 32,
          maxWallClockSeconds: 300,
        },
      }),
    ).toBeTruthy();
    expect(() =>
      runtimeIsolationProfileSchema.parse({
        profileKey: "isolation:read-adapter-with-model",
        kind: "read_adapter",
        nonRoot: true,
        readOnlyRootFs: true,
        networkPolicy: "none",
        credentialAccess: "none",
        modelSdkAllowed: true,
        sideEffectAllowed: false,
        resourceLimits: {
          maxCpuMillicores: 500,
          maxMemoryMb: 512,
          maxPids: 32,
          maxWallClockSeconds: 300,
        },
      }),
    ).toThrow();

    expect(
      runtimeIsolationProfileSchema.parse({
        profileKey: "isolation:side-effect-executor:v1",
        kind: "side_effect_executor",
        nonRoot: true,
        readOnlyRootFs: true,
        networkPolicy: "target_allowlist",
        credentialAccess: "target_executor_only",
        modelSdkAllowed: false,
        sideEffectAllowed: true,
        resourceLimits: {
          maxCpuMillicores: 500,
          maxMemoryMb: 512,
          maxPids: 32,
          maxWallClockSeconds: 300,
        },
      }),
    ).toBeTruthy();
    expect(() =>
      runtimeIsolationProfileSchema.parse({
        profileKey: "isolation:side-effect-executor-with-model",
        kind: "side_effect_executor",
        nonRoot: true,
        readOnlyRootFs: true,
        networkPolicy: "target_allowlist",
        credentialAccess: "target_executor_only",
        modelSdkAllowed: true,
        sideEffectAllowed: true,
        resourceLimits: {
          maxCpuMillicores: 500,
          maxMemoryMb: 512,
          maxPids: 32,
          maxWallClockSeconds: 300,
        },
      }),
    ).toThrow();
  });

  it("evaluates grants fail-closed for expiry, mismatch, revocation, and side effects", () => {
    const grant = capabilityGrantSchema.parse({
      grantRef: "grant:helm-self-review:1",
      principalRef: "worker:helm-self-review",
      capabilityRef: "review:operating-context",
      scopeRef: "workspace:helm-self",
      effectMode: "review_required",
      policyVersion: "policy:helm-self-context:v1",
      isolationProfileRef: "isolation:review-worker:v1",
      entitlementRef: null,
      killSwitchRef: null,
      issuedAt: "2026-07-12T08:00:00.000Z",
      expiresAt: "2026-07-12T09:00:00.000Z",
      revokedAt: null,
    });

    expect(
      evaluateCapabilityGrant({
        grant,
        principalRef: grant.principalRef,
        capabilityRef: grant.capabilityRef,
        scopeRef: grant.scopeRef,
        at: "2026-07-12T08:30:00.000Z",
      }),
    ).toMatchObject({ decision: "allow_review", reason: "allowed" });

    expect(
      evaluateCapabilityGrant({
        grant,
        principalRef: grant.principalRef,
        capabilityRef: grant.capabilityRef,
        scopeRef: grant.scopeRef,
        at: "2026-07-12T10:00:00.000Z",
      }),
    ).toMatchObject({ decision: "deny", reason: "expired" });

    expect(
      evaluateCapabilityGrant({
        grant: { ...grant, revokedAt: "2026-07-12T08:10:00.000Z" },
        principalRef: grant.principalRef,
        capabilityRef: grant.capabilityRef,
        scopeRef: grant.scopeRef,
        at: "2026-07-12T08:30:00.000Z",
      }),
    ).toMatchObject({ decision: "deny", reason: "revoked" });

    expect(
      evaluateCapabilityGrant({
        grant,
        principalRef: "worker:other",
        capabilityRef: grant.capabilityRef,
        scopeRef: grant.scopeRef,
        at: "2026-07-12T08:30:00.000Z",
      }),
    ).toMatchObject({ decision: "deny", reason: "principal_mismatch" });

    expect(
      evaluateCapabilityGrant({
        grant: { ...grant, effectMode: "blocked_side_effect" },
        principalRef: grant.principalRef,
        capabilityRef: grant.capabilityRef,
        scopeRef: grant.scopeRef,
        at: "2026-07-12T08:30:00.000Z",
      }),
    ).toMatchObject({ decision: "deny", reason: "blocked_side_effect" });

    expect(
      evaluateCapabilityGrant({
        grant: { ...grant, effectMode: "read_only" },
        principalRef: grant.principalRef,
        capabilityRef: grant.capabilityRef,
        scopeRef: grant.scopeRef,
        at: "2026-07-12T08:30:00.000Z",
      }),
    ).toMatchObject({ decision: "allow_read", reason: "allowed" });

    expect(
      evaluateCapabilityGrant({
        grant: { ...grant, effectMode: "draft_only" },
        principalRef: grant.principalRef,
        capabilityRef: grant.capabilityRef,
        scopeRef: grant.scopeRef,
        at: "2026-07-12T08:30:00.000Z",
      }),
    ).toMatchObject({ decision: "allow_draft", reason: "allowed" });

    expect(
      evaluateCapabilityGrant({
        grant,
        principalRef: grant.principalRef,
        capabilityRef: grant.capabilityRef,
        scopeRef: grant.scopeRef,
        at: "2026-07-12T07:59:59.000Z",
      }),
    ).toMatchObject({ decision: "deny", reason: "not_yet_valid" });

    expect(
      evaluateCapabilityGrant({
        grant,
        principalRef: grant.principalRef,
        capabilityRef: "review:other",
        scopeRef: grant.scopeRef,
        at: "2026-07-12T08:30:00.000Z",
      }),
    ).toMatchObject({ decision: "deny", reason: "capability_mismatch" });

    expect(
      evaluateCapabilityGrant({
        grant,
        principalRef: grant.principalRef,
        capabilityRef: grant.capabilityRef,
        scopeRef: "workspace:other",
        at: "2026-07-12T08:30:00.000Z",
      }),
    ).toMatchObject({ decision: "deny", reason: "scope_mismatch" });

    expect(
      evaluateCapabilityGrant({
        grant: { ...grant, unexpected: true },
        principalRef: grant.principalRef,
        capabilityRef: grant.capabilityRef,
        scopeRef: grant.scopeRef,
        at: "2026-07-12T08:30:00.000Z",
      }),
    ).toMatchObject({ decision: "deny", reason: "invalid_grant" });

    expect(
      evaluateCapabilityGrant({
        grant,
        principalRef: grant.principalRef,
        capabilityRef: grant.capabilityRef,
        scopeRef: grant.scopeRef,
        at: "not-a-timestamp",
      }),
    ).toMatchObject({ decision: "deny", reason: "invalid_request" });

    expect(
      evaluateCapabilityGrant({
        grant: { ...grant, revokedAt: "2026-07-12T08:45:00.000Z" },
        principalRef: grant.principalRef,
        capabilityRef: grant.capabilityRef,
        scopeRef: grant.scopeRef,
        at: "2026-07-12T08:30:00.000Z",
      }),
    ).toMatchObject({ decision: "allow_review", reason: "allowed" });
  });

  it("rejects a revocation timestamp outside the grant lifecycle", () => {
    expect(() =>
      capabilityGrantSchema.parse({
        grantRef: "grant:invalid-revocation",
        principalRef: "worker:review",
        capabilityRef: "review:context",
        scopeRef: "workspace:helm-self",
        effectMode: "review_required",
        policyVersion: "policy:v1",
        isolationProfileRef: "isolation:review-worker:v1",
        entitlementRef: null,
        killSwitchRef: null,
        issuedAt: "2026-07-12T08:00:00.000Z",
        expiresAt: "2026-07-12T09:00:00.000Z",
        revokedAt: "2026-07-12T07:00:00.000Z",
      }),
    ).toThrow();
  });
});
