import { describe, expect, it } from "vitest";

import {
  activationRuntimeBindingSchema,
  buildActivationRuntimeExecutionEnvelope,
  buildPublicCoreNoopActivationRuntimeExecutor,
  validateActivationRuntimeBinding,
  type ActivationRuntimeBinding,
} from "./activation-runtime-binding";
import {
  buildSyntheticActivationAuthorityReceipt,
  buildSyntheticActivationHandoffRequest,
  buildSyntheticPromotedWorkUnit,
  WORK_UNIT_SYNTHETIC_TIME,
} from "./synthetic-fixtures";

function privateBinding(
  overrides: Partial<ActivationRuntimeBinding> = {},
): ActivationRuntimeBinding {
  return activationRuntimeBindingSchema.parse({
    schemaVersion: "helm.activation-runtime-binding.v1",
    bindingRef: "synthetic-binding:activation-runtime",
    executorMode: "private_control_plane",
    executorRef: "synthetic://private-activation-runtime",
    authorityRef: "synthetic://activation-authority",
    executionPolicyRef: "synthetic://activation-policy",
    receiptStoreRef: "synthetic://activation-receipts",
    capabilities: {
      snapshotBoundExecution: true,
      mainlineReceiptRequired: true,
      humanOwnerAuthorizationRequired: true,
      activationAuthoritySeparated: true,
      rollbackOrRemediationRequired: true,
      targetRefResolvedOutsidePublicCore: true,
      privateExecutorActivatesRuntime: true,
      privateExecutorPersistsReceipt: true,
      publicCoreCarriesRealInstance: false,
      publicCorePersists: false,
      publicCoreSendsExternally: false,
      publicCoreWritesTarget: false,
      publicCoreActivatesRuntime: false,
      publicCoreGrantsApproval: false,
    },
    ...overrides,
  });
}

function publicNoopBinding(
  overrides: Partial<ActivationRuntimeBinding> = {},
): ActivationRuntimeBinding {
  return activationRuntimeBindingSchema.parse({
    ...privateBinding({
      executorMode: "public_core_noop",
      executorRef: "public-core:no-activation-runtime-executor",
      authorityRef: undefined,
      executionPolicyRef: undefined,
      receiptStoreRef: undefined,
      capabilities: {
        snapshotBoundExecution: true,
        mainlineReceiptRequired: true,
        humanOwnerAuthorizationRequired: true,
        activationAuthoritySeparated: true,
        rollbackOrRemediationRequired: true,
        targetRefResolvedOutsidePublicCore: true,
        privateExecutorActivatesRuntime: false,
        privateExecutorPersistsReceipt: false,
        publicCoreCarriesRealInstance: false,
        publicCorePersists: false,
        publicCoreSendsExternally: false,
        publicCoreWritesTarget: false,
        publicCoreActivatesRuntime: false,
        publicCoreGrantsApproval: false,
      },
    }),
    ...overrides,
  });
}

