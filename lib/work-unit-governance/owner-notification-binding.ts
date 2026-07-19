import { z } from "zod";

import {
  computeWorkUnitSnapshotHash,
  helmWorkUnitSchema,
  workUnitActorSchema,
  type WorkUnitActor,
  type WorkUnitViolation,
} from "./contracts";
import {
  buildOwnerLifecycleReadout,
  ownerLifecyclePolicySchema,
  ownerLifecyclePostureSchema,
} from "./owner-lifecycle";

export const ownerNotificationDispatcherModeSchema = z.enum([
  "public_core_noop",
  "private_control_plane",
  "tenant_overlay",
  "private_pack_adapter",
]);
export type OwnerNotificationDispatcherMode = z.infer<
  typeof ownerNotificationDispatcherModeSchema
>;

export const ownerNotificationChannelSchema = z.enum([
  "private_inbox",
  "task_queue",
  "chat",
  "email",
  "pager",
  "custom_private_channel",
]);
export type OwnerNotificationChannel = z.infer<typeof ownerNotificationChannelSchema>;

export const ownerNotificationKindSchema = z.enum([
  "owner_review_requested",
  "owner_escalation_requested",
]);
export type OwnerNotificationKind = z.infer<typeof ownerNotificationKindSchema>;

export const ownerNotificationCapabilitiesSchema = z
  .object({
    ownerRefsOnly: z.boolean(),
    snapshotBoundMessages: z.boolean(),
    humanOwnerAuthorityRequired: z.boolean(),
    escalationPolicyRequired: z.boolean(),
    contactDetailsStoredOutsidePublicCore: z.boolean(),
    redactedEnvelopeOnly: z.boolean(),
    privateDispatcherSends: z.boolean(),
    privateDispatcherPersistsReceipt: z.boolean(),
    publicCoreCarriesRealInstance: z.boolean(),
    publicCorePersists: z.boolean(),
    publicCoreSendsNotification: z.boolean(),
    publicCoreWritesTarget: z.boolean(),
    publicCoreActivatesRuntime: z.boolean(),
    publicCoreGrantsApproval: z.boolean(),
  })
  .strict();
export type OwnerNotificationCapabilities = z.infer<
  typeof ownerNotificationCapabilitiesSchema
>;

export const ownerNotificationBindingSchema = z
  .object({
    schemaVersion: z.literal("helm.owner-notification-binding.v1"),
    bindingRef: z.string().min(1),
    dispatcherMode: ownerNotificationDispatcherModeSchema,
    dispatcherRef: z.string().min(1),
    channel: ownerNotificationChannelSchema,
    authorityRef: z.string().min(1).optional(),
    deliveryPolicyRef: z.string().min(1).optional(),
    capabilities: ownerNotificationCapabilitiesSchema,
  })
  .strict();
export type OwnerNotificationBinding = z.infer<typeof ownerNotificationBindingSchema>;

export const ownerNotificationHandoffEnvelopeSchema = z
  .object({
    schemaVersion: z.literal("helm.owner-notification-handoff-envelope.v1"),
    envelopeId: z.string().min(1),
    bindingRef: z.string().min(1),
    dispatcherMode: ownerNotificationDispatcherModeSchema,
    dispatcherRef: z.string().min(1),
    channel: ownerNotificationChannelSchema,
    authorityRef: z.string().min(1).optional(),
    deliveryPolicyRef: z.string().min(1).optional(),
    workUnitId: z.string().min(1),
    snapshotHash: z.string().min(1),
    lifecyclePosture: ownerLifecyclePostureSchema,
    notificationKind: ownerNotificationKindSchema,
    ownerRefs: z.array(z.string().min(1)).min(1),
    pendingOwnerRefs: z.array(z.string().min(1)).default([]),
    escalationOwnerRefs: z.array(z.string().min(1)).default([]),
    reason: z.string().min(1),
    requestedBy: workUnitActorSchema,
    requestedAt: z.string().min(1),
    privateDispatcherRequired: z.boolean(),
    deliveryReceiptRequired: z.literal(true),
    readinessClaim: z.literal("not_readiness"),
    approvalClaim: z.literal("not_approval"),
    publicCoreCarriesRealInstance: z.literal(false),
    publicCorePersists: z.literal(false),
    createsExternalEffect: z.literal(false),
    sendsNotification: z.literal(false),
    sendsExternally: z.literal(false),
    writesTarget: z.literal(false),
    activatesRuntime: z.literal(false),
    grantsApproval: z.literal(false),
  })
  .strict();
