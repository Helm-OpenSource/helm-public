import { describe, expect, it } from "vitest";

import { computeWorkUnitSnapshotHash, type HelmWorkUnit } from "./contracts";
import {
  buildPrivateMainlineLedgerReadout,
  privateMainlineLedgerEventSchema,
  planPrivateMainlineLedgerAppend,
  validateReviewFindingDisposition,
  type PrivateMainlineLedger,
  type PrivateMainlineLedgerEvent,
} from "./mainline-ledger";
import {
  buildSyntheticWorkUnit,
  syntheticAcceptedDecision,
  syntheticReceipt,
  WORK_UNIT_SYNTHETIC_TIME,
} from "./synthetic-fixtures";

const BASE_LEDGER = {
  schemaVersion: "helm.private-mainline-ledger.v1",
  ledgerRef: "synthetic-ledger:work-unit-mainline",
  events: [],
  publicCoreCarriesRealInstance: false,
} satisfies PrivateMainlineLedger;

function acceptedWorkUnit(overrides: Partial<HelmWorkUnit> = {}) {
  const candidate = buildSyntheticWorkUnit({
    ...overrides,
    status: "candidate",
    decision: undefined,
    decisionSnapshotHash: undefined,
    mergeReceipt: undefined,
    activationReceipt: undefined,
  });
  const snapshotHash = computeWorkUnitSnapshotHash(candidate);
  return buildSyntheticWorkUnit({
    ...overrides,
    status: "accepted_by_human",
    decisionSnapshotHash: snapshotHash,
    decision: syntheticAcceptedDecision(snapshotHash),
  });
}

function promotionEvent(
  workUnit = acceptedWorkUnit(),
  overrides: Partial<PrivateMainlineLedgerEvent> = {},
): PrivateMainlineLedgerEvent {
  const snapshotHash = computeWorkUnitSnapshotHash(workUnit);
  return privateMainlineLedgerEventSchema.parse({
    schemaVersion: "helm.private-mainline-ledger-event.v1",
    ledgerRef: BASE_LEDGER.ledgerRef,
    eventId: `ledger-event:${workUnit.id}:mainline`,
    workUnitId: workUnit.id,
    eventType: "mainline_recorded",
    actor: { actorType: "human_owner", actorRef: "owner-1" },
    at: WORK_UNIT_SYNTHETIC_TIME,
    snapshotHash,
    conflictKeys: workUnit.conflictKeys,
    baselineEventIds: [],
    supersedesEventIds: [],
    auditRefs: ["synthetic://audit/mainline"],
    receipt: syntheticReceipt("mainline-receipt-1", snapshotHash),
    publicCoreCarriesRealInstance: false,
    createsExternalEffect: false,
    ...overrides,
  });
}

