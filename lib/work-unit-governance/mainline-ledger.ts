import { z } from "zod";

import {
  computeWorkUnitSnapshotHash,
  helmWorkUnitSchema,
  validateWorkUnitWithinPublicCore,
  workUnitActorSchema,
  workUnitReceiptSchema,
  type HelmWorkUnit,
  type WorkUnitActor,
  type WorkUnitViolation,
} from "./contracts";

export const privateMainlineLedgerEventTypeSchema = z.enum([
  "mainline_recorded",
  "mainline_superseded",
  "activation_requested",
  "activation_authorized",
  "review_finding_asset_recorded",
  "owner_waiver_recorded",
  "repair_candidate_recorded",
]);
export type PrivateMainlineLedgerEventType = z.infer<
  typeof privateMainlineLedgerEventTypeSchema
>;

export const executableGovernanceAssetKindSchema = z.enum([
  "check",
  "template",
  "counterexample_fixture",
  "eval_case",
  "owner_rule",
  "sop_update",
]);
export type ExecutableGovernanceAssetKind = z.infer<
  typeof executableGovernanceAssetKindSchema
>;

const reviewFindingBaseSchema = z
  .object({
    findingId: z.string().min(1),
    summary: z.string().min(1),
    recordedBy: workUnitActorSchema,
    recordedAt: z.string().min(1),
  })
  .strict();

export const reviewFindingDispositionSchema = z.discriminatedUnion("disposition", [
  reviewFindingBaseSchema
    .extend({
      disposition: z.literal("asset_recorded"),
      assetKind: executableGovernanceAssetKindSchema,
      assetRef: z.string().min(1),
    })
    .strict(),
  reviewFindingBaseSchema
    .extend({
      disposition: z.literal("owner_waived"),
      waiverReason: z.string().min(1),
      expiresAt: z.string().min(1).optional(),
    })
    .strict(),
]);
export type ReviewFindingDisposition = z.infer<typeof reviewFindingDispositionSchema>;

export const privateMainlineLedgerEventSchema = z
  .object({
    schemaVersion: z.literal("helm.private-mainline-ledger-event.v1"),
    ledgerRef: z.string().min(1),
    eventId: z.string().min(1),
    workUnitId: z.string().min(1),
    eventType: privateMainlineLedgerEventTypeSchema,
    actor: workUnitActorSchema,
    at: z.string().min(1),
    snapshotHash: z.string().min(1),
    conflictKeys: z.array(z.string().min(1)).min(1),
    baselineEventIds: z.array(z.string().min(1)).default([]),
    supersedesEventIds: z.array(z.string().min(1)).default([]),
    auditRefs: z.array(z.string().min(1)).default([]),
    receipt: workUnitReceiptSchema.optional(),
    findingDisposition: reviewFindingDispositionSchema.optional(),
    publicCoreCarriesRealInstance: z.literal(false),
    createsExternalEffect: z.literal(false),
  })
  .strict();
export type PrivateMainlineLedgerEvent = z.infer<typeof privateMainlineLedgerEventSchema>;

export const privateMainlineLedgerEffectiveEntrySchema = z
  .object({
    conflictKey: z.string().min(1),
    eventId: z.string().min(1),
  })
  .strict();
export type PrivateMainlineLedgerEffectiveEntry = z.infer<
  typeof privateMainlineLedgerEffectiveEntrySchema
>;

export const privateMainlineLedgerSchema = z
  .object({
    schemaVersion: z.literal("helm.private-mainline-ledger.v1"),
    ledgerRef: z.string().min(1),
    events: z.array(privateMainlineLedgerEventSchema).default([]),
    effectiveByConflictKey: z.array(privateMainlineLedgerEffectiveEntrySchema).default([]),
    publicCoreCarriesRealInstance: z.literal(false),
  })
  .strict();
export type PrivateMainlineLedger = z.input<typeof privateMainlineLedgerSchema>;
export type PrivateMainlineLedgerSnapshot = z.output<typeof privateMainlineLedgerSchema>;