export type OwnerNotificationHandoffEnvelope = z.infer<
  typeof ownerNotificationHandoffEnvelopeSchema
>;

export type OwnerNotificationHandoffEnvelopeResult =
  | {
      readonly ok: true;
      readonly binding: OwnerNotificationBinding;
      readonly envelope: OwnerNotificationHandoffEnvelope;
      readonly publicCorePersists: false;
      readonly sendsNotification: false;
      readonly createsExternalEffect: false;
      readonly grantsApproval: false;
    }
  | {
      readonly ok: false;
      readonly violations: readonly WorkUnitViolation[];
      readonly publicCorePersists: false;
      readonly sendsNotification: false;
      readonly createsExternalEffect: false;
      readonly grantsApproval: false;
    };

export type OwnerNotificationDispatchResult =
  | {
      readonly ok: true;
      readonly privateDeliveryReceiptRef: string;
      readonly publicCorePersists: false;
      readonly sendsNotification: false;
      readonly createsExternalEffect: false;
      readonly grantsApproval: false;
    }
  | {
      readonly ok: false;
      readonly violations: readonly WorkUnitViolation[];
      readonly publicCorePersists: false;
      readonly sendsNotification: false;
      readonly createsExternalEffect: false;
      readonly grantsApproval: false;
    };

export type OwnerNotificationDispatcher = {
  readonly binding: OwnerNotificationBinding;
  readonly dispatch: (envelope: unknown) => OwnerNotificationDispatchResult;
};

