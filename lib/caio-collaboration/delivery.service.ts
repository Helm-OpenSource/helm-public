import {
  caioDeliveryCursorSchema,
  caioDeliveryEnvelopeSchema,
  caioDeliverySuppressionSchema,
  createCaioDeliveryEnvelope,
  transitionCaioDeliveryEnvelope,
  type CaioCanonicalObjectRef,
  type CaioDeliveryClaim,
  type CaioDeliveryCursor,
  type CaioDeliveryEnvelope,
  type CaioDeliveryPresentation,
  type CaioDeliverySeverity,
  type CaioDeliveryStatus,
  type CaioDeliverySuppression,
} from "./delivery-contracts";
import {
  WorkBuddyCollaborationError,
} from "./contracts";

export type CaioDeliveryEnqueueInput = Readonly<{
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
}>;

export type CaioDeliveryEnqueueResult = Readonly<{
  envelope: CaioDeliveryEnvelope;
  outcome: "created" | "replayed";
}>;

export type CaioDeliveryPollItem = Readonly<{
  envelope: CaioDeliveryEnvelope;
  claim: CaioDeliveryClaim;
  presentation: CaioDeliveryPresentation;
}>;

export type CaioDeliveryPollResult = Readonly<{
  schemaVersion: "helm.caio-delivery-poll/v1";
  severity: CaioDeliverySeverity;
  items: readonly CaioDeliveryPollItem[];
  cursor: CaioDeliveryCursor;
  targetPollIntervalSeconds: 60 | 1_800;
}>;

export type CaioDeliveryPromptProjection = Readonly<{
  schemaVersion: string;
  available: boolean;
  localViewRequired: boolean;
  [key: string]: unknown;
}>;

export interface CaioDeliveryStore {
  enqueue(
    envelope: CaioDeliveryEnvelope,
  ): Promise<CaioDeliveryEnqueueResult>;
  poll(input: {
    workspaceId: string;
    clientId: string;
    severity: CaioDeliverySeverity;
    cursor: CaioDeliveryCursor;
    limit: number;
    polledAt: string;
  }): Promise<CaioDeliveryPollResult>;
  get(input: {
    workspaceId: string;
    deliveryObjectId: string;
  }): Promise<CaioDeliveryEnvelope | null>;
  listOpen(input: {
    workspaceId: string;
    severity?: CaioDeliverySeverity;
    now: string;
  }): Promise<readonly CaioDeliveryEnvelope[]>;
  transition(input: {
    workspaceId: string;
    deliveryObjectId: string;
    clientId?: string;
    expectedStatuses: readonly CaioDeliveryStatus[];
    status: CaioDeliveryStatus;
    transitionedAt: string;
    snoozedUntil?: string;
  }): Promise<CaioDeliveryEnvelope>;
  registerSuppression(
    suppression: CaioDeliverySuppression,
  ): Promise<CaioDeliverySuppression>;
  revokeSuppression(input: {
    workspaceId: string;
    suppressionId: string;
    revokedAt: string;
  }): Promise<CaioDeliverySuppression>;
}

export interface InMemoryCaioDeliveryStore extends CaioDeliveryStore {
  countClaims(): Promise<number>;
}

export type CaioDeliveryProjectionResolver = (
  envelope: CaioDeliveryEnvelope,
) => Promise<CaioDeliveryPromptProjection>;

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

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
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

function freezeSuppression(
  suppression: CaioDeliverySuppression,
): CaioDeliverySuppression {
  return Object.freeze({
    ...suppression,
    scope: Object.freeze({ ...suppression.scope }),
  });
}

function key(...parts: readonly string[]): string {
  return parts.join("\u0000");
}

function assertWorkspaceBinding(input: {
  expected: string;
  actual: string;
}): void {
  if (input.expected !== input.actual) {
    throw new WorkBuddyCollaborationError(
      "VERSION_CONFLICT",
      "The delivery does not belong to the requested workspace.",
    );
  }
}

