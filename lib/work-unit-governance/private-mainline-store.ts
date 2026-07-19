import { z } from "zod";

import {
  computeWorkUnitSnapshotHash,
  helmWorkUnitSchema,
  workUnitActorSchema,
  type WorkUnitActor,
  type WorkUnitViolation,
} from "./contracts";
import {
  planPrivateMainlineLedgerAppend,
  privateMainlineLedgerEventSchema,
  privateMainlineLedgerSchema,
  type PrivateMainlineLedger,
  type PrivateMainlineLedgerAppendPlan,
} from "./mainline-ledger";

export const privateMainlineStoreModeSchema = z.enum([
  "public_core_noop",
  "private_control_plane",
  "tenant_overlay",
  "private_pack_adapter",
]);
export type PrivateMainlineStoreMode = z.infer<typeof privateMainlineStoreModeSchema>;

export const privateMainlineStoreCapabilitiesSchema = z
  .object({
    appendOnly: z.boolean(),
    snapshotBoundReceipts: z.boolean(),
    conflictKeySerialization: z.boolean(),
    humanOwnerReceiptRequired: z.boolean(),
    activationAuthoritySeparated: z.boolean(),
    privateStorePersists: z.boolean(),
    publicCoreCarriesRealInstance: z.boolean(),
    publicCorePersists: z.boolean(),
    publicCoreWritesPrivateMainline: z.boolean(),
    publicCoreSendsExternally: z.boolean(),
    publicCoreActivatesRuntime: z.boolean(),
  })
  .strict();
export type PrivateMainlineStoreCapabilities = z.infer<
  typeof privateMainlineStoreCapabilitiesSchema
>;

export const privateMainlineStoreBindingSchema = z
  .object({
    schemaVersion: z.literal("helm.private-mainline-store-binding.v1"),
    bindingRef: z.string().min(1),
    storeMode: privateMainlineStoreModeSchema,
    storeRef: z.string().min(1),
    authorityRef: z.string().min(1).optional(),
    capabilities: privateMainlineStoreCapabilitiesSchema,
  })
  .strict();
export type PrivateMainlineStoreBinding = z.infer<
  typeof privateMainlineStoreBindingSchema
>;

export const privateMainlineStoreAppendEnvelopeSchema = z
  .object({
    schemaVersion: z.literal("helm.private-mainline-store-append-envelope.v1"),
    envelopeId: z.string().min(1),
    bindingRef: z.string().min(1),
    storeMode: privateMainlineStoreModeSchema,
    storeRef: z.string().min(1),
    authorityRef: z.string().min(1).optional(),
    ledgerRef: z.string().min(1),
    workUnitId: z.string().min(1),
    eventId: z.string().min(1),
    snapshotHash: z.string().min(1),
    conflictKeys: z.array(z.string().min(1)).min(1),
    requestedBy: workUnitActorSchema,
    requestedAt: z.string().min(1),
    event: privateMainlineLedgerEventSchema,
    appendPlanAuditNote: z.string().min(1),
    privateStoreRequired: z.boolean(),
    readinessClaim: z.literal("not_readiness"),
    publicCoreCarriesRealInstance: z.literal(false),
    publicCorePersists: z.literal(false),
    publicCoreWritesPrivateMainline: z.literal(false),
    createsExternalEffect: z.literal(false),
    sendsExternally: z.literal(false),
    writesTarget: z.literal(false),
    activatesRuntime: z.literal(false),
    grantsApproval: z.literal(false),
  })
  .strict();
export type PrivateMainlineStoreAppendEnvelope = z.infer<
  typeof privateMainlineStoreAppendEnvelopeSchema
>;

type SuccessfulLedgerAppendPlan = Extract<PrivateMainlineLedgerAppendPlan, { ok: true }>;

export type PrivateMainlineStoreAppendEnvelopeResult =
  | {
      readonly ok: true;
      readonly binding: PrivateMainlineStoreBinding;
      readonly envelope: PrivateMainlineStoreAppendEnvelope;
      readonly appendPlan: SuccessfulLedgerAppendPlan;
      readonly publicCorePersists: false;
      readonly publicCoreWritesPrivateMainline: false;
      readonly createsExternalEffect: false;
    }
  | {
      readonly ok: false;
      readonly violations: readonly WorkUnitViolation[];
      readonly publicCorePersists: false;
      readonly publicCoreWritesPrivateMainline: false;
      readonly createsExternalEffect: false;
    };

