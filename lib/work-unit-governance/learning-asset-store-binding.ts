import { z } from "zod";

import {
  workUnitActorSchema,
  type WorkUnitActor,
  type WorkUnitViolation,
} from "./contracts";
import {
  validateLearningFindingResolution,
  workUnitLearningAssetDraftSchema,
  workUnitLearningFindingSchema,
  type WorkUnitLearningAssetDraft,
  type WorkUnitLearningFinding,
} from "./repair-learning-loop";

export const learningAssetStoreModeSchema = z.enum([
  "public_core_noop",
  "private_control_plane",
  "tenant_overlay",
  "private_pack_adapter",
]);
export type LearningAssetStoreMode = z.infer<typeof learningAssetStoreModeSchema>;

export const learningAssetRefSafetySchema = z.enum(["opaque_ref_only"]);
export type LearningAssetRefSafety = z.infer<typeof learningAssetRefSafetySchema>;

export const learningAssetStoreCapabilitiesSchema = z
  .object({
    findingRequired: z.boolean(),
    draftValidated: z.boolean(),
    snapshotBoundAssets: z.boolean(),
    ownerWaiverRequiresHumanReceipt: z.boolean(),
    applicationPolicyRequired: z.boolean(),
    privateStorePersists: z.boolean(),
    privateStoreAppliesAsset: z.boolean(),
    publicCoreCarriesRealInstance: z.boolean(),
    publicCorePersists: z.boolean(),
    publicCoreSendsExternally: z.boolean(),
    publicCoreWritesTarget: z.boolean(),
    publicCoreChangesCheckRules: z.boolean(),
    publicCoreAppliesAsset: z.boolean(),
    publicCoreGrantsApproval: z.boolean(),
  })
  .strict();
export type LearningAssetStoreCapabilities = z.infer<
  typeof learningAssetStoreCapabilitiesSchema
>;

export const learningAssetStoreBindingSchema = z
  .object({
    schemaVersion: z.literal("helm.learning-asset-store-binding.v1"),
    bindingRef: z.string().min(1),
    storeMode: learningAssetStoreModeSchema,
    storeRef: z.string().min(1),
    authorityRef: z.string().min(1).optional(),
    applicationPolicyRef: z.string().min(1).optional(),
    receiptStoreRef: z.string().min(1).optional(),
    capabilities: learningAssetStoreCapabilitiesSchema,
  })
  .strict();
export type LearningAssetStoreBinding = z.infer<typeof learningAssetStoreBindingSchema>;

export const learningAssetStoreEnvelopeSchema = z
  .object({
    schemaVersion: z.literal("helm.learning-asset-store-envelope.v1"),
    envelopeId: z.string().min(1),
    bindingRef: z.string().min(1),
    storeMode: learningAssetStoreModeSchema,
    storeRef: z.string().min(1),
    authorityRef: z.string().min(1).optional(),
    applicationPolicyRef: z.string().min(1).optional(),
    receiptStoreRef: z.string().min(1).optional(),
    workUnitId: z.string().min(1),
    findingId: z.string().min(1),
    draftId: z.string().min(1),
    sourceSnapshotHash: z.string().min(1),
    disposition: z.enum(["asset_recorded", "owner_waived"]),
    assetKind: z.string().min(1).optional(),
    assetRef: z.string().min(1).optional(),
    assetRefSafety: learningAssetRefSafetySchema,
    requestedBy: workUnitActorSchema,
    requestedAt: z.string().min(1),
    reason: z.string().min(1),
    privateStoreRequired: z.boolean(),
    privateReceiptRequired: z.literal(true),
    privateApplicationRequired: z.boolean(),
    readinessClaim: z.literal("not_readiness"),
    applicationClaim: z.literal("not_applied"),
    publicCoreCarriesRealInstance: z.literal(false),
    publicCorePersists: z.literal(false),
    createsExternalEffect: z.literal(false),
    sendsExternally: z.literal(false),
    writesTarget: z.literal(false),
    changesCheckRules: z.literal(false),
    appliesAsset: z.literal(false),
    grantsApproval: z.literal(false),
  })
  .strict();
export type LearningAssetStoreEnvelope = z.infer<typeof learningAssetStoreEnvelopeSchema>;

