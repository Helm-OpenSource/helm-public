import { describe, expect, it } from "vitest";

import {
  buildLearningAssetStoreEnvelope,
  buildPublicCoreNoopLearningAssetStore,
  learningAssetStoreBindingSchema,
  validateLearningAssetStoreBinding,
  type LearningAssetStoreBinding,
} from "./learning-asset-store-binding";
import {
  buildSyntheticFailedWorkUnit,
  buildSyntheticLearningAssetDraft,
  buildSyntheticLearningFinding,
  WORK_UNIT_SYNTHETIC_TIME,
} from "./synthetic-fixtures";

function privateBinding(
  overrides: Partial<LearningAssetStoreBinding> = {},
): LearningAssetStoreBinding {
  return learningAssetStoreBindingSchema.parse({
    schemaVersion: "helm.learning-asset-store-binding.v1",
    bindingRef: "synthetic-binding:learning-asset-store",
    storeMode: "private_control_plane",
    storeRef: "synthetic://private-learning-assets",
    authorityRef: "synthetic://learning-authority",
    applicationPolicyRef: "synthetic://learning-application-policy",
    receiptStoreRef: "synthetic://learning-asset-receipts",
    capabilities: {
      findingRequired: true,
      draftValidated: true,
      snapshotBoundAssets: true,
      ownerWaiverRequiresHumanReceipt: true,
      applicationPolicyRequired: true,
      privateStorePersists: true,
      privateStoreAppliesAsset: true,
      publicCoreCarriesRealInstance: false,
      publicCorePersists: false,
      publicCoreSendsExternally: false,
      publicCoreWritesTarget: false,
      publicCoreChangesCheckRules: false,
      publicCoreAppliesAsset: false,
      publicCoreGrantsApproval: false,
    },
    ...overrides,
  });
}

function publicNoopBinding(
  overrides: Partial<LearningAssetStoreBinding> = {},
): LearningAssetStoreBinding {
  return learningAssetStoreBindingSchema.parse({
    ...privateBinding({
      storeMode: "public_core_noop",
      storeRef: "public-core:no-learning-asset-store",
      authorityRef: undefined,
      applicationPolicyRef: undefined,
      receiptStoreRef: undefined,
      capabilities: {
        findingRequired: true,
        draftValidated: true,
        snapshotBoundAssets: true,
        ownerWaiverRequiresHumanReceipt: true,
        applicationPolicyRequired: true,
        privateStorePersists: false,
        privateStoreAppliesAsset: false,
        publicCoreCarriesRealInstance: false,
        publicCorePersists: false,
        publicCoreSendsExternally: false,
        publicCoreWritesTarget: false,
        publicCoreChangesCheckRules: false,
        publicCoreAppliesAsset: false,
        publicCoreGrantsApproval: false,
      },
    }),
    ...overrides,
  });
}