describe("private mainline ledger governance", () => {
  it("plans an append-only mainline event without Public Core persistence or effects", () => {
    const workUnit = acceptedWorkUnit();
    const event = promotionEvent(workUnit);

    const plan = planPrivateMainlineLedgerAppend({
      ledger: BASE_LEDGER,
      workUnit,
      event,
    });

    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.publicCorePersists).toBe(false);
      expect(plan.publicCoreWritesPrivateMainline).toBe(false);
      expect(plan.createsExternalEffect).toBe(false);
      expect(BASE_LEDGER.events).toHaveLength(0);
      expect(plan.nextLedger.events).toEqual([event]);
      expect(plan.nextLedger.effectiveByConflictKey).toEqual([
        {
          conflictKey: "quote:Q-001",
          eventId: event.eventId,
        },
      ]);
    }

    const readout = buildPrivateMainlineLedgerReadout(plan.ok ? plan.nextLedger : BASE_LEDGER);
    expect(readout.userVisible.title.zh).toBe("公司主线账本");
    expect(readout.userVisible.boundary.zh).toContain("无真实客户事实");
  });

  it("blocks AI or stale receipt attempts to record company mainline truth", () => {
    const workUnit = acceptedWorkUnit();
    const aiPlan = planPrivateMainlineLedgerAppend({
      ledger: BASE_LEDGER,
      workUnit,
      event: promotionEvent(workUnit, {
        actor: { actorType: "ai", actorRef: "agent-1" },
      }),
    });

    expect(aiPlan.ok).toBe(false);
    if (!aiPlan.ok) {
      expect(aiPlan.violations.map((violation) => violation.rule)).toContain(
        "mainline-event-needs-human-owner",
      );
    }

    const staleReceiptPlan = planPrivateMainlineLedgerAppend({
      ledger: BASE_LEDGER,
      workUnit,
      event: promotionEvent(workUnit, {
        receipt: syntheticReceipt(
          "mainline-receipt-stale",
          "sha256:0000000000000000000000000000000000000000000000000000000000000000",
        ),
      }),
    });

    expect(staleReceiptPlan.ok).toBe(false);
    if (!staleReceiptPlan.ok) {
      expect(staleReceiptPlan.violations.map((violation) => violation.rule)).toContain(
        "mainline-receipt-snapshot-mismatch",
      );
    }
  });

  it("serializes overlapping conflict keys through superseding baseline evidence", () => {
    const firstWorkUnit = acceptedWorkUnit();
    const firstEvent = promotionEvent(firstWorkUnit);
    const firstPlan = planPrivateMainlineLedgerAppend({
      ledger: BASE_LEDGER,
      workUnit: firstWorkUnit,
      event: firstEvent,
    });
    expect(firstPlan.ok).toBe(true);
    if (!firstPlan.ok) throw new Error("first ledger append should pass");

    const secondWorkUnit = acceptedWorkUnit({
      id: "hwu-synthetic-002",
      objective: "Supersede the synthetic quote rule after another owner review.",
    });
    const blockedPlan = planPrivateMainlineLedgerAppend({
      ledger: firstPlan.nextLedger,
      workUnit: secondWorkUnit,
      event: promotionEvent(secondWorkUnit, {
        eventId: "ledger-event:hwu-synthetic-002:mainline",
      }),
    });

    expect(blockedPlan.ok).toBe(false);
    if (!blockedPlan.ok) {
      expect(blockedPlan.violations.map((violation) => violation.rule)).toContain(
        "conflict-key-active-event-needs-supersede",
      );
    }

    const supersedingPlan = planPrivateMainlineLedgerAppend({
      ledger: firstPlan.nextLedger,
      workUnit: secondWorkUnit,
      event: promotionEvent(secondWorkUnit, {
        eventId: "ledger-event:hwu-synthetic-002:mainline",
        baselineEventIds: [firstEvent.eventId],
        supersedesEventIds: [firstEvent.eventId],
      }),
    });

    expect(supersedingPlan.ok).toBe(true);
    if (supersedingPlan.ok) {
      expect(supersedingPlan.nextLedger.effectiveByConflictKey).toEqual([
        {
          conflictKey: "quote:Q-001",
          eventId: "ledger-event:hwu-synthetic-002:mainline",
        },
      ]);
      expect(supersedingPlan.nextLedger.events.map((eventItem) => eventItem.eventId)).toEqual([
        firstEvent.eventId,
        "ledger-event:hwu-synthetic-002:mainline",
      ]);
    }
  });

  it("requires each review finding to become an executable asset or owner waiver", () => {
    expect(
      validateReviewFindingDisposition({
        findingId: "finding-1",
        disposition: "asset_recorded",
        assetKind: "check",
        assetRef: "synthetic://guard/renewal-cost-required",
        summary: "Add a synthetic renewal-cost guard.",
        recordedBy: { actorType: "system", actorRef: "guard-writer" },
        recordedAt: WORK_UNIT_SYNTHETIC_TIME,
      }),
    ).toEqual([]);

    expect(
      validateReviewFindingDisposition({
        findingId: "finding-2",
        disposition: "owner_waived",
        summary: "Synthetic owner accepts this gap for the current test fixture.",
        recordedBy: { actorType: "human_owner", actorRef: "owner-1" },
        recordedAt: WORK_UNIT_SYNTHETIC_TIME,
        waiverReason: "Fixture does not need an extra guard.",
      }),
    ).toEqual([]);

    expect(
      validateReviewFindingDisposition({
        findingId: "finding-3",
        disposition: "owner_waived",
        summary: "AI attempted to waive the finding.",
        recordedBy: { actorType: "ai", actorRef: "agent-1" },
        recordedAt: WORK_UNIT_SYNTHETIC_TIME,
        waiverReason: "No human owner reviewed this.",
      }).map((violation) => violation.rule),
    ).toContain("finding-waiver-needs-human-owner");

    const workUnit = buildSyntheticWorkUnit();
    const waiverEvent = privateMainlineLedgerEventSchema.parse({
      schemaVersion: "helm.private-mainline-ledger-event.v1",
      ledgerRef: BASE_LEDGER.ledgerRef,
      eventId: "ledger-event:finding-ai-waiver",
      workUnitId: workUnit.id,
      eventType: "owner_waiver_recorded",
      actor: { actorType: "ai", actorRef: "agent-1" },
      at: WORK_UNIT_SYNTHETIC_TIME,
      snapshotHash: computeWorkUnitSnapshotHash(workUnit),
      conflictKeys: workUnit.conflictKeys,
      baselineEventIds: [],
      supersedesEventIds: [],
      auditRefs: ["synthetic://audit/finding-waiver"],
      findingDisposition: {
        findingId: "finding-4",
        disposition: "owner_waived",
        summary: "A human owner disposition was wrapped in an AI ledger event.",
        recordedBy: { actorType: "human_owner", actorRef: "owner-1" },
        recordedAt: WORK_UNIT_SYNTHETIC_TIME,
        waiverReason: "The wrapper actor should still fail closed.",
      },
      publicCoreCarriesRealInstance: false,
      createsExternalEffect: false,
    });
    const waiverPlan = planPrivateMainlineLedgerAppend({
      ledger: BASE_LEDGER,
      workUnit,
      event: waiverEvent,
    });

    expect(waiverPlan.ok).toBe(false);
    if (!waiverPlan.ok) {
      expect(waiverPlan.violations.map((violation) => violation.rule)).toContain(
        "finding-waiver-event-needs-human-owner",
      );
    }
  });

  it("allows AI repair only as a new candidate and never as accepted mainline truth", () => {
    const repairedCandidate = buildSyntheticWorkUnit({
      id: "hwu-synthetic-repair-001",
      agentRole: "repair",
      status: "candidate",
    });
    const repairEvent = privateMainlineLedgerEventSchema.parse({
      schemaVersion: "helm.private-mainline-ledger-event.v1",
      ledgerRef: BASE_LEDGER.ledgerRef,
      eventId: "ledger-event:hwu-synthetic-repair-001:repair-candidate",
      workUnitId: repairedCandidate.id,
      eventType: "repair_candidate_recorded",
      actor: { actorType: "ai", actorRef: "agent-1" },
      at: WORK_UNIT_SYNTHETIC_TIME,
      snapshotHash: computeWorkUnitSnapshotHash(repairedCandidate),
      conflictKeys: repairedCandidate.conflictKeys,
      baselineEventIds: [],
      supersedesEventIds: [],
      auditRefs: ["synthetic://audit/repair"],
      publicCoreCarriesRealInstance: false,
      createsExternalEffect: false,
    });

    const repairPlan = planPrivateMainlineLedgerAppend({
      ledger: BASE_LEDGER,
      workUnit: repairedCandidate,
      event: repairEvent,
    });

    expect(repairPlan.ok).toBe(true);

    const aiAcceptedWork = buildSyntheticWorkUnit({
      agentRole: "repair",
      status: "accepted_by_human",
      decision: {
        decidedBy: { actorType: "ai", actorRef: "agent-1" },
        decision: "accepted",
        decidedAt: WORK_UNIT_SYNTHETIC_TIME,
        snapshotHash: computeWorkUnitSnapshotHash(repairedCandidate),
        rationale: "AI attempted to skip owner review.",
      },
    });

    const blockedPlan = planPrivateMainlineLedgerAppend({
      ledger: BASE_LEDGER,
      workUnit: aiAcceptedWork,
      event: promotionEvent(aiAcceptedWork),
    });

    expect(blockedPlan.ok).toBe(false);
    if (!blockedPlan.ok) {
      expect(blockedPlan.violations.map((violation) => violation.rule)).toContain(
        "ai-cannot-authoritative-state",
      );
    }
  });
});