export type LearningAssetStoreEnvelopeResult =
  | {
      readonly ok: true;
      readonly binding: LearningAssetStoreBinding;
      readonly envelope: LearningAssetStoreEnvelope;
      readonly publicCorePersists: false;
      readonly writesTarget: false;
      readonly appliesAsset: false;
      readonly grantsApproval: false;
    }
  | {
      readonly ok: false;
      readonly violations: readonly WorkUnitViolation[];
      readonly publicCorePersists: false;
      readonly writesTarget: false;
      readonly appliesAsset: false;
      readonly grantsApproval: false;
    };

export type LearningAssetStoreRecordResult =
  | {
      readonly ok: true;
      readonly privateReceiptRef: string;
      readonly privateAssetRef: string;
      readonly publicCorePersists: false;
      readonly writesTarget: false;
      readonly appliesAsset: false;
      readonly grantsApproval: false;
    }
  | {
      readonly ok: false;
      readonly violations: readonly WorkUnitViolation[];
      readonly publicCorePersists: false;
      readonly writesTarget: false;
      readonly appliesAsset: false;
      readonly grantsApproval: false;
    };

export type LearningAssetStore = {
  readonly binding: LearningAssetStoreBinding;
  readonly record: (envelope: unknown) => LearningAssetStoreRecordResult;
};

const PRIVATE_STORE_MODES: ReadonlySet<LearningAssetStoreMode> = new Set([
  "private_control_plane",
  "tenant_overlay",
  "private_pack_adapter",
]);

function schemaViolations(prefix: string, error: z.ZodError): WorkUnitViolation[] {
  return error.issues.map((issue) => ({
    rule: `${prefix}-schema`,
    detail: `${issue.path.join(".") || "<root>"}: ${issue.message}`,
  }));
}

function blockedEnvelope(
  violations: readonly WorkUnitViolation[],
): LearningAssetStoreEnvelopeResult {
  return {
    ok: false,
    violations,
    publicCorePersists: false,
    writesTarget: false,
    appliesAsset: false,
    grantsApproval: false,
  };
}

function blockedRecord(
  violations: readonly WorkUnitViolation[],
): LearningAssetStoreRecordResult {
  return {
    ok: false,
    violations,
    publicCorePersists: false,
    writesTarget: false,
    appliesAsset: false,
    grantsApproval: false,
  };
}

function defaultPublicCoreNoopBinding(): LearningAssetStoreBinding {
  return learningAssetStoreBindingSchema.parse({
    schemaVersion: "helm.learning-asset-store-binding.v1",
    bindingRef: "public-core:no-learning-asset-store",
    storeMode: "public_core_noop",
    storeRef: "public-core:no-learning-asset-store",
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
  });
}

