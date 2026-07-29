import { z } from "zod";

import {
  WorkBuddyCollaborationError,
  workBuddyInstantSchema,
  workBuddySafeRefSchema,
} from "./contracts";

export const caioDeliveryHashSchema = z
  .string()
  .regex(/^sha256:[a-f0-9]{64}$/);

export const CAIO_DELIVERY_OBJECT_KINDS = [
  "operating_question_candidate",
  "caio_advice",
  "decision_record",
  "supervision_signal",
] as const;

export const caioDeliveryObjectKindSchema = z.enum(
  CAIO_DELIVERY_OBJECT_KINDS,
);
export type CaioDeliveryObjectKind = z.infer<
  typeof caioDeliveryObjectKindSchema
>;

export const caioCanonicalObjectRefSchema = z
  .object({
    schemaVersion: z.literal("helm.caio-canonical-object-ref/v1"),
    objectKind: caioDeliveryObjectKindSchema,
    objectId: workBuddySafeRefSchema,
    objectVersion: z.number().int().positive(),
    objectHash: caioDeliveryHashSchema,
  })
  .strict();

export type CaioCanonicalObjectRef = z.infer<
  typeof caioCanonicalObjectRefSchema
>;

export const caioDeliverySeveritySchema = z.enum([
  "critical",
  "normal",
]);
export type CaioDeliverySeverity = z.infer<
  typeof caioDeliverySeveritySchema
>;

export const CAIO_DELIVERY_STATUSES = [
  "pending",
  "delivered",
  "opened",
  "answered",
  "snoozed",
  "declined",
  "withdrawn",
  "expired",
] as const;

export const caioDeliveryStatusSchema = z.enum(
  CAIO_DELIVERY_STATUSES,
);
export type CaioDeliveryStatus = z.infer<
  typeof caioDeliveryStatusSchema
>;

const caioDeliveryCategorySchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z][a-z0-9_]*$/);

const caioDeliveryBoundarySchema = z
  .object({
    authorityEffect: z.literal("none"),
    sourcePayloadCopied: z.literal(false),
    canonicalMutationAuthorityGranted: z.literal(false),
    externalExecutionAllowed: z.literal(false),
  })
  .strict();

export const caioDeliveryEnvelopeSchema = z
  .object({
    schemaVersion: z.literal("helm.caio-delivery-envelope/v1"),
    deliveryObjectId: workBuddySafeRefSchema,
    workspaceId: workBuddySafeRefSchema,
    source: caioCanonicalObjectRefSchema,
    deliveryKey: workBuddySafeRefSchema,
    severity: caioDeliverySeveritySchema,
    category: caioDeliveryCategorySchema,
    triggerRuleRef: workBuddySafeRefSchema,
    triggerSnapshotHash: caioDeliveryHashSchema,
    validUntil: workBuddyInstantSchema,
    deliveryVersion: z.number().int().positive(),
    status: caioDeliveryStatusSchema,
    snoozedUntil: workBuddyInstantSchema.nullable(),
    createdAt: workBuddyInstantSchema,
    updatedAt: workBuddyInstantSchema,
    boundary: caioDeliveryBoundarySchema,
  })
  .strict();

export type CaioDeliveryEnvelope = z.infer<
  typeof caioDeliveryEnvelopeSchema
>;

export const caioDeliveryCursorSchema = z
  .object({
    schemaVersion: z.literal("helm.caio-delivery-cursor/v1"),
    workspaceId: workBuddySafeRefSchema,
    clientId: workBuddySafeRefSchema,
    criticalSequence: z.number().int().nonnegative(),
    normalSequence: z.number().int().nonnegative(),
  })
  .strict();

export type CaioDeliveryCursor = z.infer<
  typeof caioDeliveryCursorSchema
>;

export const caioDeliveryClaimSchema = z
  .object({
    schemaVersion: z.literal("helm.caio-delivery-claim/v1"),
    deliveryClaimId: workBuddySafeRefSchema,
    workspaceId: workBuddySafeRefSchema,
    clientId: workBuddySafeRefSchema,
    deliveryObjectId: workBuddySafeRefSchema,
    deliveryKey: workBuddySafeRefSchema,
    deliveryVersion: z.number().int().positive(),
    severity: caioDeliverySeveritySchema,
    claimedAt: workBuddyInstantSchema,
  })
  .strict();

export type CaioDeliveryClaim = z.infer<
  typeof caioDeliveryClaimSchema
>;