describe("activation runtime binding", () => {
  it("builds a private activation execution envelope without Public Core activation", () => {
    const workUnit = buildSyntheticPromotedWorkUnit({
      activationScope: "production_runtime",
    });
    const request = buildSyntheticActivationHandoffRequest(workUnit);
    const receipt = buildSyntheticActivationAuthorityReceipt(workUnit, request);
    const result = buildActivationRuntimeExecutionEnvelope({
      binding: privateBinding(),
      workUnit,
      request,
      receipt,
      requestedBy: { actorType: "system", actorRef: "activation-runtime-envelope-builder" },
      requestedAt: WORK_UNIT_SYNTHETIC_TIME,
      reason: "Synthetic activation was independently authorized.",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.envelope.activationClaim).toBe("not_activation");
      expect(result.envelope.readinessClaim).toBe("not_readiness");
      expect(result.envelope.privateExecutorRequired).toBe(true);
      expect(result.envelope.privateExecutionReceiptRequired).toBe(true);
      expect(result.envelope.targetRefSafety).toBe("opaque_ref_only");
      expect(result.envelope.publicCoreCarriesRealInstance).toBe(false);
      expect(result.envelope.publicCorePersists).toBe(false);
      expect(result.envelope.createsExternalEffect).toBe(false);
      expect(result.envelope.sendsExternally).toBe(false);
      expect(result.envelope.writesTarget).toBe(false);
      expect(result.envelope.activatesRuntime).toBe(false);
      expect(result.envelope.grantsApproval).toBe(false);
      expect(result.publicCorePersists).toBe(false);
      expect(result.activatesRuntime).toBe(false);
    }
  });

  it("keeps the Public Core default executor as a no-op that cannot activate", () => {
    const workUnit = buildSyntheticPromotedWorkUnit({
      activationScope: "production_runtime",
    });
    const request = buildSyntheticActivationHandoffRequest(workUnit);
    const receipt = buildSyntheticActivationAuthorityReceipt(workUnit, request);
    const envelope = buildActivationRuntimeExecutionEnvelope({
      binding: publicNoopBinding(),
      workUnit,
      request,
      receipt,
      requestedBy: { actorType: "system", actorRef: "activation-runtime-envelope-builder" },
      requestedAt: WORK_UNIT_SYNTHETIC_TIME,
      reason: "Synthetic activation was independently authorized.",
    });

    expect(envelope.ok).toBe(true);
    if (!envelope.ok) throw new Error("public no-op envelope should still be previewable");

    const result = buildPublicCoreNoopActivationRuntimeExecutor().execute(envelope.envelope);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations.map((violation) => violation.rule)).toContain(
        "public-core-activation-runtime-executor-is-noop",
      );
      expect(result.publicCorePersists).toBe(false);
      expect(result.writesTarget).toBe(false);
      expect(result.activatesRuntime).toBe(false);
      expect(result.grantsApproval).toBe(false);
    }
  });

  it("blocks private runtime bindings that do not prove governance capabilities", () => {
    const violations = validateActivationRuntimeBinding({
      ...privateBinding(),
      authorityRef: undefined,
      executionPolicyRef: undefined,
      receiptStoreRef: undefined,
      capabilities: {
        ...privateBinding().capabilities,
        snapshotBoundExecution: false,
        humanOwnerAuthorizationRequired: false,
        activationAuthoritySeparated: false,
        rollbackOrRemediationRequired: false,
        targetRefResolvedOutsidePublicCore: false,
        privateExecutorActivatesRuntime: false,
        privateExecutorPersistsReceipt: false,
      },
    });

    expect(violations.map((violation) => violation.rule)).toEqual([
      "activation-runtime-private-authority-required",
      "activation-runtime-private-policy-required",
      "activation-runtime-private-receipt-store-required",
      "activation-runtime-snapshot-bound-required",
      "activation-runtime-human-owner-authorization-required",
      "activation-runtime-authority-separation-required",
      "activation-runtime-recovery-plan-required",
      "activation-runtime-target-ref-private-resolution-required",
      "activation-runtime-private-executor-required",
      "activation-runtime-private-receipt-persistence-required",
    ]);
  });

  it("blocks public-core runtime bindings that claim execution, persistence, approval, or target effects", () => {
    const violations = validateActivationRuntimeBinding({
      ...publicNoopBinding(),
      capabilities: {
        ...publicNoopBinding().capabilities,
        privateExecutorActivatesRuntime: true,
        privateExecutorPersistsReceipt: true,
        publicCoreCarriesRealInstance: true,
        publicCorePersists: true,
        publicCoreSendsExternally: true,
        publicCoreWritesTarget: true,
        publicCoreActivatesRuntime: true,
        publicCoreGrantsApproval: true,
      },
    });

    expect(violations.map((violation) => violation.rule)).toEqual([
      "public-core-activation-runtime-cannot-activate",
      "public-core-activation-runtime-cannot-persist-receipt",
      "activation-runtime-public-core-real-instance-forbidden",
      "activation-runtime-public-core-persistence-forbidden",
      "activation-runtime-public-core-send-forbidden",
      "activation-runtime-public-core-write-forbidden",
      "activation-runtime-public-core-activation-forbidden",
      "activation-runtime-public-core-approval-forbidden",
    ]);
  });

  it("blocks raw network target references from activation execution envelopes", () => {
    const workUnit = buildSyntheticPromotedWorkUnit({
      activationScope: "production_runtime",
    });
    const request = buildSyntheticActivationHandoffRequest(workUnit, {
      targetRef: "https://example.invalid/activate",
    });
    const receipt = buildSyntheticActivationAuthorityReceipt(workUnit, request);
    const result = buildActivationRuntimeExecutionEnvelope({
      binding: privateBinding(),
      workUnit,
      request,
      receipt,
      requestedBy: { actorType: "system", actorRef: "activation-runtime-envelope-builder" },
      requestedAt: WORK_UNIT_SYNTHETIC_TIME,
      reason: "Synthetic activation was independently authorized.",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations.map((violation) => violation.rule)).toContain(
        "activation-runtime-target-ref-must-be-opaque",
      );
      expect(result.activatesRuntime).toBe(false);
      expect(result.writesTarget).toBe(false);
    }
  });
});