export function validateLearningAssetStoreBinding(input: unknown): WorkUnitViolation[] {
  const parsed = learningAssetStoreBindingSchema.safeParse(input);
  if (!parsed.success) {
    return schemaViolations("learning-asset-store-binding", parsed.error);
  }

  const binding = parsed.data;
  const capabilities = binding.capabilities;
  const violations: WorkUnitViolation[] = [];
  const privateMode = PRIVATE_STORE_MODES.has(binding.storeMode);
  const publicNoop = binding.storeMode === "public_core_noop";

  if (privateMode && !binding.authorityRef) {
    violations.push({
      rule: "learning-asset-store-private-authority-required",
      detail: binding.bindingRef,
    });
  }
  if (privateMode && (!binding.applicationPolicyRef || !capabilities.applicationPolicyRequired)) {
    violations.push({
      rule: "learning-asset-store-application-policy-required",
      detail: binding.bindingRef,
    });
  }
  if (privateMode && !binding.receiptStoreRef) {
    violations.push({
      rule: "learning-asset-store-private-receipt-store-required",
      detail: binding.bindingRef,
    });
  }
  if (!capabilities.findingRequired) {
    violations.push({
      rule: "learning-asset-store-finding-required",
      detail: binding.bindingRef,
    });
  }
  if (!capabilities.draftValidated) {
    violations.push({
      rule: "learning-asset-store-draft-validation-required",
      detail: binding.bindingRef,
    });
  }
  if (!capabilities.snapshotBoundAssets) {
    violations.push({
      rule: "learning-asset-store-snapshot-bound-required",
      detail: binding.bindingRef,
    });
  }
  if (!capabilities.ownerWaiverRequiresHumanReceipt) {
    violations.push({
      rule: "learning-asset-store-human-waiver-receipt-required",
      detail: binding.bindingRef,
    });
  }
  if (publicNoop && capabilities.privateStorePersists) {
    violations.push({
      rule: "public-core-learning-asset-store-cannot-persist",
      detail: binding.bindingRef,
    });
  }
  if (publicNoop && capabilities.privateStoreAppliesAsset) {
    violations.push({
      rule: "public-core-learning-asset-store-cannot-apply",
      detail: binding.bindingRef,
    });
  }
  if (privateMode && !capabilities.privateStorePersists) {
    violations.push({
      rule: "learning-asset-store-private-persistence-required",
      detail: binding.bindingRef,
    });
  }
  if (privateMode && !capabilities.privateStoreAppliesAsset) {
    violations.push({
      rule: "learning-asset-store-private-application-required",
      detail: binding.bindingRef,
    });
  }
  if (capabilities.publicCoreCarriesRealInstance) {
    violations.push({
      rule: "learning-asset-store-public-core-real-instance-forbidden",
      detail: binding.bindingRef,
    });
  }
  if (capabilities.publicCorePersists) {
    violations.push({
      rule: "learning-asset-store-public-core-persistence-forbidden",
      detail: binding.bindingRef,
    });
  }
  if (capabilities.publicCoreSendsExternally) {
    violations.push({
      rule: "learning-asset-store-public-core-send-forbidden",
      detail: binding.bindingRef,
    });
  }
  if (capabilities.publicCoreWritesTarget) {
    violations.push({
      rule: "learning-asset-store-public-core-write-forbidden",
      detail: binding.bindingRef,
    });
  }
  if (capabilities.publicCoreChangesCheckRules) {
    violations.push({
      rule: "learning-asset-store-public-core-check-rule-change-forbidden",
      detail: binding.bindingRef,
    });
  }
  if (capabilities.publicCoreAppliesAsset) {
    violations.push({
      rule: "learning-asset-store-public-core-application-forbidden",
      detail: binding.bindingRef,
    });
  }
  if (capabilities.publicCoreGrantsApproval) {
    violations.push({
      rule: "learning-asset-store-public-core-approval-forbidden",
      detail: binding.bindingRef,
    });
  }

  return violations;
}

function assetRefViolations(draft: WorkUnitLearningAssetDraft): WorkUnitViolation[] {
  if (draft.disposition.disposition !== "asset_recorded") return [];

  const assetRef = draft.disposition.assetRef;
  if (/^https?:\/\//i.test(assetRef) || assetRef.includes("@")) {
    return [
      {
        rule: "learning-asset-store-asset-ref-must-be-opaque",
        detail: "raw asset reference withheld; learning assets must use opaque refs",
      },
    ];
  }
  return [];
}

function assetKindFor(draft: WorkUnitLearningAssetDraft): string | undefined {
  return draft.disposition.disposition === "asset_recorded"
    ? draft.disposition.assetKind
    : undefined;
}

function assetRefFor(draft: WorkUnitLearningAssetDraft): string | undefined {
  return draft.disposition.disposition === "asset_recorded"
    ? draft.disposition.assetRef
    : undefined;
}