export const caioDeliveryPresentationSchema = z
  .object({
    schemaVersion: z.literal("helm.caio-delivery-presentation/v1"),
    presentationId: workBuddySafeRefSchema,
    deliveryClaimId: workBuddySafeRefSchema,
    workspaceId: workBuddySafeRefSchema,
    clientId: workBuddySafeRefSchema,
    severity: caioDeliverySeveritySchema,
    sequence: z.number().int().positive(),
    cause: z.enum(["initial", "snooze_elapsed"]),
    presentedAt: workBuddyInstantSchema,
  })
  .strict();

export type CaioDeliveryPresentation = z.infer<
  typeof caioDeliveryPresentationSchema
>;

const caioSuppressionScopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("workspace") }).strict(),
  z
    .object({
      kind: z.literal("object_kind"),
      objectKind: caioDeliveryObjectKindSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("object"),
      objectKind: caioDeliveryObjectKindSchema,
      objectId: workBuddySafeRefSchema,
    })
    .strict(),
]);

export const caioDeliverySuppressionSchema = z
  .object({
    schemaVersion: z.literal("helm.caio-delivery-suppression/v1"),
    suppressionId: workBuddySafeRefSchema,
    workspaceId: workBuddySafeRefSchema,
    category: caioDeliveryCategorySchema,
    scope: caioSuppressionScopeSchema,
    validFrom: workBuddyInstantSchema,
    validUntil: workBuddyInstantSchema,
    revokedAt: workBuddyInstantSchema.nullable(),
  })
  .strict();

export type CaioDeliverySuppression = z.infer<
  typeof caioDeliverySuppressionSchema
>;

const TERMINAL_STATUSES = new Set<CaioDeliveryStatus>([
  "answered",
  "declined",
  "withdrawn",
  "expired",
]);

function statusSet(
  ...statuses: readonly CaioDeliveryStatus[]
): ReadonlySet<CaioDeliveryStatus> {
  return new Set<CaioDeliveryStatus>(statuses);
}

const ALLOWED_TRANSITIONS: Readonly<
  Record<CaioDeliveryStatus, ReadonlySet<CaioDeliveryStatus>>
> = Object.freeze({
  pending: statusSet("delivered", "withdrawn", "expired"),
  delivered: statusSet(
    "opened",
    "snoozed",
    "declined",
    "withdrawn",
    "expired",
  ),
  opened: statusSet(
    "answered",
    "snoozed",
    "declined",
    "withdrawn",
    "expired",
  ),
  answered: statusSet(),
  snoozed: statusSet("pending", "withdrawn", "expired"),
  declined: statusSet(),
  withdrawn: statusSet(),
  expired: statusSet(),
});

function parseInstant(value: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new WorkBuddyCollaborationError(
      "INVALID_TOOL_INPUT",
      "A valid ISO-8601 instant is required.",
    );
  }
  return parsed;
}

function freezeEnvelope(
  envelope: CaioDeliveryEnvelope,
): CaioDeliveryEnvelope {
  return Object.freeze({
    ...envelope,
    source: Object.freeze({ ...envelope.source }),
    boundary: Object.freeze({ ...envelope.boundary }),
  });
}

export function createCaioDeliveryEnvelope(input: {
  deliveryObjectId: string;
  workspaceId: string;
  source: CaioCanonicalObjectRef;
  deliveryKey: string;
  severity: CaioDeliverySeverity;
  category: string;
  triggerRuleRef: string;
  triggerSnapshotHash: string;
  validUntil: string;
  deliveryVersion: number;
  now: string;
}): CaioDeliveryEnvelope {
  if (parseInstant(input.validUntil) <= parseInstant(input.now)) {
    throw new WorkBuddyCollaborationError(
      "OBJECT_EXPIRED",
      "A delivery must be valid after its creation instant.",
    );
  }

  const envelope = caioDeliveryEnvelopeSchema.parse({
    schemaVersion: "helm.caio-delivery-envelope/v1",
    deliveryObjectId: input.deliveryObjectId,
    workspaceId: input.workspaceId,
    source: input.source,
    deliveryKey: input.deliveryKey,
    severity: input.severity,
    category: input.category,
    triggerRuleRef: input.triggerRuleRef,
    triggerSnapshotHash: input.triggerSnapshotHash,
    validUntil: input.validUntil,
    deliveryVersion: input.deliveryVersion,
    status: "pending",
    snoozedUntil: null,
    createdAt: input.now,
    updatedAt: input.now,
    boundary: {
      authorityEffect: "none",
      sourcePayloadCopied: false,
      canonicalMutationAuthorityGranted: false,
      externalExecutionAllowed: false,
    },
  });

  return freezeEnvelope(envelope);
}