function defaultProjectionResolver(
  envelope: CaioDeliveryEnvelope,
): Promise<CaioDeliveryPromptProjection> {
  return Promise.resolve(
    Object.freeze({
      schemaVersion: "helm.workbuddy-prompt-projection/v1",
      source: envelope.source,
      available: false,
      reason: "LOCAL_VIEW_REQUIRED",
      localViewRequired: true,
      boundary: Object.freeze({
        authorityEffect: "none",
        sourcePayloadCopied: false,
      }),
    }),
  );
}

export function createCaioDeliveryService(input: {
  store: CaioDeliveryStore;
  resolve?: CaioDeliveryProjectionResolver;
  now?: () => string;
}) {
  const now = input.now ?? (() => new Date().toISOString());
  const resolve = input.resolve ?? defaultProjectionResolver;

  return Object.freeze({
    async enqueue(
      delivery: CaioDeliveryEnqueueInput,
    ): Promise<CaioDeliveryEnqueueResult> {
      return input.store.enqueue(
        createCaioDeliveryEnvelope({
          ...delivery,
          now: now(),
        }),
      );
    },

    async poll(pollInput: {
      workspaceId: string;
      clientId: string;
      severity: CaioDeliverySeverity;
      cursor: CaioDeliveryCursor;
      limit: number;
    }): Promise<CaioDeliveryPollResult> {
      const cursor = caioDeliveryCursorSchema.parse(pollInput.cursor);
      assertWorkspaceBinding({
        expected: pollInput.workspaceId,
        actual: cursor.workspaceId,
      });
      if (cursor.clientId !== pollInput.clientId) {
        throw new WorkBuddyCollaborationError(
          "VERSION_CONFLICT",
          "The delivery cursor client binding does not match.",
        );
      }
      if (
        !Number.isInteger(pollInput.limit) ||
        pollInput.limit < 1 ||
        pollInput.limit > 100
      ) {
        throw new WorkBuddyCollaborationError(
          "INVALID_TOOL_INPUT",
          "Delivery poll limit must be between 1 and 100.",
        );
      }
      return input.store.poll({
        ...pollInput,
        cursor,
        polledAt: now(),
      });
    },

    async listPending(listInput: {
      workspaceId: string;
      severity?: CaioDeliverySeverity;
    }): Promise<readonly CaioDeliveryEnvelope[]> {
      return input.store.listOpen({
        ...listInput,
        now: now(),
      });
    },

    async getPrompt(getInput: {
      workspaceId: string;
      deliveryObjectId: string;
    }): Promise<
      Readonly<{
        envelope: CaioDeliveryEnvelope;
        projection: CaioDeliveryPromptProjection;
      }>
    > {
      const envelope = await input.store.get(getInput);
      if (!envelope) {
        throw new WorkBuddyCollaborationError(
          "INVALID_TOOL_INPUT",
          "The delivery does not exist in the requested workspace.",
        );
      }
      assertWorkspaceBinding({
        expected: getInput.workspaceId,
        actual: envelope.workspaceId,
      });
      if (envelope.status === "withdrawn") {
        throw new WorkBuddyCollaborationError(
          "OBJECT_WITHDRAWN",
          "The delivery was withdrawn before projection.",
        );
      }
      if (
        envelope.status === "expired" ||
        parseInstant(now()) >= parseInstant(envelope.validUntil)
      ) {
        throw new WorkBuddyCollaborationError(
          "OBJECT_EXPIRED",
          "The delivery expired before projection.",
        );
      }
      return Object.freeze({
        envelope,
        projection: await resolve(envelope),
      });
    },

    async markOpened(openInput: {
      workspaceId: string;
      clientId: string;
      deliveryObjectId: string;
    }): Promise<CaioDeliveryEnvelope> {
      return input.store.transition({
        ...openInput,
        expectedStatuses: ["delivered", "opened"],
        status: "opened",
        transitionedAt: now(),
      });
    },

    async snooze(snoozeInput: {
      workspaceId: string;
      clientId: string;
      deliveryObjectId: string;
      snoozedUntil: string;
    }): Promise<CaioDeliveryEnvelope> {
      return input.store.transition({
        ...snoozeInput,
        expectedStatuses: ["delivered", "opened", "snoozed"],
        status: "snoozed",
        transitionedAt: now(),
      });
    },

    async markAnswered(answerInput: {
      workspaceId: string;
      clientId: string;
      deliveryObjectId: string;
    }): Promise<CaioDeliveryEnvelope> {
      return input.store.transition({
        ...answerInput,
        expectedStatuses: ["opened", "answered"],
        status: "answered",
        transitionedAt: now(),
      });
    },

    async decline(declineInput: {
      workspaceId: string;
      clientId: string;
      deliveryObjectId: string;
    }): Promise<CaioDeliveryEnvelope> {
      return input.store.transition({
        ...declineInput,
        expectedStatuses: ["delivered", "opened", "declined"],
        status: "declined",
        transitionedAt: now(),
      });
    },

    async withdraw(withdrawInput: {
      workspaceId: string;
      deliveryObjectId: string;
    }): Promise<CaioDeliveryEnvelope> {
      return input.store.transition({
        ...withdrawInput,
        expectedStatuses: [
          "pending",
          "delivered",
          "opened",
          "snoozed",
          "withdrawn",
        ],
        status: "withdrawn",
        transitionedAt: now(),
      });
    },

    async registerSuppression(suppressionInput: {
      suppressionId: string;
      workspaceId: string;
      category: string;
      scope:
        | Readonly<{ kind: "workspace" }>
        | Readonly<{
            kind: "object_kind";
            objectKind: CaioCanonicalObjectRef["objectKind"];
          }>
        | Readonly<{
            kind: "object";
            objectKind: CaioCanonicalObjectRef["objectKind"];
            objectId: string;
          }>;
      validFrom: string;
      validUntil: string;
    }): Promise<CaioDeliverySuppression> {
      if (
        parseInstant(suppressionInput.validUntil) <=
        parseInstant(suppressionInput.validFrom)
      ) {
        throw new WorkBuddyCollaborationError(
          "INVALID_TOOL_INPUT",
          "Suppression validity must have a positive duration.",
        );
      }
      return input.store.registerSuppression(
        caioDeliverySuppressionSchema.parse({
          schemaVersion: "helm.caio-delivery-suppression/v1",
          ...suppressionInput,
          revokedAt: null,
        }),
      );
    },

    async revokeSuppression(revokeInput: {
      workspaceId: string;
      suppressionId: string;
    }): Promise<CaioDeliverySuppression> {
      return input.store.revokeSuppression({
        ...revokeInput,
        revokedAt: now(),
      });
    },
  });
}