export type PrivateMainlineLedgerAppendPlan =
  | {
      readonly ok: true;
      readonly event: PrivateMainlineLedgerEvent;
      readonly nextLedger: PrivateMainlineLedgerSnapshot;
      readonly publicCorePersists: false;
      readonly publicCoreWritesPrivateMainline: false;
      readonly createsExternalEffect: false;
      readonly auditNote: string;
    }
  | {
      readonly ok: false;
      readonly violations: readonly WorkUnitViolation[];
      readonly publicCorePersists: false;
      readonly publicCoreWritesPrivateMainline: false;
      readonly createsExternalEffect: false;
    };

export type PrivateMainlineLedgerReadout = {
  readonly ledgerRef: string;
  readonly eventCount: number;
  readonly effectiveConflictKeyCount: number;
  readonly latestEventId: string | null;
  readonly publicCoreCarriesRealInstance: false;
  readonly userVisible: {
    readonly title: {
      readonly zh: string;
      readonly en: string;
    };
    readonly summary: {
      readonly zh: string;
      readonly en: string;
    };
    readonly boundary: {
      readonly zh: string;
      readonly en: string;
    };
  };
};

const HUMAN_OWNER_ACTOR_TYPES: ReadonlySet<WorkUnitActor["actorType"]> = new Set([
  "human_owner",
  "authorized_human_proxy",
]);

function isHumanOwnerActor(actor: WorkUnitActor | undefined): boolean {
  return Boolean(actor && HUMAN_OWNER_ACTOR_TYPES.has(actor.actorType));
}

function schemaViolations(prefix: string, error: z.ZodError): WorkUnitViolation[] {
  return error.issues.map((issue) => ({
    rule: `${prefix}-schema`,
    detail: `${issue.path.join(".") || "<root>"}: ${issue.message}`,
  }));
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  return sortedUnique(a).join("\0") === sortedUnique(b).join("\0");
}

function normalizeLedger(input: PrivateMainlineLedger): PrivateMainlineLedgerSnapshot {
  const ledger = privateMainlineLedgerSchema.parse(input);
  return {
    ...ledger,
    effectiveByConflictKey: buildEffectiveView(ledger.events),
  };
}

function buildEffectiveView(
  events: readonly PrivateMainlineLedgerEvent[],
): PrivateMainlineLedgerEffectiveEntry[] {
  const effective = new Map<string, string>();

  for (const event of events) {
    if (event.eventType !== "mainline_recorded" && event.eventType !== "activation_authorized") {
      continue;
    }
    for (const conflictKey of event.conflictKeys) {
      effective.set(conflictKey, event.eventId);
    }
  }

  return [...effective.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([conflictKey, eventId]) => ({ conflictKey, eventId }));
}

function activeEventIdsForConflictKeys(
  ledger: PrivateMainlineLedgerSnapshot,
  conflictKeys: readonly string[],
): string[] {
  const activeByKey = new Map(
    ledger.effectiveByConflictKey.map((entry) => [entry.conflictKey, entry.eventId]),
  );
  return sortedUnique(
    conflictKeys.flatMap((conflictKey) => {
      const activeEventId = activeByKey.get(conflictKey);
      return activeEventId ? [activeEventId] : [];
    }),
  );
}

export function validateReviewFindingDisposition(input: unknown): WorkUnitViolation[] {
  const parsed = reviewFindingDispositionSchema.safeParse(input);
  if (!parsed.success) {
    return schemaViolations("finding-disposition", parsed.error);
  }

  if (
    parsed.data.disposition === "owner_waived" &&
    !isHumanOwnerActor(parsed.data.recordedBy)
  ) {
    return [
      {
        rule: "finding-waiver-needs-human-owner",
        detail: parsed.data.findingId,
      },
    ];
  }

  return [];
}

function blockedPlan(violations: readonly WorkUnitViolation[]): PrivateMainlineLedgerAppendPlan {
  return {
    ok: false,
    violations,
    publicCorePersists: false,
    publicCoreWritesPrivateMainline: false,
    createsExternalEffect: false,
  };
}