export function buildLearningAssetStoreEnvelope(input: {
  readonly binding: unknown;
  readonly finding: unknown;
  readonly draft: unknown;
  readonly requestedBy: WorkUnitActor;
  readonly requestedAt: string;
  readonly reason: string;
}): LearningAssetStoreEnvelopeResult {
  const bindingParse = learningAssetStoreBindingSchema.safeParse(input.binding);
  if (!bindingParse.success) {
    return blockedEnvelope(schemaViolations("learning-asset-store-binding", bindingParse.error));
  }

  const binding = bindingParse.data;
  const bindingViolations = validateLearningAssetStoreBinding(binding);
  if (bindingViolations.length > 0) return blockedEnvelope(bindingViolations);

  const findingParse = workUnitLearningFindingSchema.safeParse(input.finding);
  const draftParse = workUnitLearningAssetDraftSchema.safeParse(input.draft);
  const requestedByParse = workUnitActorSchema.safeParse(input.requestedBy);
  const requestedAtParse = z.string().min(1).safeParse(input.requestedAt);
  const reasonParse = z.string().min(1).safeParse(input.reason);
  const parseViolations: WorkUnitViolation[] = [];

  if (!findingParse.success) {
    parseViolations.push(...schemaViolations("learning-asset-store-finding", findingParse.error));
  }
  if (!draftParse.success) {
    parseViolations.push(...schemaViolations("learning-asset-store-draft", draftParse.error));
  }
  if (!requestedByParse.success) {
    parseViolations.push(
      ...schemaViolations("learning-asset-store-requested-by", requestedByParse.error),
    );
  }
  if (!requestedAtParse.success) {
    parseViolations.push(
      ...schemaViolations("learning-asset-store-requested-at", requestedAtParse.error),
    );
  }
  if (!reasonParse.success) {
    parseViolations.push(...schemaViolations("learning-asset-store-reason", reasonParse.error));
  }
  if (
    !findingParse.success ||
    !draftParse.success ||
    !requestedByParse.success ||
    !requestedAtParse.success ||
    !reasonParse.success
  ) {
    return blockedEnvelope(parseViolations);
  }

  const finding: WorkUnitLearningFinding = findingParse.data;
  const draft = draftParse.data;
  const requestedBy = requestedByParse.data;
  const requestedAt = requestedAtParse.data;
  const reason = reasonParse.data;
  const violations: WorkUnitViolation[] = [
    ...validateLearningFindingResolution({ finding, draft }),
    ...assetRefViolations(draft),
  ];

  if (requestedBy.actorType === "ai") {
    violations.push({
      rule: "learning-asset-store-ai-request-not-authoritative",
      detail: requestedBy.actorRef,
    });
  }
  if (violations.length > 0) return blockedEnvelope(violations);

  const privateStoreRequired = PRIVATE_STORE_MODES.has(binding.storeMode);
  const envelope = learningAssetStoreEnvelopeSchema.parse({
    schemaVersion: "helm.learning-asset-store-envelope.v1",
    envelopeId: `learning-asset-store-envelope:${binding.bindingRef}:${draft.draftId}:${requestedAt}`,
    bindingRef: binding.bindingRef,
    storeMode: binding.storeMode,
    storeRef: binding.storeRef,
    authorityRef: binding.authorityRef,
    applicationPolicyRef: binding.applicationPolicyRef,
    receiptStoreRef: binding.receiptStoreRef,
    workUnitId: draft.workUnitId,
    findingId: finding.findingId,
    draftId: draft.draftId,
    sourceSnapshotHash: draft.sourceSnapshotHash,
    disposition: draft.disposition.disposition,
    assetKind: assetKindFor(draft),
    assetRef: assetRefFor(draft),
    assetRefSafety: "opaque_ref_only",
    requestedBy,
    requestedAt,
    reason,
    privateStoreRequired,
    privateReceiptRequired: true,
    privateApplicationRequired:
      privateStoreRequired && draft.disposition.disposition === "asset_recorded",
    readinessClaim: "not_readiness",
    applicationClaim: "not_applied",
    publicCoreCarriesRealInstance: false,
    publicCorePersists: false,
    createsExternalEffect: false,
    sendsExternally: false,
    writesTarget: false,
    changesCheckRules: false,
    appliesAsset: false,
    grantsApproval: false,
  });

  return {
    ok: true,
    binding,
    envelope,
    publicCorePersists: false,
    writesTarget: false,
    appliesAsset: false,
    grantsApproval: false,
  };
}

export function buildPublicCoreNoopLearningAssetStore(): LearningAssetStore {
  const binding = defaultPublicCoreNoopBinding();

  return {
    binding,
    record: (envelope: unknown) => {
      const parsed = learningAssetStoreEnvelopeSchema.safeParse(envelope);
      if (!parsed.success) {
        return blockedRecord(schemaViolations("learning-asset-store-envelope", parsed.error));
      }

      return blockedRecord([
        {
          rule: "public-core-learning-asset-store-is-noop",
          detail: parsed.data.envelopeId,
        },
      ]);
    },
  };
}
