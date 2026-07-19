import { z } from "zod";

import {
  computeWorkUnitSnapshotHash,
  helmWorkUnitSchema,
  workUnitActivationScopeSchema,
  workUnitActorSchema,
  workUnitRollbackOrRemediationPlanSchema,
  type WorkUnitActor,
  type WorkUnitViolation,
} from "./contracts";
import {
  activationAuthorityReceiptSchema,
  activationHandoffRequestSchema,
  validateActivationAuthorization,
} from "./activation-handoff";

export const activationRuntimeExecutorModeSchema = z.enum([
  "public_core_noop",
  "private_control_plane",
  "tenant_overlay",
  "private_pack_adapter",
]);
export type ActivationRuntimeExecutorMode = z.infer<
  typeof activationRuntimeExecutorModeSchema
>;

export const activationTargetRefSafetySchema = z.enum(["opaque_ref_only"]);
export type ActivationTargetRefSafety = z.infer<typeof activationTargetRefSafetySchema>;

export const activationRuntimeCapabilitiesSchema = z
  .object({
    snapshotBoundExecution: z.boolean(),
    mainlineReceiptRequired: z.boolean(),
    humanOwnerAuthorizationRequired: z.boolean(),
    activationAuthoritySeparated: z.boolean(),
    rollbackOrRemediationRequired: z.boolean(),
    targetRefResolvedOutsidePublicCore: z.boolean(),
    privateExecutorActivatesRuntime: z.boolean(),
    privateExecutorPersistsReceipt: z.boolean(),
    publicCoreCarriesRealInstance: z.boolean(),
    publicCorePersists: z.boolean(),
    publicCoreSendsExternally: z.boolean(),
    publicCoreWritesTarget: z.boolean(),
    publicCoreActivatesRuntime: z.boolean(),
    publicCoreGrantsApproval: z.boolean(),
  })
  .strict();
export type ActivationRuntimeCapabilities = z.infer<
  typeof activationRuntimeCapabilitiesSchema
>;

export const activationRuntimeBindingSchema = z
  .object({
    schemaVersion: z.literal("helm.activation-runtime-binding.v1"),
    bindingRef: z.string().min(1),
    executorMode: activationRuntimeExecutorModeSchema,
    executorRef: z.string().min(1),
    authorityRef: z.string().min(1).optional(),
    executionPolicyRef: z.string().min(1).optional(),
    receiptStoreRef: z.string().min(1).optional(),
    capabilities: activationRuntimeCapabilitiesSchema,
  })
  .strict();
export type ActivationRuntimeBinding = z.infer<typeof activationRuntimeBindingSchema>;

export const activationRuntimeExecutionEnvelopeSchema = z
  .object({
    schemaVersion: z.literal("helm.activation-runtime-execution-envelope.v1"),
    envelopeId: z.string().min(1),
    bindingRef: z.string().min(1),
    executorMode: activationRuntimeExecutorModeSchema,
    executorRef: z.string().min(1),
    authorityRef: z.string().min(1).optional(),
    executionPolicyRef: z.string().min(1).optional(),
    receiptStoreRef: z.string().min(1).optional(),
    workUnitId: z.string().min(1),
    handoffId: z.string().min(1),
    targetRef: z.string().min(1),
    targetRefSafety: activationTargetRefSafetySchema,
    requestedScope: workUnitActivationScopeSchema,
    snapshotHash: z.string().min(1),
    mainlineReceiptRef: z.string().min(1),
    authorizationReceiptRef: z.string().min(1),
    rollbackOrRemediationPlan: workUnitRollbackOrRemediationPlanSchema,
    requestedBy: workUnitActorSchema,
    requestedAt: z.string().min(1),
    reason: z.string().min(1),
    privateExecutorRequired: z.boolean(),
    privateExecutionReceiptRequired: z.literal(true),
    readinessClaim: z.literal("not_readiness"),
    activationClaim: z.literal("not_activation"),
    publicCoreCarriesRealInstance: z.literal(false),
    publicCorePersists: z.literal(false),
    createsExternalEffect: z.literal(false),
    sendsExternally: z.literal(false),
    writesTarget: z.literal(false),
    activatesRuntime: z.literal(false),
    grantsApproval: z.literal(false),
  })
  .strict();