const PRIVATE_DISPATCHER_MODES: ReadonlySet<OwnerNotificationDispatcherMode> = new Set([
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
): OwnerNotificationHandoffEnvelopeResult {
  return {
    ok: false,
    violations,
    publicCorePersists: false,
    sendsNotification: false,
    createsExternalEffect: false,
    grantsApproval: false,
  };
}

function blockedDispatch(
  violations: readonly WorkUnitViolation[],
): OwnerNotificationDispatchResult {
  return {
    ok: false,
    violations,
    publicCorePersists: false,
    sendsNotification: false,
    createsExternalEffect: false,
    grantsApproval: false,
  };
}

function defaultPublicCoreNoopBinding(): OwnerNotificationBinding {
  return ownerNotificationBindingSchema.parse({
    schemaVersion: "helm.owner-notification-binding.v1",
    bindingRef: "public-core:no-owner-notification-dispatcher",
    dispatcherMode: "public_core_noop",
    dispatcherRef: "public-core:no-owner-notification-dispatcher",
    channel: "private_inbox",
    capabilities: {
      ownerRefsOnly: true,
      snapshotBoundMessages: true,
      humanOwnerAuthorityRequired: true,
      escalationPolicyRequired: true,
      contactDetailsStoredOutsidePublicCore: true,
      redactedEnvelopeOnly: true,
      privateDispatcherSends: false,
      privateDispatcherPersistsReceipt: false,
      publicCoreCarriesRealInstance: false,
      publicCorePersists: false,
      publicCoreSendsNotification: false,
      publicCoreWritesTarget: false,
      publicCoreActivatesRuntime: false,
      publicCoreGrantsApproval: false,
    },
  });
}

export function validateOwnerNotificationBinding(input: unknown): WorkUnitViolation[] {
  const parsed = ownerNotificationBindingSchema.safeParse(input);
  if (!parsed.success) {
    return schemaViolations("owner-notification-binding", parsed.error);
  }

  const binding = parsed.data;
  const capabilities = binding.capabilities;
  const violations: WorkUnitViolation[] = [];
  const privateMode = PRIVATE_DISPATCHER_MODES.has(binding.dispatcherMode);
  const publicNoop = binding.dispatcherMode === "public_core_noop";

  if (privateMode && !binding.authorityRef) {
    violations.push({
      rule: "owner-notification-private-authority-required",
      detail: binding.bindingRef,
    });
  }
  if (privateMode && !binding.deliveryPolicyRef) {
    violations.push({
      rule: "owner-notification-private-delivery-policy-required",
      detail: binding.bindingRef,
    });
  }
  if (!capabilities.ownerRefsOnly) {
    violations.push({
      rule: "owner-notification-owner-refs-only-required",
      detail: binding.bindingRef,
    });
  }
  if (!capabilities.snapshotBoundMessages) {
    violations.push({
      rule: "owner-notification-snapshot-bound-required",
      detail: binding.bindingRef,
    });
  }
  if (!capabilities.humanOwnerAuthorityRequired) {
    violations.push({
      rule: "owner-notification-human-owner-authority-required",
      detail: binding.bindingRef,
    });
  }
  if (!capabilities.escalationPolicyRequired) {
    violations.push({
      rule: "owner-notification-escalation-policy-required",
      detail: binding.bindingRef,
    });
  }
  if (!capabilities.contactDetailsStoredOutsidePublicCore) {
    violations.push({
      rule: "owner-notification-contact-details-private-required",
      detail: binding.bindingRef,
    });
  }
  if (!capabilities.redactedEnvelopeOnly) {
    violations.push({
      rule: "owner-notification-redacted-envelope-required",
      detail: binding.bindingRef,
    });
  }
  if (privateMode && !capabilities.privateDispatcherSends) {
    violations.push({
      rule: "owner-notification-private-dispatch-required",
      detail: binding.bindingRef,
    });
  }
  if (privateMode && !capabilities.privateDispatcherPersistsReceipt) {
    violations.push({
      rule: "owner-notification-private-receipt-persistence-required",
      detail: binding.bindingRef,
    });
  }
  if (publicNoop && capabilities.privateDispatcherSends) {
    violations.push({
      rule: "public-core-notification-dispatcher-cannot-send",
      detail: binding.bindingRef,
    });
  }
  if (publicNoop && capabilities.privateDispatcherPersistsReceipt) {
    violations.push({
      rule: "public-core-notification-dispatcher-cannot-persist-receipt",
      detail: binding.bindingRef,
    });
  }
  if (capabilities.publicCoreCarriesRealInstance) {
    violations.push({
      rule: "owner-notification-public-core-real-instance-forbidden",
      detail: binding.bindingRef,
    });
  }
  if (capabilities.publicCorePersists) {
    violations.push({
      rule: "owner-notification-public-core-persistence-forbidden",
      detail: binding.bindingRef,
    });
  }
  if (capabilities.publicCoreSendsNotification) {
    violations.push({
      rule: "owner-notification-public-core-send-forbidden",
      detail: binding.bindingRef,
    });
  }
  if (capabilities.publicCoreWritesTarget) {
    violations.push({
      rule: "owner-notification-public-core-write-forbidden",
      detail: binding.bindingRef,
    });
  }
  if (capabilities.publicCoreActivatesRuntime) {
    violations.push({
      rule: "owner-notification-public-core-activation-forbidden",
      detail: binding.bindingRef,
    });
  }
  if (capabilities.publicCoreGrantsApproval) {
    violations.push({
      rule: "owner-notification-public-core-approval-forbidden",
      detail: binding.bindingRef,
    });
  }

  return violations;
}

export function buildOwnerNotificationHandoffEnvelope(input: {
  readonly binding: unknown;
  readonly workUnit: unknown;
  readonly policy: unknown;
  readonly receipts: readonly unknown[];
  readonly requestedBy: WorkUnitActor;
  readonly requestedAt: string;
  readonly notificationKind: OwnerNotificationKind;
  readonly reason: string;
}): OwnerNotificationHandoffEnvelopeResult {
  const bindingParse = ownerNotificationBindingSchema.safeParse(input.binding);
  if (!bindingParse.success) {
    return blockedEnvelope(schemaViolations("owner-notification-binding", bindingParse.error));
  }

  const binding = bindingParse.data;
  const bindingViolations = validateOwnerNotificationBinding(binding);
  if (bindingViolations.length > 0) return blockedEnvelope(bindingViolations);

  const requestedByParse = workUnitActorSchema.safeParse(input.requestedBy);
  const workUnitParse = helmWorkUnitSchema.safeParse(input.workUnit);
  const policyParse = ownerLifecyclePolicySchema.safeParse(input.policy);
  const kindParse = ownerNotificationKindSchema.safeParse(input.notificationKind);
  const requestedAtParse = z.string().min(1).safeParse(input.requestedAt);
  const reasonParse = z.string().min(1).safeParse(input.reason);
  const parseViolations: WorkUnitViolation[] = [];
  if (!requestedByParse.success) {
    parseViolations.push(
      ...schemaViolations("owner-notification-requested-by", requestedByParse.error),
    );
  }
  if (!workUnitParse.success) {
    parseViolations.push(...schemaViolations("owner-notification-work-unit", workUnitParse.error));
  }
  if (!policyParse.success) {
    parseViolations.push(...schemaViolations("owner-notification-policy", policyParse.error));
  }
  if (!kindParse.success) {
    parseViolations.push(...schemaViolations("owner-notification-kind", kindParse.error));
  }
  if (!requestedAtParse.success) {
    parseViolations.push(
      ...schemaViolations("owner-notification-requested-at", requestedAtParse.error),
    );
  }
  if (!reasonParse.success) {
    parseViolations.push(...schemaViolations("owner-notification-reason", reasonParse.error));
  }
  if (
    !requestedByParse.success ||
    !workUnitParse.success ||
    !policyParse.success ||
    !kindParse.success ||
    !requestedAtParse.success ||
    !reasonParse.success
  ) {
    return blockedEnvelope(parseViolations);
  }

  const requestedBy = requestedByParse.data;
  const workUnit = workUnitParse.data;
  const policy = policyParse.data;
  const notificationKind = kindParse.data;
  const requestedAt = requestedAtParse.data;
  const reason = reasonParse.data;
  const readout = buildOwnerLifecycleReadout({
    workUnit,
    policy,
    receipts: input.receipts,
    now: requestedAt,
  });
  const violations: WorkUnitViolation[] = [];

  if (requestedBy.actorType === "ai") {
    violations.push({
      rule: "owner-notification-ai-request-not-authoritative",
      detail: requestedBy.actorRef,
    });
  }
  if (readout.blockers.length > 0) {
    violations.push(...readout.blockers);
  }

  const ownerRefs =
    notificationKind === "owner_escalation_requested"
      ? readout.escalationOwnerRefs
      : readout.pendingOwnerRefs;

  if (
    notificationKind === "owner_review_requested" &&
    !["waiting_for_owner", "waiting_for_all_owners", "escalation_required"].includes(
      readout.posture,
    )
  ) {
    violations.push({
      rule: "owner-notification-no-pending-owner",
      detail: readout.workUnitId,
    });
  }
  if (notificationKind === "owner_review_requested" && ownerRefs.length === 0) {
    violations.push({
      rule: "owner-notification-no-pending-owner",
      detail: readout.workUnitId,
    });
  }
  if (
    notificationKind === "owner_escalation_requested" &&
    (readout.posture !== "escalation_required" || ownerRefs.length === 0)
  ) {
    violations.push({
      rule: "owner-notification-escalation-not-required",
      detail: readout.workUnitId,
    });
  }
  if (violations.length > 0) return blockedEnvelope(violations);

  const envelope = ownerNotificationHandoffEnvelopeSchema.parse({
    schemaVersion: "helm.owner-notification-handoff-envelope.v1",
    envelopeId: `owner-notification-envelope:${binding.bindingRef}:${workUnit.id}:${notificationKind}:${requestedAt}`,
    bindingRef: binding.bindingRef,
    dispatcherMode: binding.dispatcherMode,
    dispatcherRef: binding.dispatcherRef,
    channel: binding.channel,
    authorityRef: binding.authorityRef,
    deliveryPolicyRef: binding.deliveryPolicyRef,
    workUnitId: workUnit.id,
    snapshotHash: computeWorkUnitSnapshotHash(workUnit),
    lifecyclePosture: readout.posture,
    notificationKind,
    ownerRefs,
    pendingOwnerRefs: readout.pendingOwnerRefs,
    escalationOwnerRefs: readout.escalationOwnerRefs,
    reason,
    requestedBy,
    requestedAt,
    privateDispatcherRequired: PRIVATE_DISPATCHER_MODES.has(binding.dispatcherMode),
    deliveryReceiptRequired: true,
    readinessClaim: "not_readiness",
    approvalClaim: "not_approval",
    publicCoreCarriesRealInstance: false,
    publicCorePersists: false,
    createsExternalEffect: false,
    sendsNotification: false,
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
    sendsNotification: false,
    createsExternalEffect: false,
    grantsApproval: false,
  };
}

export function buildPublicCoreNoopOwnerNotificationDispatcher(): OwnerNotificationDispatcher {
  const binding = defaultPublicCoreNoopBinding();

  return {
    binding,
    dispatch: (envelope: unknown) => {
      const parsed = ownerNotificationHandoffEnvelopeSchema.safeParse(envelope);
      if (!parsed.success) {
        return blockedDispatch(schemaViolations("owner-notification-envelope", parsed.error));
      }

      return blockedDispatch([
        {
          rule: "public-core-owner-notification-dispatcher-is-noop",
          detail: parsed.data.envelopeId,
        },
      ]);
    },
  };
}
