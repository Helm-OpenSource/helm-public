import "server-only";

import {
  Prisma,
  type WorkBuddyDeliveryClaim as StoredClaim,
  type WorkBuddyDeliveryEnvelope as StoredEnvelope,
  type WorkBuddyDeliveryPresentation as StoredPresentation,
  type WorkBuddyDeliverySuppression as StoredSuppression,
} from "@prisma/client";

import { db } from "@/lib/db";
import { runWithWriteConflictRetry } from "@/lib/db/conflict-aware-write";
import {
  canonicalJson,
  sha256,
} from "@/lib/expert-capability/hashing";
import {
  WorkBuddyCollaborationError,
} from "@/lib/caio-collaboration/contracts";
import {
  caioDeliveryClaimSchema,
  caioDeliveryCursorSchema,
  caioDeliveryEnvelopeSchema,
  caioDeliveryPresentationSchema,
  caioDeliverySuppressionSchema,
  transitionCaioDeliveryEnvelope,
  type CaioDeliveryClaim,
  type CaioDeliveryEnvelope,
  type CaioDeliveryPresentation,
  type CaioDeliverySeverity,
  type CaioDeliveryStatus,
  type CaioDeliverySuppression,
} from "@/lib/caio-collaboration/delivery-contracts";
import {
  type CaioDeliveryPollResult,
  type CaioDeliveryStore,
} from "@/lib/caio-collaboration/delivery.service";

type Tx = Prisma.TransactionClient;

const TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10_000,
  timeout: 30_000,
} as const;

const WRITE_RETRY_OPTIONS = {
  maxAttempts: 8,
  retryDelayMs: 50,
} as const;

const OPEN_STATUSES: readonly CaioDeliveryStatus[] = [
  "pending",
  "delivered",
  "opened",
  "snoozed",
];