type StoredClaim = Readonly<{
  claim: CaioDeliveryClaim;
  envelopeKey: string;
}>;

type StoredPresentation = Readonly<{
  presentation: CaioDeliveryPresentation;
  envelopeKey: string;
}>;

export function createInMemoryCaioDeliveryStore(): InMemoryCaioDeliveryStore {
  const envelopes = new Map<string, CaioDeliveryEnvelope>();
  const envelopeByVersion = new Map<string, string>();
  const envelopeBySnapshot = new Map<string, string>();
  const claims = new Map<string, StoredClaim>();
  const presentations: StoredPresentation[] = [];
  const laneSequences = new Map<string, number>();
  const activeClientByWorkspace = new Map<string, string>();
  const suppressions = new Map<string, CaioDeliverySuppression>();
  let claimCounter = 0;

  function envelopeIdKey(
    workspaceId: string,
    deliveryObjectId: string,
  ): string {
    return key(workspaceId, deliveryObjectId);
  }

  function versionKey(envelope: CaioDeliveryEnvelope): string {
    return key(
      envelope.workspaceId,
      envelope.deliveryKey,
      String(envelope.deliveryVersion),
    );
  }

  function snapshotKey(envelope: CaioDeliveryEnvelope): string {
    return key(
      envelope.workspaceId,
      envelope.deliveryKey,
      envelope.triggerSnapshotHash,
    );
  }

  function claimKey(input: {
    envelope: CaioDeliveryEnvelope;
    clientId: string;
  }): string {
    return key(
      input.envelope.workspaceId,
      input.envelope.deliveryKey,
      String(input.envelope.deliveryVersion),
      input.clientId,
    );
  }

  function laneKey(input: {
    workspaceId: string;
    clientId: string;
    severity: CaioDeliverySeverity;
  }): string {
    return key(input.workspaceId, input.clientId, input.severity);
  }

  function activeSuppression(
    envelope: CaioDeliveryEnvelope,
    now: string,
  ): boolean {
    const nowMs = parseInstant(now);
    for (const suppression of suppressions.values()) {
      if (
        suppression.workspaceId !== envelope.workspaceId ||
        suppression.category !== envelope.category ||
        suppression.revokedAt !== null ||
        parseInstant(suppression.validFrom) > nowMs ||
        parseInstant(suppression.validUntil) <= nowMs
      ) {
        continue;
      }
      if (suppression.scope.kind === "workspace") return true;
      if (
        suppression.scope.objectKind !== envelope.source.objectKind
      ) {
        continue;
      }
      if (suppression.scope.kind === "object_kind") return true;
      if (suppression.scope.objectId === envelope.source.objectId) {
        return true;
      }
    }
    return false;
  }

  function replaceEnvelope(envelope: CaioDeliveryEnvelope): void {
    const idKey = envelopeIdKey(
      envelope.workspaceId,
      envelope.deliveryObjectId,
    );
    envelopes.set(idKey, envelope);
  }

  function getClaimForClient(input: {
    envelope: CaioDeliveryEnvelope;
    clientId: string;
  }): StoredClaim | undefined {
    return claims.get(claimKey(input));
  }

  function normalizeEnvelope(
    envelope: CaioDeliveryEnvelope,
    now: string,
  ): CaioDeliveryEnvelope {
    const nowMs = parseInstant(now);
    if (
      !["answered", "declined", "withdrawn", "expired"].includes(
        envelope.status,
      ) &&
      nowMs >= parseInstant(envelope.validUntil)
    ) {
      const expired = transitionCaioDeliveryEnvelope({
        envelope,
        status: "expired",
        transitionedAt: now,
      });
      replaceEnvelope(expired);
      return expired;
    }
    if (
      envelope.status === "snoozed" &&
      envelope.snoozedUntil &&
      nowMs >= parseInstant(envelope.snoozedUntil)
    ) {
      const pending = transitionCaioDeliveryEnvelope({
        envelope,
        status: "pending",
        transitionedAt: now,
      });
      replaceEnvelope(pending);
      return pending;
    }
    return envelope;
  }

  async function get(input: {
    workspaceId: string;
    deliveryObjectId: string;
  }): Promise<CaioDeliveryEnvelope | null> {
    return (
      envelopes.get(
        envelopeIdKey(input.workspaceId, input.deliveryObjectId),
      ) ?? null
    );
  }

  return Object.freeze({
    async enqueue(
      rawEnvelope: CaioDeliveryEnvelope,
    ): Promise<CaioDeliveryEnqueueResult> {
      const envelope = caioDeliveryEnvelopeSchema.parse(rawEnvelope);
      const idKey = envelopeIdKey(
        envelope.workspaceId,
        envelope.deliveryObjectId,
      );
      const existingById = envelopes.get(idKey);
      if (existingById) {
        if (!sameValue(existingById, envelope)) {
          throw new WorkBuddyCollaborationError(
            "VERSION_CONFLICT",
            "The delivery object id is already bound to different content.",
          );
        }
        return Object.freeze({
          envelope: existingById,
          outcome: "replayed",
        });
      }

      const existingSnapshotKey = envelopeBySnapshot.get(
        snapshotKey(envelope),
      );
      if (existingSnapshotKey) {
        const existing = envelopes.get(existingSnapshotKey);
        if (!existing) {
          throw new WorkBuddyCollaborationError(
            "INTERNAL_ERROR",
            "Delivery snapshot index is inconsistent.",
          );
        }
        if (!sameTriggerBinding(existing, envelope)) {
          throw new WorkBuddyCollaborationError(
            "VERSION_CONFLICT",
            "The trigger snapshot is already bound to different delivery semantics.",
          );
        }
        return Object.freeze({
          envelope: existing,
          outcome: "replayed",
        });
      }

      const existingVersionKey = envelopeByVersion.get(
        versionKey(envelope),
      );
      if (existingVersionKey) {
        const existing = envelopes.get(existingVersionKey);
        if (existing && sameValue(existing, envelope)) {
          return Object.freeze({
            envelope: existing,
            outcome: "replayed",
          });
        }
        throw new WorkBuddyCollaborationError(
          "VERSION_CONFLICT",
          "The delivery version is already bound to different content.",
        );
      }

      const prior = [...envelopes.values()]
        .filter(
          (candidate) =>
            candidate.workspaceId === envelope.workspaceId &&
            candidate.deliveryKey === envelope.deliveryKey,
        )
        .sort((left, right) => right.deliveryVersion - left.deliveryVersion)[0];
      if (!prior && envelope.deliveryVersion !== 1) {
        throw new WorkBuddyCollaborationError(
          "VERSION_CONFLICT",
          "The first delivery version must be one.",
        );
      }
      if (prior) {
        if (envelope.deliveryVersion !== prior.deliveryVersion + 1) {
          throw new WorkBuddyCollaborationError(
            "VERSION_CONFLICT",
            "A delivery version must follow the current version.",
          );
        }
        if (
          envelope.source.objectKind !== prior.source.objectKind ||
          envelope.source.objectId !== prior.source.objectId ||
          envelope.source.objectVersion <= prior.source.objectVersion
        ) {
          throw new WorkBuddyCollaborationError(
            "VERSION_CONFLICT",
            "A new delivery version must advance the same canonical object.",
          );
        }
      }

      envelopes.set(idKey, envelope);
      envelopeByVersion.set(versionKey(envelope), idKey);
      envelopeBySnapshot.set(snapshotKey(envelope), idKey);
      return Object.freeze({
        envelope,
        outcome: "created",
      });
    },

    async poll(pollInput: {
      workspaceId: string;
      clientId: string;
      severity: CaioDeliverySeverity;
      cursor: CaioDeliveryCursor;
      limit: number;
      polledAt: string;
    }): Promise<CaioDeliveryPollResult> {
      const cursor = caioDeliveryCursorSchema.parse(pollInput.cursor);
      assertWorkspaceBinding({
        expected: pollInput.workspaceId,
        actual: cursor.workspaceId,
      });
      if (cursor.clientId !== pollInput.clientId) {
        throw new WorkBuddyCollaborationError(
          "VERSION_CONFLICT",
          "The delivery cursor client binding does not match.",
        );
      }
      const currentLaneKey = laneKey(pollInput);
      const currentSequence = laneSequences.get(currentLaneKey) ?? 0;
      const acknowledgedSequence =
        pollInput.severity === "critical"
          ? cursor.criticalSequence
          : cursor.normalSequence;
      if (acknowledgedSequence > currentSequence) {
        throw new WorkBuddyCollaborationError(
          "REPLAY_REJECTED",
          "The delivery cursor is ahead of the server ledger.",
        );
      }
      const activeClient = activeClientByWorkspace.get(
        pollInput.workspaceId,
      );
      if (activeClient && activeClient !== pollInput.clientId) {
        throw new WorkBuddyCollaborationError(
          "SCOPE_DENIED",
          "This reference delivery ledger supports one registered WorkBuddy client per workspace.",
        );
      }
      activeClientByWorkspace.set(
        pollInput.workspaceId,
        pollInput.clientId,
      );

      for (const [envelopeKey, stored] of envelopes) {
        if (
          stored.workspaceId === pollInput.workspaceId &&
          stored.severity === pollInput.severity
        ) {
          envelopes.set(
            envelopeKey,
            normalizeEnvelope(stored, pollInput.polledAt),
          );
        }
      }

      let replayable = presentations
        .filter(
          (stored) =>
            stored.presentation.workspaceId === pollInput.workspaceId &&
            stored.presentation.clientId === pollInput.clientId &&
            stored.presentation.severity === pollInput.severity &&
            stored.presentation.sequence > acknowledgedSequence,
        )
        .sort(
          (left, right) =>
            left.presentation.sequence - right.presentation.sequence,
        );

      const availableSlots = Math.max(
        0,
        pollInput.limit - replayable.length,
      );
      if (availableSlots > 0) {
        const candidates = [...envelopes.entries()]
          .filter(([, envelope]) => {
            if (
              envelope.workspaceId !== pollInput.workspaceId ||
              envelope.severity !== pollInput.severity ||
              envelope.status !== "pending"
            ) {
              return false;
            }
            const existingClaim = getClaimForClient({
              envelope,
              clientId: pollInput.clientId,
            });
            const alreadyPresented =
              existingClaim &&
              presentations.some(
                (stored) =>
                  stored.presentation.deliveryClaimId ===
                    existingClaim.claim.deliveryClaimId &&
                  stored.presentation.sequence > acknowledgedSequence,
              );
            return (
              !alreadyPresented &&
              !activeSuppression(envelope, pollInput.polledAt)
            );
          })
          .sort(([, left], [, right]) => {
            const createdOrder =
              parseInstant(left.createdAt) - parseInstant(right.createdAt);
            return createdOrder !== 0
              ? createdOrder
              : left.deliveryObjectId.localeCompare(
                  right.deliveryObjectId,
                );
          })
          .slice(0, availableSlots);

        for (const [candidateKey, candidate] of candidates) {
          const existingClaim = getClaimForClient({
            envelope: candidate,
            clientId: pollInput.clientId,
          });
          let storedClaim = existingClaim;
          if (!storedClaim) {
            claimCounter += 1;
            const claim: CaioDeliveryClaim = Object.freeze({
              schemaVersion: "helm.caio-delivery-claim/v1",
              deliveryClaimId: `delivery-claim:${claimCounter}`,
              workspaceId: candidate.workspaceId,
              clientId: pollInput.clientId,
              deliveryObjectId: candidate.deliveryObjectId,
              deliveryKey: candidate.deliveryKey,
              deliveryVersion: candidate.deliveryVersion,
              severity: candidate.severity,
              claimedAt: pollInput.polledAt,
            });
            storedClaim = Object.freeze({
              claim,
              envelopeKey: candidateKey,
            });
            claims.set(
              claimKey({
                envelope: candidate,
                clientId: pollInput.clientId,
              }),
              storedClaim,
            );
          }

          const nextSequence =
            (laneSequences.get(currentLaneKey) ?? 0) + 1;
          laneSequences.set(currentLaneKey, nextSequence);
          const presentation: CaioDeliveryPresentation = Object.freeze({
            schemaVersion: "helm.caio-delivery-presentation/v1",
            presentationId: `delivery-presentation:${storedClaim.claim.deliveryClaimId}:${nextSequence}`,
            deliveryClaimId: storedClaim.claim.deliveryClaimId,
            workspaceId: candidate.workspaceId,
            clientId: pollInput.clientId,
            severity: candidate.severity,
            sequence: nextSequence,
            cause: existingClaim ? "snooze_elapsed" : "initial",
            presentedAt: pollInput.polledAt,
          });
          presentations.push(
            Object.freeze({
              presentation,
              envelopeKey: candidateKey,
            }),
          );
          envelopes.set(
            candidateKey,
            transitionCaioDeliveryEnvelope({
              envelope: candidate,
              status: "delivered",
              transitionedAt: pollInput.polledAt,
            }),
          );
        }

        replayable = presentations
          .filter(
            (stored) =>
              stored.presentation.workspaceId ===
                pollInput.workspaceId &&
              stored.presentation.clientId === pollInput.clientId &&
              stored.presentation.severity === pollInput.severity &&
              stored.presentation.sequence > acknowledgedSequence,
          )
          .sort(
            (left, right) =>
              left.presentation.sequence -
              right.presentation.sequence,
          )
          .slice(0, pollInput.limit);
      } else {
        replayable = replayable.slice(0, pollInput.limit);
      }

      const items = replayable.map((stored) => {
        const envelope = envelopes.get(stored.envelopeKey);
        const storedClaim = [...claims.values()].find(
          (candidate) =>
            candidate.claim.deliveryClaimId ===
            stored.presentation.deliveryClaimId,
        );
        if (!envelope || !storedClaim) {
          throw new WorkBuddyCollaborationError(
            "INTERNAL_ERROR",
            "The delivery ledger references a missing object.",
          );
        }
        return Object.freeze({
          envelope,
          claim: storedClaim.claim,
          presentation: stored.presentation,
        });
      });
      const returnedSequence =
        items.at(-1)?.presentation.sequence ?? acknowledgedSequence;
      const nextCursor = Object.freeze({
        ...cursor,
        ...(pollInput.severity === "critical"
          ? { criticalSequence: returnedSequence }
          : { normalSequence: returnedSequence }),
      });

      return Object.freeze({
        schemaVersion: "helm.caio-delivery-poll/v1",
        severity: pollInput.severity,
        items: Object.freeze(items),
        cursor: caioDeliveryCursorSchema.parse(nextCursor),
        targetPollIntervalSeconds:
          pollInput.severity === "critical" ? 60 : 1_800,
      });
    },

    get,

    async listOpen(listInput: {
      workspaceId: string;
      severity?: CaioDeliverySeverity;
      now: string;
    }) {
      const openStatuses = new Set<CaioDeliveryStatus>([
        "pending",
        "delivered",
        "opened",
        "snoozed",
      ]);
      const result: CaioDeliveryEnvelope[] = [];
      for (const [envelopeKey, stored] of envelopes) {
        const envelope = normalizeEnvelope(stored, listInput.now);
        envelopes.set(envelopeKey, envelope);
        if (
          envelope.workspaceId === listInput.workspaceId &&
          (!listInput.severity ||
            envelope.severity === listInput.severity) &&
          openStatuses.has(envelope.status)
        ) {
          result.push(envelope);
        }
      }
      return Object.freeze(
        result.sort(
          (left, right) =>
            parseInstant(left.createdAt) - parseInstant(right.createdAt),
        ),
      );
    },

    async transition(transitionInput: {
      workspaceId: string;
      deliveryObjectId: string;
      clientId?: string;
      expectedStatuses: readonly CaioDeliveryStatus[];
      status: CaioDeliveryStatus;
      transitionedAt: string;
      snoozedUntil?: string;
    }) {
      const idKey = envelopeIdKey(
        transitionInput.workspaceId,
        transitionInput.deliveryObjectId,
      );
      const envelope = envelopes.get(idKey);
      if (!envelope) {
        throw new WorkBuddyCollaborationError(
          "INVALID_TOOL_INPUT",
          "The delivery does not exist in the requested workspace.",
        );
      }
      if (
        transitionInput.clientId &&
        !getClaimForClient({
          envelope,
          clientId: transitionInput.clientId,
        })
      ) {
        throw new WorkBuddyCollaborationError(
          "SCOPE_DENIED",
          "The client has no delivery claim for this object.",
        );
      }
      if (!transitionInput.expectedStatuses.includes(envelope.status)) {
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
        status: transitionInput.status,
        transitionedAt: transitionInput.transitionedAt,
        snoozedUntil: transitionInput.snoozedUntil,
      });
      envelopes.set(idKey, transitioned);
      return transitioned;
    },

    async registerSuppression(
      rawSuppression: CaioDeliverySuppression,
    ) {
      const suppression = freezeSuppression(
        caioDeliverySuppressionSchema.parse(rawSuppression),
      );
      const suppressionKey = key(
        suppression.workspaceId,
        suppression.suppressionId,
      );
      const existing = suppressions.get(suppressionKey);
      if (existing) {
        if (!sameValue(existing, suppression)) {
          throw new WorkBuddyCollaborationError(
            "VERSION_CONFLICT",
            "The suppression id is already bound to another rule.",
          );
        }
        return existing;
      }
      suppressions.set(suppressionKey, suppression);
      return suppression;
    },

    async revokeSuppression(revokeInput: {
      workspaceId: string;
      suppressionId: string;
      revokedAt: string;
    }) {
      const suppressionKey = key(
        revokeInput.workspaceId,
        revokeInput.suppressionId,
      );
      const suppression = suppressions.get(suppressionKey);
      if (!suppression) {
        throw new WorkBuddyCollaborationError(
          "INVALID_TOOL_INPUT",
          "The suppression rule does not exist in the workspace.",
        );
      }
      if (suppression.revokedAt) return suppression;
      const revoked = Object.freeze({
        ...suppression,
        revokedAt: revokeInput.revokedAt,
      });
      const parsed = freezeSuppression(
        caioDeliverySuppressionSchema.parse(revoked),
      );
      suppressions.set(suppressionKey, parsed);
      return parsed;
    },

    async countClaims() {
      return claims.size;
    },
  });
}