function validateMainlineRecordEvent(input: {
  readonly ledger: PrivateMainlineLedgerSnapshot;
  readonly workUnit: HelmWorkUnit;
  readonly event: PrivateMainlineLedgerEvent;
  readonly snapshotHash: string;
}): WorkUnitViolation[] {
  const violations: WorkUnitViolation[] = [];

  if (!isHumanOwnerActor(input.event.actor)) {
    violations.push({
      rule: "mainline-event-needs-human-owner",
      detail: input.event.eventId,
    });
  }
  if (input.workUnit.status !== "accepted_by_human") {
    violations.push({
      rule: "mainline-event-needs-accepted-work-unit",
      detail: input.workUnit.status,
    });
  }
  if (
    input.workUnit.decision?.decision !== "accepted" ||
    !isHumanOwnerActor(input.workUnit.decision.decidedBy)
  ) {
    violations.push({
      rule: "mainline-event-needs-accepted-human-decision",
      detail: input.workUnit.id,
    });
  }
  if (!input.event.receipt) {
    violations.push({
      rule: "mainline-event-needs-receipt",
      detail: input.event.eventId,
    });
  }
  if (input.event.receipt && !isHumanOwnerActor(input.event.receipt.actor)) {
    violations.push({
      rule: "mainline-receipt-needs-human-owner",
      detail: input.event.receipt.receiptId,
    });
  }
  if (input.event.receipt && input.event.receipt.snapshotHash !== input.snapshotHash) {
    violations.push({
      rule: "mainline-receipt-snapshot-mismatch",
      detail: input.event.receipt.receiptId,
    });
  }

  const activeEventIds = activeEventIdsForConflictKeys(input.ledger, input.event.conflictKeys);
  for (const activeEventId of activeEventIds) {
    if (
      !input.event.supersedesEventIds.includes(activeEventId) ||
      !input.event.baselineEventIds.includes(activeEventId)
    ) {
      violations.push({
        rule: "conflict-key-active-event-needs-supersede",
        detail: activeEventId,
      });
    }
  }

  return violations;
}

function validateRepairCandidateEvent(input: {
  readonly workUnit: HelmWorkUnit;
  readonly event: PrivateMainlineLedgerEvent;
}): WorkUnitViolation[] {
  const violations: WorkUnitViolation[] = [];

  if (input.workUnit.status !== "candidate" || input.workUnit.agentRole !== "repair") {
    violations.push({
      rule: "repair-must-return-new-candidate",
      detail: `${input.workUnit.status}/${input.workUnit.agentRole}`,
    });
  }
  if (input.event.receipt) {
    violations.push({
      rule: "repair-candidate-cannot-carry-owner-receipt",
      detail: input.event.eventId,
    });
  }

  return violations;
}

function validateFindingEvent(event: PrivateMainlineLedgerEvent): WorkUnitViolation[] {
  if (!event.findingDisposition) {
    return [
      {
        rule: "finding-event-needs-disposition",
        detail: event.eventId,
      },
    ];
  }

  const violations = [...validateReviewFindingDisposition(event.findingDisposition)];
  if (
    event.eventType === "review_finding_asset_recorded" &&
    event.findingDisposition.disposition !== "asset_recorded"
  ) {
    violations.push({
      rule: "finding-event-needs-asset-disposition",
      detail: event.eventId,
    });
  }
  if (event.eventType === "owner_waiver_recorded") {
    if (event.findingDisposition.disposition !== "owner_waived") {
      violations.push({
        rule: "finding-waiver-event-needs-waiver-disposition",
        detail: event.eventId,
      });
    }
    if (!isHumanOwnerActor(event.actor)) {
      violations.push({
        rule: "finding-waiver-event-needs-human-owner",
        detail: event.eventId,
      });
    }
  }

  return violations;
}