export type ActivationRuntimeExecutionEnvelope = z.infer<
  typeof activationRuntimeExecutionEnvelopeSchema
>;

export type ActivationRuntimeExecutionEnvelopeResult =
  | {
      readonly ok: true;
      readonly binding: ActivationRuntimeBinding;
      readonly envelope: ActivationRuntimeExecutionEnvelope;
      readonly publicCorePersists: false;
      readonly writesTarget: false;
      readonly activatesRuntime: false;
      readonly grantsApproval: false;
    }
  | {
      readonly ok: false;
      readonly violations: readonly WorkUnitViolation[];
      readonly publicCorePersists: false;
      readonly writesTarget: false;
      readonly activatesRuntime: false;
      readonly grantsApproval: false;
    };

export type ActivationRuntimeExecuteResult =
  | {
      readonly ok: true;
      readonly privateExecutionReceiptRef: string;
      readonly publicCorePersists: false;
      readonly writesTarget: false;
      readonly activatesRuntime: false;
      readonly grantsApproval: false;
    }
  | {
      readonly ok: false;
      readonly violations: readonly WorkUnitViolation[];
      readonly publicCorePersists: false;
      readonly writesTarget: false;
      readonly activatesRuntime: false;
      readonly grantsApproval: false;
    };

export type ActivationRuntimeExecutor = {
  readonly binding: ActivationRuntimeBinding;
  readonly execute: (envelope: unknown) => ActivationRuntimeExecuteResult;
};