export type PrivateMainlineStoreAppendResult =
  | {
      readonly ok: true;
      readonly eventId: string;
      readonly privateReceiptRef: string;
      readonly publicCorePersists: false;
      readonly publicCoreWritesPrivateMainline: false;
      readonly createsExternalEffect: false;
    }
  | {
      readonly ok: false;
      readonly violations: readonly WorkUnitViolation[];
      readonly publicCorePersists: false;
      readonly publicCoreWritesPrivateMainline: false;
      readonly createsExternalEffect: false;
    };

export type PrivateMainlineStore = {
  readonly binding: PrivateMainlineStoreBinding;
  readonly append: (envelope: unknown) => PrivateMainlineStoreAppendResult;
};

const PRIVATE_STORE_MODES: ReadonlySet<PrivateMainlineStoreMode> = new Set([
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
): PrivateMainlineStoreAppendEnvelopeResult {
  return {
    ok: false,
    violations,
    publicCorePersists: false,
    publicCoreWritesPrivateMainline: false,
    createsExternalEffect: false,
  };
}

function blockedAppend(violations: readonly WorkUnitViolation[]): PrivateMainlineStoreAppendResult {
  return {
    ok: false,
    violations,
    publicCorePersists: false,
    publicCoreWritesPrivateMainline: false,
    createsExternalEffect: false,
  };
}

function defaultPublicCoreNoopBinding(): PrivateMainlineStoreBinding {
  return privateMainlineStoreBindingSchema.parse({
    schemaVersion: "helm.private-mainline-store-binding.v1",
    bindingRef: "public-core:no-private-mainline-store",
    storeMode: "public_core_noop",
    storeRef: "public-core:no-private-mainline-store",
    capabilities: {
      appendOnly: true,
      snapshotBoundReceipts: true,
      conflictKeySerialization: true,
      humanOwnerReceiptRequired: true,
      activationAuthoritySeparated: true,
      privateStorePersists: false,
      publicCoreCarriesRealInstance: false,
      publicCorePersists: false,
      publicCoreWritesPrivateMainline: false,
      publicCoreSendsExternally: false,
      publicCoreActivatesRuntime: false,
    },
  });
}

export function validatePrivateMainlineStoreBinding(input: unknown): WorkUnitViolation[] {
  const parsed = privateMainlineStoreBindingSchema.safeParse(input);
  if (!parsed.success) {
    return schemaViolations("private-mainline-store-binding", parsed.error);
  }

  const binding = parsed.data;
  const capabilities = binding.capabilities;
  const violations: WorkUnitViolation[] = [];

  if (PRIVATE_STORE_MODES.has(binding.storeMode) && !binding.authorityRef) {
    violations.push({
      rule: "private-store-authority-required",
      detail: binding.bindingRef,
    });
  }
  if (!capabilities.appendOnly) {
    violations.push({
      rule: "private-store-append-only-required",
      detail: binding.bindingRef,
    });
  }
  if (!capabilities.snapshotBoundReceipts) {
    violations.push({
      rule: "private-store-snapshot-bound-receipts-required",
      detail: binding.bindingRef,
    });
  }
  if (!capabilities.conflictKeySerialization) {
    violations.push({
      rule: "private-store-conflict-serialization-required",
      detail: binding.bindingRef,
    });
  }
  if (!capabilities.humanOwnerReceiptRequired) {
    violations.push({
      rule: "private-store-human-owner-receipt-required",
      detail: binding.bindingRef,
    });
  }
  if (!capabilities.activationAuthoritySeparated) {
    violations.push({
      rule: "private-store-activation-authority-separation-required",
      detail: binding.bindingRef,
    });
  }
  if (binding.storeMode === "public_core_noop" && capabilities.privateStorePersists) {
    violations.push({
      rule: "public-core-noop-cannot-persist-private-store",
      detail: binding.bindingRef,
    });
  }
  if (PRIVATE_STORE_MODES.has(binding.storeMode) && !capabilities.privateStorePersists) {
    violations.push({
      rule: "private-store-persistence-required",
      detail: binding.bindingRef,
    });
  }
  if (capabilities.publicCoreCarriesRealInstance) {
    violations.push({
      rule: "private-store-public-core-real-instance-forbidden",
      detail: binding.bindingRef,
    });
  }
  if (capabilities.publicCorePersists) {
    violations.push({
      rule: "private-store-public-core-persistence-forbidden",
      detail: binding.bindingRef,
    });
  }
  if (capabilities.publicCoreWritesPrivateMainline) {
    violations.push({
      rule: "private-store-public-core-write-forbidden",
      detail: binding.bindingRef,
    });
  }
  if (capabilities.publicCoreSendsExternally) {
    violations.push({
      rule: "private-store-public-core-send-forbidden",
      detail: binding.bindingRef,
    });
  }
  if (capabilities.publicCoreActivatesRuntime) {
    violations.push({
      rule: "private-store-public-core-activation-forbidden",
      detail: binding.bindingRef,
    });
  }

  return violations;
}

export function buildPrivateMainlineStoreAppendEnvelope(input: {
  readonly binding: unknown;
  readonly ledger: PrivateMainlineLedger;
  readonly workUnit: unknown;
  readonly event: unknown;
  readonly requestedBy: WorkUnitActor;
  readonly requestedAt: string;
}): PrivateMainlineStoreAppendEnvelopeResult {
  const bindingParse = privateMainlineStoreBindingSchema.safeParse(input.binding);
  if (!bindingParse.success) {
    return blockedEnvelope(schemaViolations("private-mainline-store-binding", bindingParse.error));
  }

  const binding = bindingParse.data;
  const bindingViolations = validatePrivateMainlineStoreBinding(binding);
  if (bindingViolations.length > 0) {
    return blockedEnvelope(bindingViolations);
  }

  const requestedByParse = workUnitActorSchema.safeParse(input.requestedBy);
  const ledgerParse = privateMainlineLedgerSchema.safeParse(input.ledger);
  const workUnitParse = helmWorkUnitSchema.safeParse(input.workUnit);
  const eventParse = privateMainlineLedgerEventSchema.safeParse(input.event);
  const parseViolations: WorkUnitViolation[] = [];
  if (!requestedByParse.success) {
    parseViolations.push(
      ...schemaViolations("private-mainline-store-requested-by", requestedByParse.error),
    );
  }
  if (!ledgerParse.success) {
    parseViolations.push(...schemaViolations("private-mainline-store-ledger", ledgerParse.error));
  }
  if (!workUnitParse.success) {
    parseViolations.push(
      ...schemaViolations("private-mainline-store-work-unit", workUnitParse.error),
    );
  }
  if (!eventParse.success) {
    parseViolations.push(...schemaViolations("private-mainline-store-event", eventParse.error));
  }
  if (
    !requestedByParse.success ||
    !ledgerParse.success ||
    !workUnitParse.success ||
    !eventParse.success
  ) {
    return blockedEnvelope(parseViolations);
  }

  const requestedBy = requestedByParse.data;
  const ledger = ledgerParse.data;
  const workUnit = workUnitParse.data;
  const event = eventParse.data;
  const appendPlan = planPrivateMainlineLedgerAppend({ ledger, workUnit, event });
  if (!appendPlan.ok) {
    return blockedEnvelope(appendPlan.violations);
  }

  const envelope = privateMainlineStoreAppendEnvelopeSchema.parse({
    schemaVersion: "helm.private-mainline-store-append-envelope.v1",
    envelopeId: `mainline-store-envelope:${binding.bindingRef}:${event.eventId}:${input.requestedAt}`,
    bindingRef: binding.bindingRef,
    storeMode: binding.storeMode,
    storeRef: binding.storeRef,
    authorityRef: binding.authorityRef,
    ledgerRef: ledger.ledgerRef,
    workUnitId: workUnit.id,
    eventId: event.eventId,
    snapshotHash: computeWorkUnitSnapshotHash(workUnit),
    conflictKeys: workUnit.conflictKeys,
    requestedBy,
    requestedAt: input.requestedAt,
    event,
    appendPlanAuditNote: appendPlan.auditNote,
    privateStoreRequired: PRIVATE_STORE_MODES.has(binding.storeMode),
    readinessClaim: "not_readiness",
    publicCoreCarriesRealInstance: false,
    publicCorePersists: false,
    publicCoreWritesPrivateMainline: false,
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
    appendPlan,
    publicCorePersists: false,
    publicCoreWritesPrivateMainline: false,
    createsExternalEffect: false,
  };
}

export function buildPublicCoreNoopPrivateMainlineStore(): PrivateMainlineStore {
  const binding = defaultPublicCoreNoopBinding();

  return {
    binding,
    append: (envelope: unknown) => {
      const parsed = privateMainlineStoreAppendEnvelopeSchema.safeParse(envelope);
      if (!parsed.success) {
        return blockedAppend(schemaViolations("private-mainline-store-envelope", parsed.error));
      }

      return blockedAppend([
        {
          rule: "public-core-private-mainline-store-is-noop",
          detail: parsed.data.eventId,
        },
      ]);
    },
  };
}