export function isCaioDeliveryTerminal(
  status: CaioDeliveryStatus,
): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function transitionCaioDeliveryEnvelope(input: {
  envelope: CaioDeliveryEnvelope;
  status: CaioDeliveryStatus;
  transitionedAt: string;
  snoozedUntil?: string;
}): CaioDeliveryEnvelope {
  const envelope = caioDeliveryEnvelopeSchema.parse(input.envelope);
  const transitionedAt = parseInstant(input.transitionedAt);
  const validUntil = parseInstant(envelope.validUntil);

  if (transitionedAt < parseInstant(envelope.updatedAt)) {
    throw new WorkBuddyCollaborationError(
      "VERSION_CONFLICT",
      "A delivery transition cannot move time backwards.",
    );
  }
  if (envelope.status === input.status) {
    return freezeEnvelope(envelope);
  }
  if (isCaioDeliveryTerminal(envelope.status)) {
    throw new WorkBuddyCollaborationError(
      "VERSION_CONFLICT",
      "A terminal delivery cannot be reopened.",
    );
  }
  if (!ALLOWED_TRANSITIONS[envelope.status].has(input.status)) {
    throw new WorkBuddyCollaborationError(
      "VERSION_CONFLICT",
      `The ${envelope.status} to ${input.status} delivery transition is invalid.`,
    );
  }
  if (input.status === "expired" && transitionedAt < validUntil) {
    throw new WorkBuddyCollaborationError(
      "VERSION_CONFLICT",
      "A delivery cannot expire before its validity deadline.",
    );
  }
  if (input.status !== "expired" && transitionedAt >= validUntil) {
    throw new WorkBuddyCollaborationError(
      "OBJECT_EXPIRED",
      "The delivery validity deadline has passed.",
    );
  }

  let snoozedUntil: string | null = null;
  if (input.status === "snoozed") {
    if (!input.snoozedUntil) {
      throw new WorkBuddyCollaborationError(
        "INVALID_TOOL_INPUT",
        "A snoozed delivery requires a snooze deadline.",
      );
    }
    const snoozeDeadline = parseInstant(input.snoozedUntil);
    if (
      snoozeDeadline <= transitionedAt ||
      snoozeDeadline > validUntil
    ) {
      throw new WorkBuddyCollaborationError(
        "INVALID_TOOL_INPUT",
        "The snooze deadline must be future and within delivery validity.",
      );
    }
    snoozedUntil = input.snoozedUntil;
  }
  if (
    envelope.status === "snoozed" &&
    input.status === "pending" &&
    (!envelope.snoozedUntil ||
      transitionedAt < parseInstant(envelope.snoozedUntil))
  ) {
    throw new WorkBuddyCollaborationError(
      "VERSION_CONFLICT",
      "The delivery snooze window is still active.",
    );
  }

  return freezeEnvelope(
    caioDeliveryEnvelopeSchema.parse({
      ...envelope,
      status: input.status,
      snoozedUntil,
      updatedAt: input.transitionedAt,
    }),
  );
}

export function createCaioDeliveryCursor(input: {
  workspaceId: string;
  clientId: string;
}): CaioDeliveryCursor {
  return Object.freeze(
    caioDeliveryCursorSchema.parse({
      schemaVersion: "helm.caio-delivery-cursor/v1",
      workspaceId: input.workspaceId,
      clientId: input.clientId,
      criticalSequence: 0,
      normalSequence: 0,
    }),
  );
}

export function mergeCaioDeliveryCursors(
  left: CaioDeliveryCursor,
  right: CaioDeliveryCursor,
): CaioDeliveryCursor {
  const parsedLeft = caioDeliveryCursorSchema.parse(left);
  const parsedRight = caioDeliveryCursorSchema.parse(right);
  if (
    parsedLeft.workspaceId !== parsedRight.workspaceId ||
    parsedLeft.clientId !== parsedRight.clientId
  ) {
    throw new WorkBuddyCollaborationError(
      "VERSION_CONFLICT",
      "Delivery cursor bindings do not match.",
    );
  }
  return Object.freeze({
    ...parsedLeft,
    criticalSequence: Math.max(
      parsedLeft.criticalSequence,
      parsedRight.criticalSequence,
    ),
    normalSequence: Math.max(
      parsedLeft.normalSequence,
      parsedRight.normalSequence,
    ),
  });
}