const PRIVATE_EXECUTOR_MODES: ReadonlySet<ActivationRuntimeExecutorMode> = new Set([
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
): ActivationRuntimeExecutionEnvelopeResult {
  return {
    ok: false,
    violations,
    publicCorePersists: false,
    writesTarget: false,
    activatesRuntime: false,
    grantsApproval: false,
  };
}

function blockedExecute(
  violations: readonly WorkUnitViolation[],
): ActivationRuntimeExecuteResult {
  return {
    ok: false,
    violations,
    publicCorePersists: false,
    writesTarget: false,
    activatesRuntime: false,
    grantsApproval: false,
  };
}

function defaultPublicCoreNoopBinding(): ActivationRuntimeBinding {
  return activationRuntimeBindingSchema.parse({
    schemaVersion: "helm.activation-runtime-binding.v1",
    bindingRef: "public-core:no-activation-runtime-executor",
    executorMode: "public_core_noop",
    executorRef: "public-core:no-activation-runtime-executor",
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
  });
}

export function validateActivationRuntimeBinding(input: unknown): WorkUnitViolation[] {
  const parsed = activationRuntimeBindingSchema.safeParse(input);
  if (!parsed.success) {
    return schemaViolations("activation-runtime-binding", parsed.error);
  }

  const binding = parsed.data;
  const capabilities = binding.capabilities;
  const violations: WorkUnitViolation[] = [];
  const privateMode = PRIVATE_EXECUTOR_MODES.has(binding.executorMode);
  const publicNoop = binding.executorMode === "public_core_noop";

  if (privateMode && !binding.authorityRef) {
    violations.push({
      rule: "activation-runtime-private-authority-required",
      detail: binding.bindingRef,
    });
  }
  if (privateMode && !binding.executionPolicyRef) {
    violations.push({
      rule: "activation-runtime-private-policy-required",
      detail: binding.bindingRef,
    });
  }
  if (privateMode && !binding.receiptStoreRef) {
    violations.push({
      rule: "activation-runtime-private-receipt-store-required",
      detail: binding.bindingRef,
    });
  }
  if (!capabilities.snapshotBoundExecution) {
    violations.push({
      rule: "activation-runtime-snapshot-bound-required",
      detail: binding.bindingRef,
    });
  }
  if (!capabilities.mainlineReceiptRequired) {
    violations.push({
      rule: "activation-runtime-mainline-receipt-required",
      detail: binding.bindingRef,
    });
  }
  if (!capabilities.humanOwnerAuthorizationRequired) {
    violations.push({
      rule: "activation-runtime-human-owner-authorization-required",
      detail: binding.bindingRef,
    });
  }
  if (!capabilities.activationAuthoritySeparated) {
    violations.push({
      rule: "activation-runtime-authority-separation-required",
      detail: binding.bindingRef,
    });
  }
  if (!capabilities.rollbackOrRemediationRequired) {
    violations.push({
      rule: "activation-runtime-recovery-plan-required",
      detail: binding.bindingRef,
    });
  }
  if (!capabilities.targetRefResolvedOutsidePublicCore) {
    violations.push({
      rule: "activation-runtime-target-ref-private-resolution-required",
      detail: binding.bindingRef,
    });
  }
  if (privateMode && !capabilities.privateExecutorActivatesRuntime) {
    violations.push({
      rule: "activation-runtime-private-executor-required",
      detail: binding.bindingRef,
    });
  }
  if (privateMode && !capabilities.privateExecutorPersistsReceipt) {
    violations.push({
      rule: "activation-runtime-private-receipt-persistence-required",
      detail: binding.bindingRef,
    });
  }
  if (publicNoop && capabilities.privateExecutorActivatesRuntime) {
    violations.push({
      rule: "public-core-activation-runtime-cannot-activate",
      detail: binding.bindingRef,
    });
  }
  if (publicNoop && capabilities.privateExecutorPersistsReceipt) {
    violations.push({
      rule: "public-core-activation-runtime-cannot-persist-receipt",
      detail: binding.bindingRef,
    });
  }
  if (capabilities.publicCoreCarriesRealInstance) {
    violations.push({
      rule: "activation-runtime-public-core-real-instance-forbidden",
      detail: binding.bindingRef,
    });
  }
  if (capabilities.publicCorePersists) {
    violations.push({
      rule: "activation-runtime-public-core-persistence-forbidden",
      detail: binding.bindingRef,
    });
  }
  if (capabilities.publicCoreSendsExternally) {
    violations.push({
      rule: "activation-runtime-public-core-send-forbidden",
      detail: binding.bindingRef,
    });
  }
  if (capabilities.publicCoreWritesTarget) {
    violations.push({
      rule: "activation-runtime-public-core-write-forbidden",
      detail: binding.bindingRef,
    });
  }
  if (capabilities.publicCoreActivatesRuntime) {
    violations.push({
      rule: "activation-runtime-public-core-activation-forbidden",
      detail: binding.bindingRef,
    });
  }
  if (capabilities.publicCoreGrantsApproval) {
    violations.push({
      rule: "activation-runtime-public-core-approval-forbidden",
      detail: binding.bindingRef,
    });
  }

  return violations;
}

function targetRefViolations(targetRef: string): WorkUnitViolation[] {
  if (/^https?:\/\//i.test(targetRef) || targetRef.includes("@")) {
    return [
      {
        rule: "activation-runtime-target-ref-must-be-opaque",
        detail: "raw target reference withheld; activation targets must be opaque refs",
      },
    ];
  }
  return [];
}

export function buildActivationRuntimeExecutionEnvelope(input: {
  readonly binding: unknown;
  readonly workUnit: unknown;
  readonly request: unknown;
  readonly receipt: unknown;
  readonly requestedBy: WorkUnitActor;
  readonly requestedAt: string;
  readonly reason: string;
}): ActivationRuntimeExecutionEnvelopeResult {
  const bindingParse = activationRuntimeBindingSchema.safeParse(input.binding);
  if (!bindingParse.success) {
    return blockedEnvelope(schemaViolations("activation-runtime-binding", bindingParse.error));
  }

  const binding = bindingParse.data;
  const bindingViolations = validateActivationRuntimeBinding(binding);
  if (bindingViolations.length > 0) return blockedEnvelope(bindingViolations);

  const workUnitParse = helmWorkUnitSchema.safeParse(input.workUnit);
  const requestParse = activationHandoffRequestSchema.safeParse(input.request);
  const receiptParse = activationAuthorityReceiptSchema.safeParse(input.receipt);
  const requestedByParse = workUnitActorSchema.safeParse(input.requestedBy);
  const requestedAtParse = z.string().min(1).safeParse(input.requestedAt);
  const reasonParse = z.string().min(1).safeParse(input.reason);
  const parseViolations: WorkUnitViolation[] = [];

  if (!workUnitParse.success) {
    parseViolations.push(...schemaViolations("activation-runtime-work-unit", workUnitParse.error));
  }
  if (!requestParse.success) {
    parseViolations.push(...schemaViolations("activation-runtime-request", requestParse.error));
  }
  if (!receiptParse.success) {
    parseViolations.push(...schemaViolations("activation-runtime-receipt", receiptParse.error));
  }
  if (!requestedByParse.success) {
    parseViolations.push(
      ...schemaViolations("activation-runtime-requested-by", requestedByParse.error),
    );
  }
  if (!requestedAtParse.success) {
    parseViolations.push(
      ...schemaViolations("activation-runtime-requested-at", requestedAtParse.error),
    );
  }
  if (!reasonParse.success) {
    parseViolations.push(...schemaViolations("activation-runtime-reason", reasonParse.error));
  }
  if (
    !workUnitParse.success ||
    !requestParse.success ||
    !receiptParse.success ||
    !requestedByParse.success ||
    !requestedAtParse.success ||
    !reasonParse.success
  ) {
    return blockedEnvelope(parseViolations);
  }

  const workUnit = workUnitParse.data;
  const request = requestParse.data;
  const receipt = receiptParse.data;
  const requestedBy = requestedByParse.data;
  const requestedAt = requestedAtParse.data;
  const reason = reasonParse.data;
  const violations: WorkUnitViolation[] = [
    ...validateActivationAuthorization({
      workUnit,
      request,
      receipt,
    }),
    ...targetRefViolations(request.targetRef),
  ];

  if (requestedBy.actorType === "ai") {
    violations.push({
      rule: "activation-runtime-ai-request-not-authoritative",
      detail: requestedBy.actorRef,
    });
  }
  if (violations.length > 0) return blockedEnvelope(violations);

  const envelope = activationRuntimeExecutionEnvelopeSchema.parse({
    schemaVersion: "helm.activation-runtime-execution-envelope.v1",
    envelopeId: `activation-runtime-envelope:${binding.bindingRef}:${workUnit.id}:${receipt.receiptId}:${requestedAt}`,
    bindingRef: binding.bindingRef,
    executorMode: binding.executorMode,
    executorRef: binding.executorRef,
    authorityRef: binding.authorityRef,
    executionPolicyRef: binding.executionPolicyRef,
    receiptStoreRef: binding.receiptStoreRef,
    workUnitId: workUnit.id,
    handoffId: request.handoffId,
    targetRef: request.targetRef,
    targetRefSafety: "opaque_ref_only",
    requestedScope: request.requestedScope,
    snapshotHash: computeWorkUnitSnapshotHash(workUnit),
    mainlineReceiptRef: request.mainlineReceiptRef,
    authorizationReceiptRef: receipt.receiptId,
    rollbackOrRemediationPlan: request.rollbackOrRemediationPlan,
    requestedBy,
    requestedAt,
    reason,
    privateExecutorRequired: PRIVATE_EXECUTOR_MODES.has(binding.executorMode),
    privateExecutionReceiptRequired: true,
    readinessClaim: "not_readiness",
    activationClaim: "not_activation",
    publicCoreCarriesRealInstance: false,
    publicCorePersists: false,
    createsExternalEffect: false,
    sendsExternally: false,
    writesTarget: false,
    activatesRuntime: false,
    grantsApproval: false,
  });

  return {
    ok: true,
    binding,
    envelope,
    publicCorePersists: false,
    writesTarget: false,
    activatesRuntime: false,
    grantsApproval: false,
  };
}

export function buildPublicCoreNoopActivationRuntimeExecutor(): ActivationRuntimeExecutor {
  const binding = defaultPublicCoreNoopBinding();

  return {
    binding,
    execute: (envelope: unknown) => {
      const parsed = activationRuntimeExecutionEnvelopeSchema.safeParse(envelope);
      if (!parsed.success) {
        return blockedExecute(schemaViolations("activation-runtime-envelope", parsed.error));
      }

      return blockedExecute([
        {
          rule: "public-core-activation-runtime-executor-is-noop",
          detail: parsed.data.envelopeId,
        },
      ]);
    },
  };
}