describe("learning asset store binding", () => {
  it("builds a private learning-asset envelope without Public Core persistence or application", () => {
    const workUnit = buildSyntheticFailedWorkUnit();
    const finding = buildSyntheticLearningFinding(workUnit);
    const draft = buildSyntheticLearningAssetDraft({ finding });
    const result = buildLearningAssetStoreEnvelope({
      binding: privateBinding(),
      finding,
      draft,
      requestedBy: { actorType: "system", actorRef: "learning-asset-envelope-builder" },
      requestedAt: WORK_UNIT_SYNTHETIC_TIME,
      reason: "Synthetic finding was converted into an executable asset draft.",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.envelope.applicationClaim).toBe("not_applied");
      expect(result.envelope.readinessClaim).toBe("not_readiness");
      expect(result.envelope.privateStoreRequired).toBe(true);
      expect(result.envelope.privateReceiptRequired).toBe(true);
      expect(result.envelope.publicCoreCarriesRealInstance).toBe(false);
      expect(result.envelope.publicCorePersists).toBe(false);
      expect(result.envelope.createsExternalEffect).toBe(false);
      expect(result.envelope.sendsExternally).toBe(false);
      expect(result.envelope.writesTarget).toBe(false);
      expect(result.envelope.changesCheckRules).toBe(false);
      expect(result.envelope.appliesAsset).toBe(false);
      expect(result.envelope.grantsApproval).toBe(false);
      expect(result.publicCorePersists).toBe(false);
      expect(result.appliesAsset).toBe(false);
    }
  });

  it("keeps the Public Core default store as a no-op that cannot record or apply assets", () => {
    const workUnit = buildSyntheticFailedWorkUnit();
    const finding = buildSyntheticLearningFinding(workUnit);
    const draft = buildSyntheticLearningAssetDraft({ finding });
    const envelope = buildLearningAssetStoreEnvelope({
      binding: publicNoopBinding(),
      finding,
      draft,
      requestedBy: { actorType: "system", actorRef: "learning-asset-envelope-builder" },
      requestedAt: WORK_UNIT_SYNTHETIC_TIME,
      reason: "Synthetic finding was converted into an executable asset draft.",
    });

    expect(envelope.ok).toBe(true);
    if (!envelope.ok) throw new Error("public no-op envelope should still be previewable");

    const result = buildPublicCoreNoopLearningAssetStore().record(envelope.envelope);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations.map((violation) => violation.rule)).toContain(
        "public-core-learning-asset-store-is-noop",
      );
      expect(result.publicCorePersists).toBe(false);
      expect(result.writesTarget).toBe(false);
      expect(result.appliesAsset).toBe(false);
      expect(result.grantsApproval).toBe(false);
    }
  });

  it("blocks private learning-asset stores that do not prove governance capabilities", () => {
    const violations = validateLearningAssetStoreBinding({
      ...privateBinding(),
      authorityRef: undefined,
      applicationPolicyRef: undefined,
      receiptStoreRef: undefined,
      capabilities: {
        ...privateBinding().capabilities,
        findingRequired: false,
        draftValidated: false,
        snapshotBoundAssets: false,
        ownerWaiverRequiresHumanReceipt: false,
        applicationPolicyRequired: false,
        privateStorePersists: false,
        privateStoreAppliesAsset: false,
      },
    });

    expect(violations.map((violation) => violation.rule)).toEqual([
      "learning-asset-store-private-authority-required",
      "learning-asset-store-application-policy-required",
      "learning-asset-store-private-receipt-store-required",
      "learning-asset-store-finding-required",
      "learning-asset-store-draft-validation-required",
      "learning-asset-store-snapshot-bound-required",
      "learning-asset-store-human-waiver-receipt-required",
      "learning-asset-store-private-persistence-required",
      "learning-asset-store-private-application-required",
    ]);
  });

  it("blocks public-core stores that claim persistence, application, approval, or target effects", () => {
    const violations = validateLearningAssetStoreBinding({
      ...publicNoopBinding(),
      capabilities: {
        ...publicNoopBinding().capabilities,
        privateStorePersists: true,
        privateStoreAppliesAsset: true,
        publicCoreCarriesRealInstance: true,
        publicCorePersists: true,
        publicCoreSendsExternally: true,
        publicCoreWritesTarget: true,
        publicCoreChangesCheckRules: true,
        publicCoreAppliesAsset: true,
        publicCoreGrantsApproval: true,
      },
    });

    expect(violations.map((violation) => violation.rule)).toEqual([
      "public-core-learning-asset-store-cannot-persist",
      "public-core-learning-asset-store-cannot-apply",
      "learning-asset-store-public-core-real-instance-forbidden",
      "learning-asset-store-public-core-persistence-forbidden",
      "learning-asset-store-public-core-send-forbidden",
      "learning-asset-store-public-core-write-forbidden",
      "learning-asset-store-public-core-check-rule-change-forbidden",
      "learning-asset-store-public-core-application-forbidden",
      "learning-asset-store-public-core-approval-forbidden",
    ]);
  });

  it("blocks raw network asset refs without echoing the target", () => {
    const workUnit = buildSyntheticFailedWorkUnit();
    const finding = buildSyntheticLearningFinding(workUnit);
    const draft = buildSyntheticLearningAssetDraft({
      finding,
      overrides: {
        disposition: {
          findingId: finding.findingId,
          disposition: "asset_recorded",
          assetKind: "check",
          assetRef: "https://example.invalid/guard",
          summary: "Prepare a synthetic renewal-cost guard asset.",
          recordedBy: { actorType: "system", actorRef: "guard-writer" },
          recordedAt: WORK_UNIT_SYNTHETIC_TIME,
        },
      },
    });
    const result = buildLearningAssetStoreEnvelope({
      binding: privateBinding(),
      finding,
      draft,
      requestedBy: { actorType: "system", actorRef: "learning-asset-envelope-builder" },
      requestedAt: WORK_UNIT_SYNTHETIC_TIME,
      reason: "Synthetic finding was converted into an executable asset draft.",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations.map((violation) => violation.rule)).toContain(
        "learning-asset-store-asset-ref-must-be-opaque",
      );
      expect(JSON.stringify(result.violations)).not.toContain("example.invalid");
      expect(result.writesTarget).toBe(false);
      expect(result.appliesAsset).toBe(false);
    }
  });

  it("blocks AI from requesting authoritative learning-asset persistence or application", () => {
    const workUnit = buildSyntheticFailedWorkUnit();
    const finding = buildSyntheticLearningFinding(workUnit);
    const draft = buildSyntheticLearningAssetDraft({ finding });
    const result = buildLearningAssetStoreEnvelope({
      binding: privateBinding(),
      finding,
      draft,
      requestedBy: { actorType: "ai", actorRef: "agent-1" },
      requestedAt: WORK_UNIT_SYNTHETIC_TIME,
      reason: "AI attempted to request learning-asset persistence.",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations.map((violation) => violation.rule)).toContain(
        "learning-asset-store-ai-request-not-authoritative",
      );
      expect(result.publicCorePersists).toBe(false);
      expect(result.appliesAsset).toBe(false);
    }
  });
});