function sameValue(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

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

function parseStoredJson<T>(
  value: string,
  parser: (input: unknown) => T,
  expectedHash: string,
): T {
  let raw: unknown;
  try {
    raw = JSON.parse(value);
  } catch {
    throw new WorkBuddyCollaborationError(
      "INTERNAL_ERROR",
      "A stored WorkBuddy ledger record is not valid JSON.",
    );
  }
  const parsed = parser(raw);
  if (sha256(canonicalJson(parsed)) !== expectedHash) {
    throw new WorkBuddyCollaborationError(
      "INTERNAL_ERROR",
      "A stored WorkBuddy ledger record failed its content hash.",
    );
  }
  return parsed;
}

export function parseStoredEnvelope(
  row: StoredEnvelope,
): CaioDeliveryEnvelope {
  const envelope = parseStoredJson(
    row.envelopeJson,
    (value) => caioDeliveryEnvelopeSchema.parse(value),
    row.contentHash,
  );
  if (
    envelope.deliveryObjectId !== row.id ||
    envelope.workspaceId !== row.workspaceId ||
    envelope.deliveryKey !== row.deliveryKey ||
    envelope.deliveryVersion !== row.deliveryVersion ||
    envelope.source.objectKind !== row.sourceObjectKind ||
    envelope.source.objectId !== row.sourceObjectId ||
    envelope.source.objectVersion !== row.sourceObjectVersion ||
    envelope.source.objectHash !== row.sourceObjectHash ||
    envelope.severity !== row.severity ||
    envelope.category !== row.category ||
    envelope.triggerRuleRef !== row.triggerRuleRef ||
    envelope.triggerSnapshotHash !== row.triggerSnapshotHash ||
    envelope.validUntil !== row.validUntil.toISOString() ||
    envelope.status !== row.status ||
    envelope.snoozedUntil !== row.snoozedUntil?.toISOString() &&
      !(envelope.snoozedUntil === null && row.snoozedUntil === null) ||
    envelope.createdAt !== row.createdAt.toISOString() ||
    envelope.updatedAt !== row.updatedAt.toISOString()
  ) {
    throw new WorkBuddyCollaborationError(
      "INTERNAL_ERROR",
      "A stored WorkBuddy delivery envelope has inconsistent indexed fields.",
    );
  }
  return Object.freeze({
    ...envelope,
    source: Object.freeze({ ...envelope.source }),
    boundary: Object.freeze({ ...envelope.boundary }),
  });
}

export function parseStoredClaim(
  row: StoredClaim,
): CaioDeliveryClaim {
  const claim = parseStoredJson(
    row.claimJson,
    (value) => caioDeliveryClaimSchema.parse(value),
    row.contentHash,
  );
  if (
    claim.deliveryClaimId !== row.id ||
    claim.workspaceId !== row.workspaceId ||
    claim.clientId !== row.clientId ||
    claim.deliveryObjectId !== row.deliveryObjectId ||
    claim.deliveryKey !== row.deliveryKey ||
    claim.deliveryVersion !== row.deliveryVersion ||
    claim.severity !== row.severity ||
    claim.claimedAt !== row.claimedAt.toISOString()
  ) {
    throw new WorkBuddyCollaborationError(
      "INTERNAL_ERROR",
      "A stored WorkBuddy delivery claim has inconsistent indexed fields.",
    );
  }
  return Object.freeze(claim);
}

function parseStoredPresentation(
  row: StoredPresentation,
): CaioDeliveryPresentation {
  const presentation = parseStoredJson(
    row.presentationJson,
    (value) => caioDeliveryPresentationSchema.parse(value),
    row.contentHash,
  );
  if (
    presentation.presentationId !== row.id ||
    presentation.workspaceId !== row.workspaceId ||
    presentation.deliveryClaimId !== row.deliveryClaimId ||
    presentation.clientId !== row.clientId ||
    presentation.severity !== row.severity ||
    presentation.sequence !== row.sequence ||
    presentation.cause !== row.cause ||
    presentation.presentedAt !== row.presentedAt.toISOString()
  ) {
    throw new WorkBuddyCollaborationError(
      "INTERNAL_ERROR",
      "A stored WorkBuddy presentation has inconsistent indexed fields.",
    );
  }
  return Object.freeze(presentation);
}

function parseStoredSuppression(
  row: StoredSuppression,
): CaioDeliverySuppression {
  const suppression = parseStoredJson(
    row.suppressionJson,
    (value) => caioDeliverySuppressionSchema.parse(value),
    row.contentHash,
  );
  const scopeObjectKind =
    suppression.scope.kind === "workspace"
      ? null
      : suppression.scope.objectKind;
  const scopeObjectId =
    suppression.scope.kind === "object"
      ? suppression.scope.objectId
      : null;
  if (
    suppression.suppressionId !== row.id ||
    suppression.workspaceId !== row.workspaceId ||
    suppression.category !== row.category ||
    suppression.scope.kind !== row.scopeKind ||
    scopeObjectKind !== row.objectKind ||
    scopeObjectId !== row.objectId ||
    suppression.validFrom !== row.validFrom.toISOString() ||
    suppression.validUntil !== row.validUntil.toISOString() ||
    suppression.revokedAt !== row.revokedAt?.toISOString() &&
      !(suppression.revokedAt === null && row.revokedAt === null)
  ) {
    throw new WorkBuddyCollaborationError(
      "INTERNAL_ERROR",
      "A stored WorkBuddy suppression has inconsistent indexed fields.",
    );
  }
  return Object.freeze({
    ...suppression,
    scope: Object.freeze({ ...suppression.scope }),
  });
}

async function lockWorkspace(tx: Tx, workspaceId: string): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM Workspace WHERE id = ${workspaceId} FOR UPDATE`;
  if (rows.length !== 1) {
    throw new WorkBuddyCollaborationError(
      "INVALID_TOOL_INPUT",
      "The WorkBuddy workspace does not exist.",
    );
  }
}

export function envelopeWriteData(envelope: CaioDeliveryEnvelope) {
  const envelopeJson = canonicalJson(envelope);
  return {
    deliveryKey: envelope.deliveryKey,
    deliveryVersion: envelope.deliveryVersion,
    sourceObjectKind: envelope.source.objectKind,
    sourceObjectId: envelope.source.objectId,
    sourceObjectVersion: envelope.source.objectVersion,
    sourceObjectHash: envelope.source.objectHash,
    severity: envelope.severity,
    category: envelope.category,
    triggerRuleRef: envelope.triggerRuleRef,
    triggerSnapshotHash: envelope.triggerSnapshotHash,
    validUntil: new Date(envelope.validUntil),
    status: envelope.status,
    snoozedUntil: envelope.snoozedUntil
      ? new Date(envelope.snoozedUntil)
      : null,
    envelopeJson,
    contentHash: sha256(envelopeJson),
    createdAt: new Date(envelope.createdAt),
    updatedAt: new Date(envelope.updatedAt),
  };
}

export function envelopeStateWriteData(
  envelope: CaioDeliveryEnvelope,
) {
  const envelopeJson = canonicalJson(envelope);
  return {
    status: envelope.status,
    snoozedUntil: envelope.snoozedUntil
      ? new Date(envelope.snoozedUntil)
      : null,
    envelopeJson,
    contentHash: sha256(envelopeJson),
    updatedAt: new Date(envelope.updatedAt),
  };
}

async function persistEnvelope(
  tx: Tx,
  envelope: CaioDeliveryEnvelope,
): Promise<void> {
  const updated = await tx.workBuddyDeliveryEnvelope.updateMany({
    where: {
      id: envelope.deliveryObjectId,
      workspaceId: envelope.workspaceId,
    },
    data: envelopeStateWriteData(envelope),
  });
  if (updated.count !== 1) {
    throw new WorkBuddyCollaborationError(
      "INTERNAL_ERROR",
      "The WorkBuddy delivery disappeared during a state transition.",
    );
  }
}

function sameTriggerBinding(
  existing: CaioDeliveryEnvelope,
  candidate: CaioDeliveryEnvelope,
): boolean {
  return sameValue(
    {
      sourceObjectKind: existing.source.objectKind,
      sourceObjectId: existing.source.objectId,
      severity: existing.severity,
      category: existing.category,
      triggerRuleRef: existing.triggerRuleRef,
      validUntil: existing.validUntil,
    },
    {
      sourceObjectKind: candidate.source.objectKind,
      sourceObjectId: candidate.source.objectId,
      severity: candidate.severity,
      category: candidate.category,
      triggerRuleRef: candidate.triggerRuleRef,
      validUntil: candidate.validUntil,
    },
  );
}

async function normalizeEnvelope(
  tx: Tx,
  row: StoredEnvelope,
  now: string,
): Promise<CaioDeliveryEnvelope> {
  const envelope = parseStoredEnvelope(row);
  const nowMs = parseInstant(now);
  let status: CaioDeliveryStatus | null = null;
  if (
    OPEN_STATUSES.includes(envelope.status) &&
    nowMs >= parseInstant(envelope.validUntil)
  ) {
    status = "expired";
  } else if (
    envelope.status === "snoozed" &&
    envelope.snoozedUntil &&
    nowMs >= parseInstant(envelope.snoozedUntil)
  ) {
    status = "pending";
  }
  if (!status) return envelope;
  const normalized = transitionCaioDeliveryEnvelope({
    envelope,
    status,
    transitionedAt: now,
  });
  await persistEnvelope(tx, normalized);
  return normalized;
}

function isSuppressed(
  envelope: CaioDeliveryEnvelope,
  suppressions: readonly CaioDeliverySuppression[],
): boolean {
  return suppressions.some((suppression) => {
    if (
      suppression.category !== envelope.category ||
      suppression.scope.kind === "workspace"
    ) {
      return suppression.category === envelope.category;
    }
    if (suppression.scope.objectKind !== envelope.source.objectKind) {
      return false;
    }
    return (
      suppression.scope.kind === "object_kind" ||
      suppression.scope.objectId === envelope.source.objectId
    );
  });
}

function deterministicRef(
  prefix: string,
  value: unknown,
): string {
  const digest = sha256(canonicalJson(value)).slice("sha256:".length);
  return `${prefix}:${digest}`;
}

async function ensureClientBinding(
  tx: Tx,
  input: {
    workspaceId: string;
    clientId: string;
    polledAt: string;
  },
): Promise<void> {
  const existing = await tx.workBuddyDeliveryClientBinding.findUnique({
    where: { workspaceId: input.workspaceId },
  });
  if (existing && existing.clientId !== input.clientId) {
    throw new WorkBuddyCollaborationError(
      "SCOPE_DENIED",
      "This reference delivery ledger supports one registered WorkBuddy client per workspace.",
    );
  }
  const at = new Date(input.polledAt);
  if (existing) {
    await tx.workBuddyDeliveryClientBinding.update({
      where: { workspaceId: input.workspaceId },
      data: { lastSeenAt: at },
    });
    return;
  }
  await tx.workBuddyDeliveryClientBinding.create({
    data: {
      workspaceId: input.workspaceId,
      clientId: input.clientId,
      registeredAt: at,
      lastSeenAt: at,
    },
  });
}

async function loadOrCreateLane(
  tx: Tx,
  input: {
    workspaceId: string;
    clientId: string;
    severity: CaioDeliverySeverity;
  },
) {
  const unique = {
    workspaceId: input.workspaceId,
    clientId: input.clientId,
    severity: input.severity,
  };
  const existing = await tx.workBuddyDeliveryLane.findUnique({
    where: { workspaceId_clientId_severity: unique },
  });
  if (existing) return existing;
  return tx.workBuddyDeliveryLane.create({ data: unique });
}

async function createClaim(
  tx: Tx,
  input: {
    envelope: CaioDeliveryEnvelope;
    clientId: string;
    claimedAt: string;
  },
): Promise<CaioDeliveryClaim> {
  const deliveryClaimId = deterministicRef("delivery-claim", {
    workspaceId: input.envelope.workspaceId,
    deliveryKey: input.envelope.deliveryKey,
    deliveryVersion: input.envelope.deliveryVersion,
    clientId: input.clientId,
  });
  const claim = Object.freeze(
    caioDeliveryClaimSchema.parse({
      schemaVersion: "helm.caio-delivery-claim/v1",
      deliveryClaimId,
      workspaceId: input.envelope.workspaceId,
      clientId: input.clientId,
      deliveryObjectId: input.envelope.deliveryObjectId,
      deliveryKey: input.envelope.deliveryKey,
      deliveryVersion: input.envelope.deliveryVersion,
      severity: input.envelope.severity,
      claimedAt: input.claimedAt,
    }),
  );
  const claimJson = canonicalJson(claim);
  await tx.workBuddyDeliveryClaim.create({
    data: {
      id: claim.deliveryClaimId,
      workspaceId: claim.workspaceId,
      clientId: claim.clientId,
      deliveryObjectId: claim.deliveryObjectId,
      deliveryKey: claim.deliveryKey,
      deliveryVersion: claim.deliveryVersion,
      severity: claim.severity,
      claimJson,
      contentHash: sha256(claimJson),
      claimedAt: new Date(claim.claimedAt),
    },
  });
  return claim;
}

async function createPresentation(
  tx: Tx,
  input: {
    claim: CaioDeliveryClaim;
    sequence: number;
    cause: "initial" | "snooze_elapsed";
    presentedAt: string;
  },
): Promise<CaioDeliveryPresentation> {
  const presentationId = deterministicRef("delivery-presentation", {
    workspaceId: input.claim.workspaceId,
    clientId: input.claim.clientId,
    severity: input.claim.severity,
    sequence: input.sequence,
  });
  const presentation = Object.freeze(
    caioDeliveryPresentationSchema.parse({
      schemaVersion: "helm.caio-delivery-presentation/v1",
      presentationId,
      deliveryClaimId: input.claim.deliveryClaimId,
      workspaceId: input.claim.workspaceId,
      clientId: input.claim.clientId,
      severity: input.claim.severity,
      sequence: input.sequence,
      cause: input.cause,
      presentedAt: input.presentedAt,
    }),
  );
  const presentationJson = canonicalJson(presentation);
  await tx.workBuddyDeliveryPresentation.create({
    data: {
      id: presentation.presentationId,
      workspaceId: presentation.workspaceId,
      deliveryClaimId: presentation.deliveryClaimId,
      clientId: presentation.clientId,
      severity: presentation.severity,
      sequence: presentation.sequence,
      cause: presentation.cause,
      presentationJson,
      contentHash: sha256(presentationJson),
      presentedAt: new Date(presentation.presentedAt),
    },
  });
  return presentation;
}

async function loadPollItems(
  tx: Tx,
  input: {
    workspaceId: string;
    clientId: string;
    severity: CaioDeliverySeverity;
    afterSequence: number;
    limit: number;
  },
) {
  const rows = await tx.workBuddyDeliveryPresentation.findMany({
    where: {
      workspaceId: input.workspaceId,
      clientId: input.clientId,
      severity: input.severity,
      sequence: { gt: input.afterSequence },
    },
    orderBy: { sequence: "asc" },
    take: input.limit,
  });
  return Promise.all(
    rows.map(async (presentationRow) => {
      const claimRow = await tx.workBuddyDeliveryClaim.findFirst({
        where: {
          id: presentationRow.deliveryClaimId,
          workspaceId: input.workspaceId,
        },
      });
      if (!claimRow) {
        throw new WorkBuddyCollaborationError(
          "INTERNAL_ERROR",
          "A WorkBuddy presentation references a missing claim.",
        );
      }
      const envelopeRow = await tx.workBuddyDeliveryEnvelope.findFirst({
        where: {
          id: claimRow.deliveryObjectId,
          workspaceId: input.workspaceId,
        },
      });
      if (!envelopeRow) {
        throw new WorkBuddyCollaborationError(
          "INTERNAL_ERROR",
          "A WorkBuddy claim references a missing envelope.",
        );
      }
      return Object.freeze({
        envelope: parseStoredEnvelope(envelopeRow),
        claim: parseStoredClaim(claimRow),
        presentation: parseStoredPresentation(presentationRow),
      });
    }),
  );
}

function transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  return runWithWriteConflictRetry(
    () => db.$transaction(work, TRANSACTION_OPTIONS),
    WRITE_RETRY_OPTIONS,
  );
}

export function createPrismaCaioDeliveryStore(): CaioDeliveryStore {
  return Object.freeze({
    async enqueue(rawEnvelope: CaioDeliveryEnvelope) {
      const envelope = caioDeliveryEnvelopeSchema.parse(rawEnvelope);
      return transaction(async (tx) => {
        await lockWorkspace(tx, envelope.workspaceId);
        const existingById =
          await tx.workBuddyDeliveryEnvelope.findFirst({
            where: {
              id: envelope.deliveryObjectId,
              workspaceId: envelope.workspaceId,
            },
          });
        if (existingById) {
          const existing = parseStoredEnvelope(existingById);
          if (!sameValue(existing, envelope)) {
            throw new WorkBuddyCollaborationError(
              "VERSION_CONFLICT",
              "The delivery object id is already bound to different content.",
            );
          }
          return Object.freeze({
            envelope: existing,
            outcome: "replayed" as const,
          });
        }

        const existingSnapshot =
          await tx.workBuddyDeliveryEnvelope.findUnique({
            where: {
              workspaceId_deliveryKey_triggerSnapshotHash: {
                workspaceId: envelope.workspaceId,
                deliveryKey: envelope.deliveryKey,
                triggerSnapshotHash: envelope.triggerSnapshotHash,
              },
            },
          });
        if (existingSnapshot) {
          const existing = parseStoredEnvelope(existingSnapshot);
          if (!sameTriggerBinding(existing, envelope)) {
            throw new WorkBuddyCollaborationError(
              "VERSION_CONFLICT",
              "The trigger snapshot is already bound to different delivery semantics.",
            );
          }
          return Object.freeze({
            envelope: existing,
            outcome: "replayed" as const,
          });
        }

        const existingVersion =
          await tx.workBuddyDeliveryEnvelope.findUnique({
            where: {
              workspaceId_deliveryKey_deliveryVersion: {
                workspaceId: envelope.workspaceId,
                deliveryKey: envelope.deliveryKey,
                deliveryVersion: envelope.deliveryVersion,
              },
            },
          });
        if (existingVersion) {
          const existing = parseStoredEnvelope(existingVersion);
          if (sameValue(existing, envelope)) {
            return Object.freeze({
              envelope: existing,
              outcome: "replayed" as const,
            });
          }
          throw new WorkBuddyCollaborationError(
            "VERSION_CONFLICT",
            "The delivery version is already bound to different content.",
          );
        }

        const priorRow =
          await tx.workBuddyDeliveryEnvelope.findFirst({
            where: {
              workspaceId: envelope.workspaceId,
              deliveryKey: envelope.deliveryKey,
            },
            orderBy: { deliveryVersion: "desc" },
          });
        if (!priorRow && envelope.deliveryVersion !== 1) {
          throw new WorkBuddyCollaborationError(
            "VERSION_CONFLICT",
            "The first delivery version must be one.",
          );
        }
        if (priorRow) {
          const prior = parseStoredEnvelope(priorRow);
          if (
            envelope.deliveryVersion !== prior.deliveryVersion + 1 ||
            envelope.source.objectKind !== prior.source.objectKind ||
            envelope.source.objectId !== prior.source.objectId ||
            envelope.source.objectVersion <= prior.source.objectVersion
          ) {
            throw new WorkBuddyCollaborationError(
              "VERSION_CONFLICT",
              "A new delivery version must advance the current canonical object version.",
            );
          }
        }
        await tx.workBuddyDeliveryEnvelope.create({
          data: {
            id: envelope.deliveryObjectId,
            workspaceId: envelope.workspaceId,
            ...envelopeWriteData(envelope),
          },
        });
        return Object.freeze({
          envelope: Object.freeze({
            ...envelope,
            source: Object.freeze({ ...envelope.source }),
            boundary: Object.freeze({ ...envelope.boundary }),
          }),
          outcome: "created" as const,
        });
      });
    },

    async poll(pollInput: {
      workspaceId: string;
      clientId: string;
      severity: CaioDeliverySeverity;
      cursor: ReturnType<typeof caioDeliveryCursorSchema.parse>;
      limit: number;
      polledAt: string;
    }): Promise<CaioDeliveryPollResult> {
      const cursor = caioDeliveryCursorSchema.parse(pollInput.cursor);
      if (
        cursor.workspaceId !== pollInput.workspaceId ||
        cursor.clientId !== pollInput.clientId
      ) {
        throw new WorkBuddyCollaborationError(
          "VERSION_CONFLICT",
          "The delivery cursor binding does not match the poll client.",
        );
      }
      return transaction(async (tx) => {
        await lockWorkspace(tx, pollInput.workspaceId);
        await ensureClientBinding(tx, pollInput);
        let lane = await loadOrCreateLane(tx, pollInput);
        const acknowledgedSequence =
          pollInput.severity === "critical"
            ? cursor.criticalSequence
            : cursor.normalSequence;
        if (acknowledgedSequence > lane.sequence) {
          throw new WorkBuddyCollaborationError(
            "REPLAY_REJECTED",
            "The delivery cursor is ahead of the server ledger.",
          );
        }

        const openRows =
          await tx.workBuddyDeliveryEnvelope.findMany({
            where: {
              workspaceId: pollInput.workspaceId,
              severity: pollInput.severity,
              status: { in: [...OPEN_STATUSES] },
            },
          });
        for (const row of openRows) {
          await normalizeEnvelope(tx, row, pollInput.polledAt);
        }

        let replayable = await loadPollItems(tx, {
          workspaceId: pollInput.workspaceId,
          clientId: pollInput.clientId,
          severity: pollInput.severity,
          afterSequence: acknowledgedSequence,
          limit: pollInput.limit,
        });
        const availableSlots = Math.max(
          0,
          pollInput.limit - replayable.length,
        );
        if (availableSlots > 0) {
          const suppressionRows =
            await tx.workBuddyDeliverySuppression.findMany({
              where: {
                workspaceId: pollInput.workspaceId,
                revokedAt: null,
                validFrom: { lte: new Date(pollInput.polledAt) },
                validUntil: { gt: new Date(pollInput.polledAt) },
              },
            });
          const suppressions = suppressionRows.map(
            parseStoredSuppression,
          );
          const candidates =
            await tx.workBuddyDeliveryEnvelope.findMany({
              where: {
                workspaceId: pollInput.workspaceId,
                severity: pollInput.severity,
                status: "pending",
              },
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            });
          let created = 0;
          for (const candidateRow of candidates) {
            if (created >= availableSlots) break;
            const envelope = parseStoredEnvelope(candidateRow);
            if (isSuppressed(envelope, suppressions)) continue;
            const uniqueClaim = {
              workspaceId: envelope.workspaceId,
              deliveryKey: envelope.deliveryKey,
              deliveryVersion: envelope.deliveryVersion,
              clientId: pollInput.clientId,
            };
            const existingClaimRow =
              await tx.workBuddyDeliveryClaim.findUnique({
                where: {
                  workspaceId_deliveryKey_deliveryVersion_clientId:
                    uniqueClaim,
                },
              });
            const claim = existingClaimRow
              ? parseStoredClaim(existingClaimRow)
              : await createClaim(tx, {
                  envelope,
                  clientId: pollInput.clientId,
                  claimedAt: pollInput.polledAt,
                });
            if (existingClaimRow) {
              const outstanding =
                await tx.workBuddyDeliveryPresentation.findFirst({
                  where: {
                    workspaceId: pollInput.workspaceId,
                    deliveryClaimId: claim.deliveryClaimId,
                    sequence: { gt: acknowledgedSequence },
                  },
                });
              if (outstanding) continue;
            }
            const nextSequence = lane.sequence + 1;
            await createPresentation(tx, {
              claim,
              sequence: nextSequence,
              cause: existingClaimRow
                ? "snooze_elapsed"
                : "initial",
              presentedAt: pollInput.polledAt,
            });
            lane = await tx.workBuddyDeliveryLane.update({
              where: { id: lane.id },
              data: { sequence: nextSequence },
            });
            const delivered = transitionCaioDeliveryEnvelope({
              envelope,
              status: "delivered",
              transitionedAt: pollInput.polledAt,
            });
            await persistEnvelope(tx, delivered);
            created += 1;
          }
          replayable = await loadPollItems(tx, {
            workspaceId: pollInput.workspaceId,
            clientId: pollInput.clientId,
            severity: pollInput.severity,
            afterSequence: acknowledgedSequence,
            limit: pollInput.limit,
          });
        }
        const returnedSequence =
          replayable.at(-1)?.presentation.sequence ??
          acknowledgedSequence;
        const nextCursor = caioDeliveryCursorSchema.parse({
          ...cursor,
          ...(pollInput.severity === "critical"
            ? { criticalSequence: returnedSequence }
            : { normalSequence: returnedSequence }),
        });
        return Object.freeze({
          schemaVersion: "helm.caio-delivery-poll/v1",
          severity: pollInput.severity,
          items: Object.freeze(replayable),
          cursor: nextCursor,
          targetPollIntervalSeconds:
            pollInput.severity === "critical" ? 60 : 1_800,
        });
      });
    },

    async get(input: {
      workspaceId: string;
      deliveryObjectId: string;
    }) {
      const row = await db.workBuddyDeliveryEnvelope.findFirst({
        where: {
          id: input.deliveryObjectId,
          workspaceId: input.workspaceId,
        },
      });
      return row ? parseStoredEnvelope(row) : null;
    },

    async listOpen(input: {
      workspaceId: string;
      severity?: CaioDeliverySeverity;
      now: string;
    }) {
      return transaction(async (tx) => {
        await lockWorkspace(tx, input.workspaceId);
        const rows = await tx.workBuddyDeliveryEnvelope.findMany({
          where: {
            workspaceId: input.workspaceId,
            ...(input.severity
              ? { severity: input.severity }
              : {}),
            status: { in: [...OPEN_STATUSES] },
          },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        });
        const result: CaioDeliveryEnvelope[] = [];
        for (const row of rows) {
          const envelope = await normalizeEnvelope(tx, row, input.now);
          if (OPEN_STATUSES.includes(envelope.status)) {
            result.push(envelope);
          }
        }
        return Object.freeze(result);
      });
    },

    async transition(input: {
      workspaceId: string;
      deliveryObjectId: string;
      clientId?: string;
      expectedStatuses: readonly CaioDeliveryStatus[];
      status: CaioDeliveryStatus;
      transitionedAt: string;
      snoozedUntil?: string;
    }) {
      return transaction(async (tx) => {
        await lockWorkspace(tx, input.workspaceId);
        const row = await tx.workBuddyDeliveryEnvelope.findFirst({
          where: {
            id: input.deliveryObjectId,
            workspaceId: input.workspaceId,
          },
        });
        if (!row) {
          throw new WorkBuddyCollaborationError(
            "INVALID_TOOL_INPUT",
            "The delivery does not exist in the requested workspace.",
          );
        }
        const envelope = parseStoredEnvelope(row);
        if (input.clientId) {
          const claim =
            await tx.workBuddyDeliveryClaim.findUnique({
              where: {
                workspaceId_deliveryKey_deliveryVersion_clientId: {
                  workspaceId: input.workspaceId,
                  deliveryKey: envelope.deliveryKey,
                  deliveryVersion: envelope.deliveryVersion,
                  clientId: input.clientId,
                },
              },
            });
          if (!claim) {
            throw new WorkBuddyCollaborationError(
              "SCOPE_DENIED",
              "The client has no delivery claim for this object.",
            );
          }
        }
        if (!input.expectedStatuses.includes(envelope.status)) {
          if (envelope.status === "withdrawn") {
            throw new WorkBuddyCollaborationError(
              "OBJECT_WITHDRAWN",
              "The delivery was withdrawn.",
            );
          }
          if (envelope.status === "expired") {
            throw new WorkBuddyCollaborationError(
              "OBJECT_EXPIRED",
              "The delivery expired.",
            );
          }
          throw new WorkBuddyCollaborationError(
            "VERSION_CONFLICT",
            "The delivery state changed before this transition.",
          );
        }
        const transitioned = transitionCaioDeliveryEnvelope({
          envelope,
          status: input.status,
          transitionedAt: input.transitionedAt,
          snoozedUntil: input.snoozedUntil,
        });
        await persistEnvelope(tx, transitioned);
        return transitioned;
      });
    },

    async registerSuppression(
      rawSuppression: CaioDeliverySuppression,
    ) {
      const suppression =
        caioDeliverySuppressionSchema.parse(rawSuppression);
      return transaction(async (tx) => {
        await lockWorkspace(tx, suppression.workspaceId);
        const existing =
          await tx.workBuddyDeliverySuppression.findFirst({
            where: {
              id: suppression.suppressionId,
              workspaceId: suppression.workspaceId,
            },
          });
        if (existing) {
          const parsed = parseStoredSuppression(existing);
          if (!sameValue(parsed, suppression)) {
            throw new WorkBuddyCollaborationError(
              "VERSION_CONFLICT",
              "The suppression id is already bound to another rule.",
            );
          }
          return parsed;
        }
        const suppressionJson = canonicalJson(suppression);
        await tx.workBuddyDeliverySuppression.create({
          data: {
            id: suppression.suppressionId,
            workspaceId: suppression.workspaceId,
            category: suppression.category,
            scopeKind: suppression.scope.kind,
            objectKind:
              suppression.scope.kind === "workspace"
                ? null
                : suppression.scope.objectKind,
            objectId:
              suppression.scope.kind === "object"
                ? suppression.scope.objectId
                : null,
            validFrom: new Date(suppression.validFrom),
            validUntil: new Date(suppression.validUntil),
            revokedAt: suppression.revokedAt
              ? new Date(suppression.revokedAt)
              : null,
            suppressionJson,
            contentHash: sha256(suppressionJson),
          },
        });
        return Object.freeze({
          ...suppression,
          scope: Object.freeze({ ...suppression.scope }),
        });
      });
    },

    async revokeSuppression(input: {
      workspaceId: string;
      suppressionId: string;
      revokedAt: string;
    }) {
      return transaction(async (tx) => {
        await lockWorkspace(tx, input.workspaceId);
        const row =
          await tx.workBuddyDeliverySuppression.findFirst({
            where: {
              id: input.suppressionId,
              workspaceId: input.workspaceId,
            },
          });
        if (!row) {
          throw new WorkBuddyCollaborationError(
            "INVALID_TOOL_INPUT",
            "The suppression rule does not exist in the workspace.",
          );
        }
        const suppression = parseStoredSuppression(row);
        if (suppression.revokedAt) return suppression;
        const revoked = caioDeliverySuppressionSchema.parse({
          ...suppression,
          revokedAt: input.revokedAt,
        });
        const suppressionJson = canonicalJson(revoked);
        await tx.workBuddyDeliverySuppression.update({
          where: { id: row.id },
          data: {
            revokedAt: new Date(input.revokedAt),
            suppressionJson,
            contentHash: sha256(suppressionJson),
          },
        });
        return Object.freeze({
          ...revoked,
          scope: Object.freeze({ ...revoked.scope }),
        });
      });
    },
  });
}