export function planPrivateMainlineLedgerAppend(input: {
  readonly ledger: PrivateMainlineLedger;
  readonly workUnit: unknown;
  readonly event: unknown;
}): PrivateMainlineLedgerAppendPlan {
  const ledgerParse = privateMainlineLedgerSchema.safeParse(input.ledger);
  const workUnitParse = helmWorkUnitSchema.safeParse(input.workUnit);
  const eventParse = privateMainlineLedgerEventSchema.safeParse(input.event);
  const parseViolations: WorkUnitViolation[] = [];

  if (!ledgerParse.success) {
    parseViolations.push(...schemaViolations("mainline-ledger", ledgerParse.error));
  }
  if (!workUnitParse.success) {
    parseViolations.push(...schemaViolations("work-unit", workUnitParse.error));
  }
  if (!eventParse.success) {
    parseViolations.push(...schemaViolations("mainline-event", eventParse.error));
  }
  if (!ledgerParse.success || !workUnitParse.success || !eventParse.success) {
    return blockedPlan(parseViolations);
  }

  const ledger = normalizeLedger(ledgerParse.data);
  const workUnit = workUnitParse.data;
  const event = eventParse.data;
  const snapshotHash = computeWorkUnitSnapshotHash(workUnit);
  const violations: WorkUnitViolation[] = [
    ...validateWorkUnitWithinPublicCore(workUnit),
  ];

  if (ledger.events.some((existingEvent) => existingEvent.eventId === event.eventId)) {
    violations.push({
      rule: "mainline-event-id-duplicate",
      detail: event.eventId,
    });
  }
  if (event.ledgerRef !== ledger.ledgerRef) {
    violations.push({
      rule: "mainline-event-ledger-ref-mismatch",
      detail: `${event.ledgerRef} != ${ledger.ledgerRef}`,
    });
  }
  if (event.workUnitId !== workUnit.id) {
    violations.push({
      rule: "mainline-event-work-unit-mismatch",
      detail: `${event.workUnitId} != ${workUnit.id}`,
    });
  }
  if (event.snapshotHash !== snapshotHash) {
    violations.push({
      rule: "mainline-event-snapshot-mismatch",
      detail: event.eventId,
    });
  }
  if (!sameSet(event.conflictKeys, workUnit.conflictKeys)) {
    violations.push({
      rule: "mainline-event-conflict-keys-mismatch",
      detail: event.eventId,
    });
  }

  switch (event.eventType) {
    case "mainline_recorded":
      violations.push(
        ...validateMainlineRecordEvent({
          ledger,
          workUnit,
          event,
          snapshotHash,
        }),
      );
      break;
    case "repair_candidate_recorded":
      violations.push(...validateRepairCandidateEvent({ workUnit, event }));
      break;
    case "review_finding_asset_recorded":
    case "owner_waiver_recorded":
      violations.push(...validateFindingEvent(event));
      break;
    case "activation_authorized":
      if (!event.receipt || !isHumanOwnerActor(event.receipt.actor)) {
        violations.push({
          rule: "activation-ledger-event-needs-human-owner-receipt",
          detail: event.eventId,
        });
      }
      break;
    case "activation_requested":
    case "mainline_superseded":
      if (!isHumanOwnerActor(event.actor)) {
        violations.push({
          rule: "mainline-event-needs-human-owner",
          detail: event.eventId,
        });
      }
      break;
  }

  if (violations.length > 0) {
    return blockedPlan(violations);
  }

  const nextEvents = [...ledger.events, event];
  const nextLedger: PrivateMainlineLedgerSnapshot = {
    ...ledger,
    events: nextEvents,
    effectiveByConflictKey: buildEffectiveView(nextEvents),
    publicCoreCarriesRealInstance: false,
  };

  return {
    ok: true,
    event,
    nextLedger,
    publicCorePersists: false,
    publicCoreWritesPrivateMainline: false,
    createsExternalEffect: false,
    auditNote: "Append plan only; the private owner plane stores any real ledger instance.",
  };
}

export function buildPrivateMainlineLedgerReadout(
  input: PrivateMainlineLedger,
): PrivateMainlineLedgerReadout {
  const ledger = normalizeLedger(input);
  const latestEvent = ledger.events.at(-1);

  return {
    ledgerRef: ledger.ledgerRef,
    eventCount: ledger.events.length,
    effectiveConflictKeyCount: ledger.effectiveByConflictKey.length,
    latestEventId: latestEvent?.eventId ?? null,
    publicCoreCarriesRealInstance: false,
    userVisible: {
      title: { zh: "公司主线账本", en: "Company mainline ledger" },
      summary: {
        zh: `${ledger.events.length} 条追加记录，${ledger.effectiveByConflictKey.length} 个当前有效冲突键。`,
        en: `${ledger.events.length} append-only event(s), ${ledger.effectiveByConflictKey.length} current conflict key(s).`,
      },
      boundary: {
        zh: "无真实客户事实、无自动批准、无写回、无外发、无运行时生效。",
        en: "No real customer facts, automatic approval, writeback, external send, or runtime activation.",
      },
    },
  };
}
